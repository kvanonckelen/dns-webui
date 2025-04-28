FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    bind9 \
    bind9utils \
    bind9-doc \
    dnsutils \
    nginx \
    nodejs \
    npm \
    curl \
    openssl \
    && apt-get clean

# Create needed folders
RUN mkdir -p /app/zones /etc/bind/zones /app/public /app/views /app/nginx/certs \
    && chown -R www-data:www-data /app \
    && chmod -R 755 /app

WORKDIR /app

COPY . .

RUN npm install

RUN [ ! -f /app/nginx/certs/fullchain.pem ] && openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout /app/nginx/certs/privkey.pem \
  -out /app/nginx/certs/fullchain.pem \
  -subj "/CN=localhost" || true

COPY ./nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 53/udp
EXPOSE 53/tcp
EXPOSE 80
EXPOSE 443
EXPOSE 8080

CMD service bind9 start && service nginx start && node server.js
