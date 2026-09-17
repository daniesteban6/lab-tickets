// Broker RabbitMQ: guarda los eventos en un proceso aparte (el contenedor
// rabbitmq) hasta que un consumidor los procesa. "Matar el notificador" es
// `docker compose stop notificador`, y la cola se ve crecer en
// http://localhost:15672 (usuario lab / clave lab).

import amqp from 'amqplib';

const EXCHANGE = 'boleteria';

export function crearBrokerRabbit(url) {
  let conexion = null;
  let canal = null;
  let ultimoMensaje = null;

  async function conectarConReintentos(intentos = 30) {
    for (let i = 1; i <= intentos; i++) {
      try {
        conexion = await amqp.connect(url);
        canal = await conexion.createChannel();
        await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
        console.log('[broker] conectado a RabbitMQ');
        return;
      } catch (err) {
        console.log(`[broker] RabbitMQ no responde (intento ${i}/${intentos}): ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error('No fue posible conectar a RabbitMQ');
  }

  return {
    nombre: 'rabbit',

    async conectar() {
      await conectarConReintentos();
    },

    async publicar(tema, mensaje) {
      ultimoMensaje = { tema, mensaje };
      const cuerpo = Buffer.from(JSON.stringify(mensaje));
      canal.publish(EXCHANGE, tema, cuerpo, { persistent: true, contentType: 'application/json' });
    },

    async suscribir(nombreCola, tema, handler) {
      await canal.assertQueue(nombreCola, { durable: true });
      await canal.bindQueue(nombreCola, EXCHANGE, tema);
      // prefetch 1: un mensaje a la vez, para que la cola se vea drenar de a uno
      await canal.prefetch(1);
      await canal.consume(nombreCola, async (msg) => {
        if (!msg) return;
        const mensaje = JSON.parse(msg.content.toString());
        try {
          await handler(mensaje);
          canal.ack(msg);
        } catch (err) {
          console.error(`[broker] ${nombreCola}: fallo procesando, se reencola`, err.message);
          await new Promise((r) => setTimeout(r, 500));
          canal.nack(msg, false, true); // requeue
        }
      });
      console.log(`[broker] consumiendo ${nombreCola} <- ${tema}`);
    },

    async duplicarUltimo() {
      if (!ultimoMensaje) return null;
      await this.publicar(ultimoMensaje.tema, ultimoMensaje.mensaje);
      return ultimoMensaje.mensaje;
    },

    estado() {
      return { nota: 'ver colas en http://localhost:15672 (lab / lab)' };
    },

    async cerrar() {
      await canal?.close();
      await conexion?.close();
    },
  };
}
