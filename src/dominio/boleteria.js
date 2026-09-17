// El "modelo de escritura": eventos con cupos, compras y una pasarela de pago falsa.
// Todo en memoria, a proposito: el laboratorio es sobre flujo y acoplamiento,
// no sobre persistencia.

import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

export const eventos = new Map();
export const compras = new Map();

export function sembrar() {
  eventos.clear();
  compras.clear();
  eventos.set('concierto', { id: 'concierto', nombre: 'Concierto en el estadio', capacidad: 5000, disponibles: 5000 });
  eventos.set('teatro', { id: 'teatro', nombre: 'Obra de teatro', capacidad: 200, disponibles: 200 });
}
sembrar();

// Paso 1 de la saga: reservar cupos (reversible)
export function reservar(eventoId, cantidad) {
  const ev = eventos.get(eventoId);
  if (!ev) throw new Error(`evento no existe: ${eventoId}`);
  if (ev.disponibles < cantidad) throw new Error('sin cupos');
  ev.disponibles -= cantidad;
  const compra = { id: randomUUID(), eventoId, cantidad, estado: 'RESERVADA', creadaEn: Date.now() };
  compras.set(compra.id, compra);
  return compra;
}

// Compensacion del paso 1: devolver los cupos
export function liberar(compraId) {
  const compra = compras.get(compraId);
  if (!compra) return;
  eventos.get(compra.eventoId).disponibles += compra.cantidad;
  compra.estado = 'CANCELADA';
}

// Paso 2 de la saga: cobrar (una pasarela externa que a veces falla)
export async function cobrar(compra, { forzarFallo = false } = {}) {
  await new Promise((r) => setTimeout(r, 30)); // una pasarela real tarda
  if (forzarFallo || Math.random() < config.pagoFallaProb) {
    throw new Error('pasarela rechazo el pago');
  }
  compra.estado = 'PAGADA';
  compra.pagadaEn = Date.now();
  return compra;
}

export function resumenEventos() {
  return [...eventos.values()];
}
