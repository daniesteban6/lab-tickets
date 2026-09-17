# Semana 5 · Flujo y acoplamiento · Guion de la clase (laboratorio)

Arquitectura de Software · UFPS · 2026-II · 3 horas

Notas para el profesor. No es material para estudiantes.

## Idea de la sesión

La semana 4 dejó la tabla escenario → patrón con capas, cliente-servidor y hexagonal. Esta semana la tabla crece con cuatro filas (eventos, idempotencia, saga, CQRS), pero no desde diapositivas: desde un sistema que se proyecta, se carga y se rompe delante de todos. Cada acto termina con la misma pregunta de siempre: **qué compró y qué cobró este cambio**.

Regla de la sesión: primero el escenario, después el patrón. Nunca se nombra el patrón antes de haber visto el problema en pantalla.

## Antes de la clase (checklist)

- [ ] Correr `docker compose up --build` en el portátil que se va a proyectar, con la red del salón, al menos un día antes. La imagen de RabbitMQ pesa unos 100 MB.
- [ ] Verificar que abre http://localhost:15672 (lab / lab) y http://localhost:3000.
- [ ] Tener listo el plan B sin Docker: `MODO=async npm start` en una terminal. Todo el guion funciona igual, solo cambia cómo se mata el notificador (endpoint en vez de `docker compose stop`).
- [ ] Dos terminales grandes con letra legible: una para los comandos, otra con `docker compose logs -f notificador` (o el log del proceso).
- [ ] Publicar en Moodle el repo (zip o enlace), la guía del bloque grupal (`docs/actividad-grupos.md`) y el enlace al simulador en el navegador (el artefacto "Simulador de flujo", compartido desde su menú), para los grupos que no tengan Docker.
- [ ] Un grupo por caso ya sabe qué flujo va a modelar (ver tabla al final), para no perder 15 minutos eligiendo.

## Cronograma

| Tiempo | Bloque |
|---|---|
| 0:00 – 0:10 | MVC, la deuda de la semana 4 |
| 0:10 – 0:20 | Encuadre y el sistema en pantalla |
| 0:20 – 0:35 | Acto 1 · Llamar y esperar |
| 0:35 – 0:45 | Acto 2 · Se cayó el correo |
| 0:45 – 1:05 | Acto 3 · Publicar y seguir |
| 1:05 – 1:20 | Acto 4 · El mensaje llegó dos veces |
| 1:20 – 1:30 | Descanso |
| 1:30 – 1:45 | Acto 5 · El pago falló a mitad de camino |
| 1:45 – 2:00 | Acto 6 · El reporte que llega tarde |
| 2:00 – 2:10 | La tabla escenario → patrón, actualizada |
| 2:10 – 2:55 | Bloque de trabajo por grupos |
| 2:55 – 3:00 | Cierre: E2 y previo |

## 0:00 · MVC en 10 minutos

Presentarlo como lo que vive **dentro** de un adaptador de entrada hexagonal, no como una arquitectura de sistema. Con el código del lab a la vista: `main.js` es el controlador (recibe HTTP, valida, delega), `dominio/boleteria.js` es el modelo, y la respuesta JSON es la vista más pobre posible. En una app web con plantillas, la vista sería la plantilla. Dos preguntas para cerrar: dónde se rompe MVC cuando el controlador empieza a tener reglas de negocio (respuesta: el modelo se vacía y el controlador engorda, que es la degeneración clásica), y por qué MVC no dice nada sobre colas ni servicios (porque es un patrón de organización del adaptador, no de la topología del sistema). Con eso queda saldada la deuda del microcurrículo.

## 0:10 · Encuadre

Mostrar `GET http://localhost:3000/` en el navegador. Es una boletería: dos eventos con cupos, se compra una boleta, se cobra y se avisa por correo. El correo tarda dos segundos porque los correos tardan (o porque el proveedor de correo es lento, o porque genera un PDF, da lo mismo).

Preguntar antes de tocar nada: "si 10 personas compran al tiempo, ¿cuánto tarda cada compra?". Anotar las respuestas en el tablero. Se vuelven a leer al final del acto 1.

Explicar el generador de carga con una frase: manda N compras con C al tiempo y reporta p50, p95 y máximo. Recordar que p95 es "el 5 % de los usuarios que peor la pasaron", que es el número que aparece en los escenarios de calidad de la semana 3.

## 0:20 · Acto 1 · Llamar y esperar

```bash
MODO=sync docker compose up --build      # o: MODO=sync npm start
node scripts/carga.js 40 10
```

Resultado esperado: 40 exitosas, p50 y p95 alrededor de 2 000 ms, duración total cerca de 8 segundos. Comparar con las respuestas del tablero.

Abrir `src/servicios/compra.js`, paso 3, rama `sync`. Leer en voz alta: `await notificar(evento)`. La compra **espera** al correo. Nombre del problema, ahora sí: **acoplamiento temporal**. El que llama depende de que el llamado esté disponible y sea rápido *en este instante*.

Pregunta: "¿el cliente necesita que el correo haya salido para saber que compró?". No. Entonces estamos cobrando 2 segundos por algo que el usuario no pidió.

Qué compra el modo sync: simplicidad, una sola pieza, y saber al responder que el correo salió. Qué cobra: la latencia del más lento y (siguiente acto) la disponibilidad del más frágil.

## 0:35 · Acto 2 · Se cayó el correo

```bash
docker compose stop notificador          # o: curl -X POST localhost:3000/admin/notificador/parar
node scripts/carga.js 10 5
```

Resultado esperado: 10 fallidas, error "no se pudo notificar, venta perdida". Mirar `GET /eventos`: los cupos volvieron, porque el código compensa. Insistir: **perdimos ventas porque el correo se cayó**. El correo no tiene nada que ver con cobrar.

Aquí entra el mecanismo de la B2 del previo, disponibilidad encadenada. Tablero: si la compra depende de pasarela, inventario, notificador y correo, cada uno al 99 %, la compra está al 0,99⁴ ≈ 96 %. Son cerca de 28 horas caídas al mes en vez de 7. Preguntar cuántas de esas dependencias son realmente necesarias para decir "compraste".

Dejar el notificador caído y pasar al acto 3 sin levantarlo. Sirve para el contraste.

## 0:45 · Acto 3 · Publicar y seguir

```bash
docker compose down
docker compose up --build                # MODO=async por defecto; o: MODO=async npm start
node scripts/carga.js 40 10
```

Resultado esperado: 40 exitosas, p50 y p95 de decenas de milisegundos, duración total menor a un segundo. Mismo notificador de 2 segundos, misma cantidad de correos.

Inmediatamente abrir el panel de RabbitMQ (http://localhost:15672, pestaña Queues): la cola `notificaciones` tiene decenas de mensajes y baja de a uno cada 2 segundos. En la terminal de logs se ven salir los correos. Sin Docker: `GET /admin/estado` muestra `pendientes`.

Ahora matar el notificador otra vez y cargar:

```bash
docker compose stop notificador
node scripts/carga.js 20 10
```

Las 20 compras son exitosas. La cola crece a 20 y se queda ahí. Levantar:

```bash
docker compose start notificador
```

La cola se drena. Ningún correo se perdió. Nombre del patrón, ahora sí: **arquitectura dirigida por eventos**, y la pieza es el **broker** o cola de mensajes.

Abrir `compra.js` rama `async`: `await broker.publicar(...)`. La compra ya no sabe quién escucha ni cuándo. Abrir `broker/memoria.js`: 60 líneas que hacen lo mismo que RabbitMQ en pequeño, para que nadie crea que es magia.

Tres preguntas para que las respondan ellos:

1. ¿Qué le prometimos al usuario cuando respondimos 201? Que la compra está pagada. No que el correo salió. Cambió el contrato.
2. ¿Qué pasa si se cae el broker? Volvimos a tener un punto único de falla, solo que ahora es uno diseñado para no caerse (réplicas, disco). Se compró disponibilidad moviendo el riesgo, no eliminándolo.
3. ¿Cuántos pendientes es demasiado? Si el notificador procesa uno cada 2 segundos y llegan 10 compras por segundo, la cola crece sin parar. La cola amortigua picos, no sostiene una diferencia permanente de velocidad. Solución: más consumidores. Si hay tiempo, comentar la línea `ports` del servicio `notificador` en el compose y correr `docker compose up -d --scale notificador=3`: con prefetch 1 los tres se reparten la cola y se ve drenar tres veces más rápido.

Qué compra async: latencia independiente del más lento, tolerancia a caídas del consumidor, agregar consumidores sin tocar la API. Qué cobra: una pieza más que operar, el usuario ya no sabe si el correo salió, y el siguiente acto.

## 1:05 · Acto 4 · El mensaje llegó dos veces

Contar el escenario real: el notificador procesó el mensaje, envió el correo, y justo antes de confirmarle al broker ("ack") se reinició. El broker no recibió confirmación, así que vuelve a entregar. Los brokers prometen **al menos una vez**, no exactamente una vez.

```bash
curl -X POST localhost:3000/admin/duplicar
curl localhost:3001/estado                 # sin Docker: localhost:3000/admin/estado
curl localhost:3000/reportes/ventas
```

Resultado esperado: `comprasConCorreoDuplicado: 1`. El cliente recibió dos correos. Y algo peor que casi nadie ve venir: el reporte de ventas también contó la compra dos veces. Mostrar `reportes/ventas` y compararlo con `GET /eventos` (los cupos están bien, el reporte no). El duplicado no solo molesta, **corrompe datos**.

Ahora con memoria:

```bash
IDEMPOTENTE=true docker compose up -d      # sin Docker: IDEMPOTENTE=true MODO=async npm start
node scripts/carga.js 5 5
curl -X POST localhost:3000/admin/duplicar
```

En los logs: "ya se notifico, se ignora el duplicado" y "ya estaba contada, se ignora". Nombre: **idempotencia**. Abrir `notificador.js` y `proyector.js`: un `Set` de `compraId`. En la vida real es una tabla con clave única, o una clave de idempotencia que manda el cliente.

Conectar con la B2 del previo: timeout → reintento → idempotencia. Sin idempotencia, reintentar es peligroso; con idempotencia, reintentar es gratis. Por eso van juntos.

Pregunta: ¿y si el `Set` vive en memoria y el notificador se reinicia? Se pierde la memoria y vuelven los duplicados. La idempotencia también hay que persistirla.

## 1:30 · Acto 5 · El pago falló a mitad de camino

```bash
curl -X POST localhost:3000/compras -H 'content-type: application/json' \
  -d '{"eventoId":"teatro","cantidad":3,"fallarPago":true}'
curl localhost:3000/eventos
```

Resultado esperado: 402 "pago rechazado, reserva liberada", y los cupos de teatro intactos. Abrir `compra.js` completo y leerlo como una historia: reservar, cobrar, y si cobrar falla, **liberar**. Nombre: **saga**, y la palabra clave es **compensación**. No hay transacción que abarque inventario, pasarela y correo; en su lugar hay pasos que saben deshacerse.

En el tablero, dibujar la misma saga **coreografiada**: inventario publica "reservado", pagos escucha y publica "pagado" o "rechazado", inventario escucha "rechazado" y libera. Nadie tiene el flujo completo. Preguntar qué compra cada una: la orquestada es fácil de leer y de depurar (todo está en `compra.js`) pero el orquestador conoce a todos; la coreografiada desacopla, pero para saber "en qué va la compra 123" hay que reconstruirlo desde los eventos.

Pregunta difícil, para dejarla abierta: ¿y si la compensación falla? (Liberar cupos falló porque inventario se cayó.) Reintentar, con idempotencia, y si sigue fallando, una cola de "muertos" y una persona. No todo se resuelve con código.

Con `PAGO_FALLA_PROB=0.3` y una carga de 40 se ve la saga en volumen: 12 rechazadas, cupos cuadrados.

## 1:45 · Acto 6 · El reporte que llega tarde

```bash
curl localhost:3000/reportes/ventas
curl localhost:3000/eventos
```

Dos lecturas del mismo negocio. `/eventos` viene del modelo de escritura (los cupos). `/reportes/ventas` viene de un **modelo de lectura** que se construye escuchando los eventos y que nadie más toca. Nombre: **CQRS** (separar el modelo que escribe del que responde preguntas).

Romperlo:

```bash
docker compose stop proyector              # sin Docker: POST /admin/proyector/parar
node scripts/carga.js 10 5
curl localhost:3000/reportes/ventas        # no cambió
curl localhost:3000/eventos                # sí cambió
docker compose start proyector
curl localhost:3000/reportes/ventas        # ahora sí
```

Nombre del precio: **consistencia eventual**. Pregunta a la sala: ¿a quién le importa que el reporte esté 30 segundos atrasado? Al gerente que mira el dashboard, no. Al sistema que decide si queda el último cupo, sí, y por eso ese dato se lee del modelo de escritura. CQRS no es "todo eventual"; es decidir qué preguntas toleran atraso.

Qué compra: lecturas rápidas y con la forma que la pregunta necesita, sin cargar la base transaccional. Qué cobra: dos modelos que mantener, y explicarle al usuario por qué lo que acaba de hacer todavía no aparece.

## 2:00 · La tabla, actualizada

Cuatro filas nuevas sobre la tabla de la semana 4, escritas con ellos, en sus palabras:

| Escenario | Patrón o pieza | Qué compra | Qué cobra |
|---|---|---|---|
| Un paso lento o frágil que el usuario no necesita esperar | Eventos + broker | Latencia y disponibilidad independientes del consumidor | Una pieza más, contrato más débil, colas que crecen |
| Reintentos o entregas repetidas | Idempotencia | Reintentar sin miedo | Recordar qué ya se hizo, y persistirlo |
| Varios pasos en varios servicios sin transacción común | Saga (orquestada o coreografiada) | Consistencia sin bloqueo global | Compensaciones que también pueden fallar |
| Preguntas de lectura con forma distinta a la escritura | CQRS | Lecturas rápidas y a la medida | Dos modelos y consistencia eventual |

Mensaje para cerrar: ninguna fila dice "úsese siempre". La boletería del acto 1 es la arquitectura correcta para un teatro de 200 sillas con un evento al mes.

## 2:10 · Bloque de trabajo por grupos

La guía está en `docs/actividad-grupos.md`. Resumen: cada grupo toma el flujo de varios pasos de su caso (asignado abajo), decide paso por paso si es síncrono o por evento, marca dónde necesita idempotencia y compensación, escribe la vista de contenedores en Structurizr DSL (https://structurizr.com/dsl, en el navegador, sin cuenta) y deja el borrador del ADR de patrón para la E2.

Flujo sugerido por caso (para no perder tiempo eligiendo):

| Grupo | Flujo |
|---|---|
| 1 Matrículas | Inscribir materia: validar prerrequisitos, reservar cupo, registrar, notificar |
| 2 Billetera | Transferencia entre usuarios: validar saldo, debitar, acreditar, notificar a ambos |
| 3 Domicilios | Pedido: confirmar con el restaurante, cobrar, asignar repartidor, avisar al cliente |
| 4 Telemedicina | Agendar cita: verificar disponibilidad del médico, reservar, cobrar, enviar enlace |
| 5 Boletería | Compra con selección de silla: bloquear silla, cobrar, emitir boleta con QR, notificar |
| 6 Transporte | Posición del bus: recibir GPS, actualizar mapa, recalcular tiempos, alertar a suscritos |
| 7 Exámenes | Entregar examen: guardar respuestas, calificar automático, registrar nota, notificar |
| 8 Marketplace | Compra: reservar artículo, cobrar con retención, avisar al vendedor, liberar pago al confirmar entrega |

El grupo 5 tiene el caso del lab; su reto es que la silla específica (no un cupo genérico) cambia el problema de concurrencia. Pedirles que lo expliquen.

Mientras trabajan: pasar por cada grupo con una sola pregunta, "¿qué paso de este flujo puede fallar y qué pasa con los anteriores?". Si no tienen respuesta, ese es su ADR.

## 2:55 · Cierre

La E2 (vista de contenedores + 2 ADR de patrón, uno clásico y uno agéntico) se entrega en el repo del grupo, en markdown, con la plantilla ADR de la guía general. Lo de hoy es el borrador del ADR clásico. El agéntico viene la semana 6.

Previo: los mecanismos de hoy (disponibilidad encadenada, timeout → reintento → idempotencia, orquestación vs. coreografía) son la parte B. Lo que vieron en pantalla es lo que se pregunta.

## Si algo sale mal

- Docker no levanta: `MODO=async npm start` y seguir el guion con los endpoints `/admin`. Se pierde el panel de RabbitMQ; `GET /admin/estado` lo reemplaza.
- El puerto 3000 está ocupado: `PUERTO=3005 npm start` y `node scripts/carga.js 40 10 http://localhost:3005`.
- La red del salón bloquea Docker Hub: por eso el checklist pide bajar las imágenes un día antes; una vez descargadas no se necesita red.
- Los números no dan como en el guion: da igual, lo importante es la diferencia entre modos, no el valor exacto. Decirlo en voz alta; es una buena lección sobre medir.
