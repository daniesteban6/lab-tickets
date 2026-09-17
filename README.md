# Laboratorio Semana 5 · Flujo y acoplamiento

Arquitectura de Software · UFPS · 2026-II

Una boletería mínima para ver, con números, qué compra y qué cobra cada decisión:
llamar y esperar vs. publicar un evento, entregas duplicadas e idempotencia,
una saga con compensación y un modelo de lectura (CQRS).

No es un sistema de producción. Todo vive en memoria a propósito: el tema es el flujo entre piezas, no la persistencia.

## Dos formas de correrlo

**Sin Docker (todo en un proceso).** Sirve para seguir el laboratorio en el portátil y para leer el código.

```bash
npm install
MODO=sync  NOTIFICAR_MS=2000 npm start     # acto 1 y 2
MODO=async NOTIFICAR_MS=2000 npm start     # actos 3 en adelante
```

**Con Docker (cada pieza en su contenedor, RabbitMQ real).** Es la versión que se proyecta en clase.

```bash
docker compose up --build                  # modo async
MODO=sync docker compose up --build        # modo sync
```

Panel de RabbitMQ: http://localhost:15672 (usuario `lab`, clave `lab`). Ahí se ven las colas llenarse y vaciarse.

## Las perillas

| Variable | Valores | Qué cambia |
|---|---|---|
| `MODO` | `sync` / `async` | La API llama al notificador y espera, o publica un evento y responde |
| `NOTIFICAR_MS` | ms | Cuánto tarda "enviar un correo" (por defecto 2000) |
| `IDEMPOTENTE` | `true` / `false` | Si los consumidores recuerdan qué compras ya procesaron |
| `PAGO_FALLA_PROB` | 0 a 1 | Probabilidad de que la pasarela rechace el pago |
| `BROKER` | `memory` / `rabbit` | Cola en el proceso o RabbitMQ (Compose ya lo pone en `rabbit`) |

## Endpoints

| Método y ruta | Para qué |
|---|---|
| `GET /` | Estado general: configuración, colas, notificador, cupos |
| `GET /eventos` | Cupos disponibles (modelo de escritura) |
| `POST /compras` `{eventoId, cantidad, fallarPago}` | Comprar boleta. `fallarPago: true` fuerza el rechazo del pago |
| `GET /reportes/ventas` | Ventas por evento (modelo de lectura, alimentado por eventos) |
| `POST /admin/notificador/parar` · `reanudar` | "Matar" y "revivir" el notificador (solo sin Docker; con Docker: `docker compose stop notificador`) |
| `POST /admin/proyector/parar` · `reanudar` | Lo mismo para el proyector |
| `POST /admin/duplicar` | El broker vuelve a entregar el último evento |
| `POST /admin/reset` | Vuelve todo al inicio |

Generador de carga:

```bash
node scripts/carga.js 40 10       # 40 compras, 10 en paralelo
```

Reporta p50, p95, máximo y fallos. Es la herramienta con la que se comparan los modos.

## Mapa del código

```
src/
  main.js                 arma el proceso según ROL (all | api | notificador | proyector)
  config.js               las perillas
  broker/
    memoria.js            cola en memoria, 60 líneas, para leer qué hace un broker
    rabbit.js             el mismo contrato sobre RabbitMQ
  dominio/boleteria.js    cupos, reservar, liberar, cobrar (modelo de escritura)
  servicios/
    compra.js             el caso de uso como saga orquestada
    notificador.js        el servicio lento; con o sin memoria de idempotencia
    proyector.js          modelo de lectura (CQRS)
scripts/carga.js          generador de carga
docs/                     guion de la clase y actividad de los grupos
```

`broker/index.js` es un puerto en el sentido hexagonal de la semana 4: la API y los workers hablan con "un broker" y el adaptador se elige por configuración.

## Nota de verificación

El modo sin Docker y el modo `sync` con procesos separados por HTTP se probaron completos.
El adaptador de RabbitMQ sigue la API estándar de `amqplib` pero conviene correr `docker compose up --build` una vez antes de la clase, con el portátil que se va a proyectar.
