FROM rabbitmq:3.9.0-management

RUN apt-get update -y && \
	apt-get install -y wget

RUN wget https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/3.9.0/rabbitmq_delayed_message_exchange-3.9.0.ez && \
	mv rabbitmq_delayed_message_exchange-3.9.0.ez plugins/

RUN rabbitmq-plugins enable rabbitmq_delayed_message_exchange
