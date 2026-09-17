# Actividad por grupos · Del flujo al patrón

Arquitectura de Software · UFPS · 2026-II
Tiempo: 45 minutos en clase. Entrega: al final de la clase, en el repo del grupo.

## Qué vas a hacer

En el laboratorio viste una boletería pasar de "llamar y esperar" a "publicar y seguir", y viste lo que eso cobró: mensajes duplicados, compensaciones y reportes que llegan tarde. Ahora le toca a tu sistema.

Tu grupo toma un flujo de varios pasos de su caso (abajo está el sugerido para cada uno) y decide, paso por paso, cómo se comunican las piezas. No hay respuesta correcta única. Hay decisiones bien argumentadas con las fuerzas de tu caso, y decisiones sin argumento.

## Paso 1. Escribe el flujo (10 minutos)

Anota el flujo como una lista de pasos, en orden, con quién hace cada uno. Por ejemplo, para la boletería del laboratorio:

1. La API reserva el cupo (inventario)
2. La API cobra (pasarela de pagos)
3. Alguien envía el correo (notificador)
4. Alguien actualiza el reporte de ventas (proyector)

Tu flujo debería tener entre 4 y 6 pasos. Si tiene más, estás mezclando dos flujos.

## Paso 2. Decide paso por paso (15 minutos)

Para cada paso responde tres cosas:

**¿Síncrono o por evento?** La pregunta que te ayuda es la del laboratorio: ¿el usuario necesita que este paso haya terminado para saber que su acción funcionó? Cobrar, casi siempre sí. Enviar un correo, casi nunca. Ten cuidado con los pasos del medio.

**¿Qué pasa si este paso falla?** Si los pasos anteriores ya cambiaron algo, necesitas compensarlos. Anota cuál es la compensación de cada paso que la tenga. Si un paso no tiene compensación posible (ya se envió el correo, ya se despachó el pedido), anótalo también: eso cambia el orden en que conviene ejecutar los pasos.

**¿Qué pasa si este paso se ejecuta dos veces?** Si la respuesta es "se cobra dos veces" o "se cuenta dos veces", ese paso necesita idempotencia. Anota con qué dato la lograrías (un id de compra, un id de transacción, algo que el cliente mande).

Usa una tabla como esta:

| Paso | Quién | Síncrono o evento | Si falla | Si se repite |
|---|---|---|---|---|
| Reservar cupo | Inventario | Síncrono | Nada que deshacer | Ya reservado, ignorar |
| Cobrar | Pasarela | Síncrono | Liberar cupo | Idempotente por id de compra |
| Enviar correo | Notificador | Evento | Reintentar, luego alertar | Idempotente por id de compra |

## Paso 3. Dibuja la vista de contenedores (15 minutos)

Abre https://structurizr.com/dsl en el navegador. No necesitas cuenta. Pega el archivo `docs/boleteria.dsl` del laboratorio como punto de partida, cámbialo por tu sistema y presiona Render.

Cada contenedor es una pieza que corre por separado: tu API, tu base de datos, tu broker si decidiste usar uno, tus workers, y los sistemas externos con los que hablas. En cada flecha escribe el protocolo y si es síncrono o asíncrono. Esa palabra en la flecha es la decisión del paso 2 hecha diagrama.

Guarda el archivo `.dsl` en tu repo junto con una imagen exportada. El diagrama en texto es parte de la entrega: se versiona, se revisa y se compara igual que el código.

## Paso 4. Borrador del ADR (5 minutos)

Con la plantilla de la guía general, escribe el borrador del ADR de patrón clásico de la E2. Basta con esto por hoy:

- Decisión: qué paso (o pasos) van por evento y por qué.
- Alternativa descartada: hacer todo síncrono. Qué habrías ganado y qué te habría costado, con las fuerzas de tu caso.
- Consecuencia negativa: qué te cobra la decisión (una pieza más, consistencia eventual, idempotencia que hay que persistir, lo que aplique).

Si tu grupo decidió que todo va síncrono, también es una decisión válida. El ADR entonces explica por qué las fuerzas de tu caso no justifican una cola todavía, y qué señal te haría cambiar de opinión.

## Flujo sugerido por grupo

| Grupo | Flujo |
|---|---|
| 1 Matrículas | Inscribir una materia: validar prerrequisitos, reservar cupo, registrar, notificar |
| 2 Billetera | Transferir entre usuarios: validar saldo, debitar, acreditar, notificar a ambos |
| 3 Domicilios | Pedido: confirmar con el restaurante, cobrar, asignar repartidor, avisar al cliente |
| 4 Telemedicina | Agendar cita: verificar disponibilidad, reservar, cobrar, enviar enlace de la consulta |
| 5 Boletería | Comprar con silla específica: bloquear la silla, cobrar, emitir boleta con QR, notificar |
| 6 Transporte | Posición del bus: recibir GPS, actualizar mapa, recalcular tiempos, alertar a suscritos |
| 7 Exámenes | Entregar un examen: guardar respuestas, calificar automático, registrar nota, notificar |
| 8 Marketplace | Comprar: reservar artículo, cobrar con retención, avisar al vendedor, liberar el pago al confirmar entrega |

Puedes cambiar el flujo si tu grupo tiene uno más interesante en su caso. Avísame antes de empezar.

## Qué se entrega

En el repo del grupo, hoy mismo:

- `docs/flujo-<nombre>.md` con la lista de pasos y la tabla del paso 2
- `docs/contenedores.dsl` y la imagen exportada
- `docs/adr/ADR-001-<patron>.md` en borrador

Esto es el borrador de la E2. La semana que viene se le suma el ADR agéntico.

Profesor
