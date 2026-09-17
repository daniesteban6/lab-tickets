// Punto de entrada. Cada contenedor corre uno de estos roles:
//   ROL=api          la API HTTP                        -> :3000
//   ROL=notificador  el servicio de correos              -> :3001
//   ROL=proyector    el modelo de lectura (CQRS)         -> :3002

import express from 'express';
import { config, describirConfig } from './config.js';
import { crearBroker, TEMAS, COLAS } from './broker/index.js';
import * as boleteria from './dominio/boleteria.js';
import * as notificador from './servicios/notificador.js';
import * as proyector from './servicios/proyector.js';
import { crearCasoDeUsoCompra } from './servicios/compra.js';

const rol = config.rol;
const app = express();
app.use(express.json());

const broker = config.modo === 'async' ? await crearBroker() : null;

// ---------- Consumidores (workers) ----------
if (rol === 'notificador') {
  if (config.modo === 'async') {
    await broker.suscribir(COLAS.NOTIFICACIONES, TEMAS.BOLETA_COMPRADA, notificador.enviar);
  }
  // Endpoint para el modo sync (la API lo llama por HTTP)
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

if (rol === 'proyector') {
  if (config.modo === 'async') {
    await broker.suscribir(COLAS.PROYECCIONES, TEMAS.BOLETA_COMPRADA, proyector.proyectar);
  }
  app.get('/reportes/ventas', (_req, res) => res.json(proyector.reporteVentas()));
}

// ---------- API ----------
if (rol === 'api') {
  const notificar = async (evento) => {
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
      laboratorio: 'Flujo y acoplamiento',
      config: describirConfig(),
      colas: broker?.estado() ?? 'sin broker (modo sync)',
      notificador: `ver ${config.notificadorUrl}/estado`,
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

  // El reporte vive en el proyector, en otro contenedor: la API solo lo reenvia.
  app.get('/reportes/ventas', async (_req, res) => {
    try {
      const r = await fetch(`${process.env.PROYECTOR_URL ?? 'http://localhost:3002'}/reportes/ventas`);
      res.json(await r.json());
    } catch (err) {
      res.status(503).json({ error: `proyector no responde: ${err.message}` });
    }
  });

  // ---------- Perillas de clase ----------
  app.get('/admin/estado', (_req, res) => res.json({ config: describirConfig(), colas: broker?.estado() ?? null }));

  // Entrega duplicada: el broker vuelve a entregar el ultimo evento.
  app.post('/admin/duplicar', async (_req, res) => {
    if (config.modo !== 'async') return res.status(400).json({ error: 'solo tiene sentido en MODO=async' });
    const m = await broker.duplicarUltimo();
    res.json(m ? { reentregado: m } : { error: 'aun no hay eventos publicados' });
  });

  app.post('/admin/reset', (_req, res) => {
    boleteria.sembrar();
    res.json({ ok: true });
  });
}

const puerto = rol === 'api' ? config.puerto : rol === 'notificador' ? 3001 : 3002;
app.listen(puerto, () => {
  console.log(`[${rol}] escuchando en :${puerto}`, describirConfig());
});
