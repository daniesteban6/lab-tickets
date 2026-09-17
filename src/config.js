// Toda la configuracion del laboratorio sale de variables de entorno.
// Cada variable es una "perilla" que el profesor gira en clase para
// provocar un comportamiento distinto sin tocar el codigo.

const env = (nombre, porDefecto) => process.env[nombre] ?? porDefecto;

export const config = {
  // Que hace este proceso: 'all' (todo en uno, sin Docker), 'api', 'notificador' o 'proyector'
  rol: env('ROL', 'all'),

  // 'sync': la API llama al notificador y espera.  'async': la API publica un evento y responde.
  modo: env('MODO', 'sync'),

  // 'memory': cola en el mismo proceso (solo con ROL=all).  'rabbit': RabbitMQ real.
  broker: env('BROKER', 'memory'),
  rabbitUrl: env('RABBIT_URL', 'amqp://lab:lab@localhost:5672'),

  puerto: Number(env('PUERTO', 3000)),
  // Solo en modo sync con Docker: donde vive el notificador
  notificadorUrl: env('NOTIFICADOR_URL', 'http://localhost:3001'),

  // Cuanto tarda "enviar un correo" (el servicio lento del cuento)
  notificarMs: Number(env('NOTIFICAR_MS', 2000)),

  // Si el notificador recuerda que mensajes ya proceso (idempotencia)
  idempotente: env('IDEMPOTENTE', 'false') === 'true',

  // Probabilidad de que la pasarela de pago falle (0 a 1). Tambien se puede forzar por compra.
  pagoFallaProb: Number(env('PAGO_FALLA_PROB', 0)),
};

export function describirConfig() {
  return {
    rol: config.rol,
    modo: config.modo,
    broker: config.broker,
    notificarMs: config.notificarMs,
    idempotente: config.idempotente,
    pagoFallaProb: config.pagoFallaProb,
  };
}
