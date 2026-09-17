// CQRS en su version minima: un "modelo de lectura" que se construye
// escuchando eventos, separado del modelo de escritura (dominio/boleteria.js).
// Responde la pregunta "cuanto hemos vendido por evento" sin tocar las tablas
// de compras. El precio: es consistente eventualmente, no al instante.
//
// Ojo: este consumidor tambien recibe entregas duplicadas. Si no recuerda
// que compras ya conto, el reporte miente. La idempotencia no es solo del correo.

import { config } from '../config.js';

const ventasPorEvento = new Map(); // eventoId -> { boletos, compras, ultimaActualizacion }
const yaContadas = new Set(); // compraIds ya proyectadas (idempotencia)

export async function proyectar(evento) {
  if (config.idempotente && yaContadas.has(evento.compraId)) {
    console.log(`[proyector] ${evento.compraId.slice(0, 8)} ya estaba contada, se ignora`);
    return;
  }
  const actual = ventasPorEvento.get(evento.eventoId) ?? { eventoId: evento.eventoId, boletos: 0, compras: 0 };
  actual.boletos += evento.cantidad;
  actual.compras += 1;
  actual.ultimaActualizacion = new Date().toISOString();
  ventasPorEvento.set(evento.eventoId, actual);
  yaContadas.add(evento.compraId);
}

export function reporteVentas() {
  return [...ventasPorEvento.values()];
}
