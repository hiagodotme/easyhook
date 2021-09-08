const queue = require('./queue'),
    config = require('./config'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express()
    app.use(bodyParser.json())

queue.connect((conn) => {
    queue.channel(conn, (ch) => {

        // booting the webhook consumer
        queue.consumeWebhook(ch);

        // creating endpoint to request webhooks to be sent.
        app.post('/webhook', (req, res) => {

            let payload = {
                tx_url: req.body.tx_url,
                payload: req.body.payload,
                headers: req.body.headers || {}
            }

            ch.sendToQueue(config.WEBHOOK_QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
                persistent: true
            });

            res.send({ok: true});
        });

        app.listen(3000, () => console.log('Your EasyHook server is avaiable on 0.0.0.0:3000'))
    })
})
