require('dotenv').config();
let package = require('./package.json');

const rabbit = require('amqplib/callback_api'),
    axios = require('axios').default,
    config = require('./config');

function connect(callback) {
    rabbit.connect(`amqp://${config.RABBITMQ_USER}:${config.RABBITMQ_PASS}@${config.RABBITMQ_HOST}:${config.RABBITMQ_PORT}`, function (err, conn) {

        if (err) throw err;

        callback(conn);
    })
}

function channel(conn, callback) {
    conn.createChannel(function (err, ch) {

        if (err) throw err;

        ch.prefetch(parseInt(config.WEBHOOK_SIMULTANEOUS_DISPATCH));
        ch.assertQueue(config.WEBHOOK_QUEUE_NAME, { durable: true });
        callback(ch);
    });
}

function consumeWebhook(ch) {
    ch.assertExchange(`${config.WEBHOOK_QUEUE_NAME}_exchange`, "x-delayed-message", {
        autoDelete: false,
        durable: true,
        passive: true,
        arguments: {
            'x-delayed-type': "direct"
        }
    })
    ch.bindQueue(config.WEBHOOK_QUEUE_NAME, `${config.WEBHOOK_QUEUE_NAME}_exchange`, "webhook_out")

    ch.consume(config.WEBHOOK_QUEUE_NAME, async (message) => {
        let json;
        try {
            try {
                json = JSON.parse(message.content.toString());
            } catch (e) {
                if(config.SHOW_LOG === 'true')
                    console.log('[Alert!] Your message was rejected, as this project only works with JSON messages.')
                
                return;
            }

            json._hook_control = json._hook_control || {};
            json.headers = json.headers || {};

            if(config.SHOW_LOG === 'true')
                console.log('[Info] Received message!');
            


            // processando requisição
            const result = await axios.post(json.tx_url, json.payload, {
                headers: {
                    'User-Agent': `${package.name} ${package.version}`,
                    ...json.headers
                }
            });

            if (result.status !== 200 && result.status !== 201) {
                throw 'Não foi possivel notificar o serviço.';
            }

        } catch (e) {
            json._hook_control.it_retry_number = json._hook_control.it_retry_number || 0;
            json._hook_control.it_retry_number++;

            if (json._hook_control.it_retry_number >= parseInt(config.WEBHOOK_MAX_RETRY)) {
                if(config.SHOW_LOG === 'true')
                    console.log('[Alert!] The message will be canceled for too many attempts.')
                
                return;
            }

            // Requesting resubmission
            ch.publish(`${config.WEBHOOK_QUEUE_NAME}_exchange`, config.WEBHOOK_QUEUE_NAME, Buffer.from(JSON.stringify(json)), {
                headers: {
                    'x-delay': ((json._hook_control.it_retry_number * 60) * 1000)
                }
            })

        } finally {
            ch.ack(message)
        }
    });
}

module.exports = {
    connect,
    channel,
    consumeWebhook
}