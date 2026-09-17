// Punto de entrada. Un solo codigo, varios roles:
//   ROL=all          todo en un proceso (sin Docker)         -> http://localhost:3000
//   ROL=api          solo la API HTTP                        -> :3000
//   ROL=notificador  solo el servicio de correos             -> :3001
//   ROL=proyector    solo el modelo de lectura (CQRS)        -> :3002

import express from 'express';
import { config, describirConfig } from './config.js';
import { crearBroker, TEMAS, COLAS } from './broker/index.js';
import * as boleteria from './dominio/boleteria.js';
import * as notificador from './servicios/notificador.js';
import * as proyector from './servicios/proyector.js';
import { crearCasoDeUsoCompra } from './servicios/compra.js';

const rol = config.rol;
const esTodo = rol === 'all';
const app = express();
app.use(express.json());

const broker = config.modo === 'async' || esTodo ? await crearBroker() : null;

// ---------- Consumidores (workers) ----------
if (esTodo || rol === 'notificador') {
  if (config.modo === 'async') {
    await broker.suscribir(COLAS.NOTIFICACIONES, TEMAS.BOLETA_COMPRADA, notificador.enviar);
  }
  // Endpoint para el modo sync con Docker (la API lo llama por HTTP)
  app.post('/notificar', async (req, res) => {
    try {
      const r = await notificador.enviar(req.body);
      res.json(r);
    } catch (err) {
      res.status(503).json({ error: err.message });
    }
  });
  app.get('/estado', (_req, res) => res.json(notificador.estado()));
}

if (esTodo || rol === 'proyector') {
  if (config.modo === 'async') {
    await broker.suscribir(COLAS.PROYECCIONES, TEMAS.BOLETA_COMPRADA, proyector.proyectar);
  }
  app.get('/reportes/ventas', (_req, res) => res.json(proyector.reporteVentas()));
}

// ---------- API ----------
if (esTodo || rol === 'api') {
  // Como llamar al notificador en modo sync: local (all) o por HTTP (Docker)
  const notificar = esTodo
    ? notificador.enviar
    : async (evento) => {
        const r = await fetch(`${config.notificadorUrl}/notificar`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(evento),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw new Error(`notificador respondio ${r.status}`);
        return r.json();
      };

  const comprar = crearCasoDeUsoCompra({ broker, notificar });

  app.get('/', async (_req, res) => {
    res.json({
      laboratorio: 'Semana 5 - flujo y acoplamiento',
      config: describirConfig(),
      colas: broker?.estado() ?? 'sin broker (modo sync)',
      notificador: esTodo ? notificador.estado() : `ver ${config.notificadorUrl}/estado`,
      eventos: boleteria.resumenEventos(),
    });
  });

  app.get('/eventos', (_req, res) => res.json(boleteria.resumenEventos()));

  app.post('/compras', async (req, res) => {
    const inicio = Date.now();
    try {
      const compra = await comprar(req.body ?? {});
      res.status(201).json({ ...compra, tardoMs: Date.now() - inicio });
    } catch (err) {
      res.status(err.status ?? 400).json({ error: err.message, tardoMs: Date.now() - inicio });
    }
  });

  if (!esTodo) {
    // En Docker el reporte vive en otro proceso: la API solo lo reenvia.
    app.get('/reportes/ventas', async (_req, res) => {
      try {
        const r = await fetch(`${process.env.PROYECTOR_URL ?? 'http://localhost:3002'}/reportes/ventas`);
        res.json(await r.json());
      } catch (err) {
        res.status(503).json({ error: `proyector no responde: ${err.message}` });
      }
    });
  }

  // ---------- Perillas de clase ----------
  app.get('/admin/estado', (_req, res) =>
    res.json({ config: describirConfig(), colas: broker?.estado() ?? null, notificador: esTodo ? notificador.estado() : null }),
  );

  app.post('/admin/notificador/parar', (_req, res) => {
    if (!esTodo) return res.status(400).json({ error: 'con Docker usa: docker compose stop notificador' });
    notificador.parar();
    if (config.modo === 'async') broker.pausar(COLAS.NOTIFICACIONES);
    res.json({ ok: true, mensaje: 'notificador caido' });
  });

  app.post('/admin/notificador/reanudar', (_req, res) => {
    if (!esTodo) return res.status(400).json({ error: 'con Docker usa: docker compose start notificador' });
    notificador.reanudar();
    if (config.modo === 'async') broker.reanudar(COLAS.NOTIFICACIONES);
    res.json({ ok: true, mensaje: 'notificador de vuelta' });
  });

  app.post('/admin/proyector/parar', (_req, res) => {
    if (!esTodo) return res.status(400).json({ error: 'con Docker usa: docker compose stop proyector' });
    broker.pausar(COLAS.PROYECCIONES);
    res.json({ ok: true });
  });
  app.post('/admin/proyector/reanudar', (_req, res) => {
    if (!esTodo) return res.status(400).json({ error: 'con Docker usa: docker compose start proyector' });
    broker.reanudar(COLAS.PROYECCIONES);
    res.json({ ok: true });
  });

  // Entrega duplicada: el broker vuelve a entregar el ultimo evento.
  app.post('/admin/duplicar', async (_req, res) => {
    if (config.modo !== 'async') return res.status(400).json({ error: 'solo tiene sentido en MODO=async' });
    const m = await broker.duplicarUltimo();
    res.json(m ? { reentregado: m } : { error: 'aun no hay eventos publicados' });
  });

  app.post('/admin/reset', (_req, res) => {
    boleteria.sembrar();
    if (esTodo) {
      notificador.reset();
      proyector.reset();
    }
    res.json({ ok: true });
  });
}

const puerto = esTodo || rol === 'api' ? config.puerto : rol === 'notificador' ? 3001 : 3002;
app.listen(puerto, () => {
  console.log(`[${rol}] escuchando en :${puerto}`, describirConfig());
});
