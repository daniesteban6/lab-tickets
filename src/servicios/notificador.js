// El servicio lento del cuento: "enviar un correo" tarda NOTIFICAR_MS.
// Es el mismo codigo en modo sync (la API lo llama y espera) y en modo
// async (consume la cola). Lo unico que cambia es quien lo invoca.

import { config } from '../config.js';

const enviados = []; // registro de correos "enviados"
const yaProcesados = new Set(); // memoria de idempotencia (por compraId)
let activo = true;

export async function enviar(mensaje) {
  if (!activo) throw new Error('notificador caido');

  if (config.idempotente && yaProcesados.has(mensaje.compraId)) {
    console.log(`[notificador] ${mensaje.compraId.slice(0, 8)} ya se notifico, se ignora el duplicado`);
    return { duplicado: true };
  }

  await new Promise((r) => setTimeout(r, config.notificarMs)); // el correo "sale"
  enviados.push({ compraId: mensaje.compraId, eventoId: mensaje.eventoId, en: Date.now() });
  yaProcesados.add(mensaje.compraId);
  console.log(`[notificador] correo enviado por compra ${mensaje.compraId.slice(0, 8)} (${enviados.length} en total)`);
  return { duplicado: false };
}

export function estado() {
  const porCompra = {};
  for (const e of enviados) porCompra[e.compraId] = (porCompra[e.compraId] ?? 0) + 1;
  const duplicados = Object.values(porCompra).filter((n) => n > 1).length;
  return { activo, correosEnviados: enviados.length, comprasConCorreoDuplicado: duplicados, idempotente: config.idempotente };
}

export function parar() {
  activo = false;
}
export function reanudar() {
  activo = true;
}
export function reset() {
  enviados.length = 0;
  yaProcesados.clear();
  activo = true;
}
