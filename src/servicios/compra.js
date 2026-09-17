// El caso de uso "comprar boleta", escrito como saga orquestada:
// un coordinador (esta funcion) ejecuta los pasos en orden y, si uno falla,
// deshace los anteriores. Comparar con la coreografia, donde cada servicio
// reacciona a eventos y nadie tiene el flujo completo.
//
//   reservar  ->  cobrar  ->  avisar (sync: llamar y esperar / async: publicar evento)
//      ^            |
//      +-- liberar <+   (compensacion si el cobro falla)

import { config } from '../config.js';
import { reservar, cobrar, liberar } from '../dominio/boleteria.js';
import { TEMAS } from '../broker/index.js';

export function crearCasoDeUsoCompra({ broker, notificar }) {
  return async function comprar({ eventoId, cantidad = 1, fallarPago = false }) {
    // Paso 1: reservar (reversible)
    const compra = reservar(eventoId, cantidad);

    // Paso 2: cobrar (si falla, compensar el paso 1)
    try {
      await cobrar(compra, { forzarFallo: fallarPago });
    } catch (err) {
      liberar(compra.id);
      const e = new Error(`pago rechazado, reserva liberada (${err.message})`);
      e.status = 402;
      e.compra = compra;
      throw e;
    }

    // Paso 3: avisar al cliente
    const evento = { tipo: TEMAS.BOLETA_COMPRADA, compraId: compra.id, eventoId, cantidad, en: Date.now() };

    if (config.modo === 'sync') {
      // Acoplamiento temporal: si el notificador tarda, la compra tarda;
      // si el notificador esta caido, la compra falla.
      try {
        await notificar(evento);
      } catch (err) {
        liberar(compra.id); // perdimos la venta por culpa del correo
        const e = new Error(`no se pudo notificar, venta perdida (${err.message})`);
        e.status = 502;
        throw e;
      }
    } else {
      // Desacoplado en tiempo: el broker guarda el evento, alguien lo procesara.
      await broker.publicar(TEMAS.BOLETA_COMPRADA, evento);
    }

    return compra;
  };
}
