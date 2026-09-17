// Vista de contenedores del laboratorio, en Structurizr DSL.
// Pegar en https://structurizr.com/dsl y presionar "Render".
// Es el punto de partida para la vista de contenedores de la E2.

workspace "Boletería (laboratorio semana 5)" "Sistema mínimo para ver flujo y acoplamiento" {

    model {
        cliente = person "Cliente" "Compra boletas para eventos"

        boleteria = softwareSystem "Boletería" "Vende boletas y avisa al cliente" {
            api = container "API de compras" "Recibe compras, reserva cupos y cobra. Orquesta la saga." "Node.js"
            broker = container "Broker de mensajes" "Guarda los eventos hasta que alguien los procese" "RabbitMQ"
            notificador = container "Notificador" "Envía el correo de confirmación. Idempotente por compraId." "Node.js"
            proyector = container "Proyector de ventas" "Modelo de lectura: ventas por evento (CQRS)" "Node.js"
        }

        pasarela = softwareSystem "Pasarela de pagos" "Sistema externo" "Externo"
        correo = softwareSystem "Proveedor de correo" "Sistema externo" "Externo"

        cliente -> api "Compra una boleta" "HTTPS, síncrono"
        api -> pasarela "Cobra" "HTTPS, síncrono, con timeout"
        api -> broker "Publica BoletaComprada" "AMQP, asíncrono"
        broker -> notificador "Entrega BoletaComprada" "AMQP, al menos una vez"
        broker -> proyector "Entrega BoletaComprada" "AMQP, al menos una vez"
        notificador -> correo "Envía el correo" "SMTP"
        cliente -> proyector "Consulta ventas por evento" "HTTPS, eventual"
    }

    views {
        systemContext boleteria "Contexto" {
            include *
            autoLayout lr
        }

        container boleteria "Contenedores" {
            include *
            autoLayout lr
        }

        styles {
            element "Person" {
                shape person
                background #1f3a5f
                color #ffffff
            }
            element "Externo" {
                background #999999
                color #ffffff
            }
            element "Container" {
                background #2e6fb7
                color #ffffff
            }
        }
    }
}
