// Broker en memoria: una cola por suscriptor, dentro del mismo proceso.
// Sirve para correr el laboratorio sin Docker y para leer, en 60 lineas,
// que hace un broker por debajo: guardar mensajes y entregarlos "al menos una vez".
//
// Lo que NO hace (y RabbitMQ si): sobrevivir a un reinicio, repartir entre
// procesos distintos, ni limitar cuanto puede acumular.

export function crearBrokerMemoria() {
  const colas = new Map(); // nombre -> { mensajes: [], handler, activa, procesando }
  let ultimoMensaje = null;

  function cola(nombre) {
    if (!colas.has(nombre)) {
      colas.set(nombre, { mensajes: [], handler: null, activa: true, procesando: false });
    }
    return colas.get(nombre);
  }

  async function bombear(nombre) {
    const c = cola(nombre);
    if (c.procesando || !c.activa || !c.handler) return;
    c.procesando = true;
    try {
      while (c.activa && c.mensajes.length > 0) {
        const msg = c.mensajes[0];
        try {
          await c.handler(msg);
          c.mensajes.shift(); // ack: solo se retira si el handler termino bien
        } catch (err) {
          // nack: se deja al final para reintentar (asi se ven los reintentos)
          console.error(`[broker] ${nombre}: fallo procesando, se reencola`, err.message);
          c.mensajes.push(c.mensajes.shift());
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } finally {
      c.procesando = false;
    }
  }

  return {
    nombre: 'memory',

    async conectar() {},

    // Publicar: el mensaje se copia a la cola de cada suscriptor del tema.
    async publicar(tema, mensaje) {
      ultimoMensaje = { tema, mensaje };
      for (const [nombre, c] of colas) {
        if (c.tema === tema) {
          c.mensajes.push(structuredClone(mensaje));
          setImmediate(() => bombear(nombre));
        }
      }
    },

    // Suscribir: un consumidor con nombre propio (cada uno recibe su copia).
    async suscribir(nombreCola, tema, handler) {
      const c = cola(nombreCola);
      c.tema = tema;
      c.handler = handler;
      setImmediate(() => bombear(nombreCola));
    },

    // Perillas de clase: "matar" y "revivir" un consumidor sin apagar el proceso.
    pausar(nombreCola) {
      cola(nombreCola).activa = false;
    },
    reanudar(nombreCola) {
      cola(nombreCola).activa = true;
      setImmediate(() => bombear(nombreCola));
    },

    // Reentrega el ultimo mensaje publicado, tal cual (simula entrega duplicada).
    async duplicarUltimo() {
      if (!ultimoMensaje) return null;
      await this.publicar(ultimoMensaje.tema, ultimoMensaje.mensaje);
      return ultimoMensaje.mensaje;
    },

    estado() {
      const out = {};
      for (const [nombre, c] of colas) {
        out[nombre] = { pendientes: c.mensajes.length, activa: c.activa };
      }
      return out;
    },

    async cerrar() {},
  };
}
