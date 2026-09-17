import { config } from '../config.js';
import { crearBrokerMemoria } from './memoria.js';
import { crearBrokerRabbit } from './rabbit.js';

// Un puerto (en el sentido hexagonal): la API y los workers hablan con
// "un broker", y aqui se decide cual adaptador se conecta.
export async function crearBroker() {
  const broker = config.broker === 'rabbit' ? crearBrokerRabbit(config.rabbitUrl) : crearBrokerMemoria();
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
