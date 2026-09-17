import { config } from '../config.js';
import { crearBrokerRabbit } from './rabbit.js';

// Un puerto (en el sentido hexagonal): la API y los workers hablan con
// "un broker" sin conocer amqplib directamente.
export async function crearBroker() {
  const broker = crearBrokerRabbit(config.rabbitUrl);
  await broker.conectar();
  return broker;
}

// Nombres de temas y colas, en un solo lugar.
export const TEMAS = {
  BOLETA_COMPRADA: 'boleta.comprada',
};

export const COLAS = {
  NOTIFICACIONES: 'notificaciones',
  PROYECCIONES: 'proyecciones',
};
