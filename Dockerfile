FROM ubuntu:22.04

# Install system packages
RUN apt-get update && apt-get install -y \
    bind9 \
    bind9utils \
    bind9-doc \
    dnsutils \
    nginx \
    curl \
    openssl

# Install Node.js 18 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# Create needed directories inside container
RUN mkdir -p /etc/bind/zones /app/zones /app/public /app/views /app/nginx/certs && \
    chown -R www-data:www-data /etc/bind/zones /app && \
    chmod -R 755 /etc/bind/zones /app

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install node modules
RUN npm install

# Create default SSL if missing
RUN [ ! -f /app/nginx/certs/fullchain.pem ] && openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout /app/nginx/certs/privkey.pem \
  -out /app/nginx/certs/fullchain.pem \
  -subj "/CN=localhost" || true

# Set Nginx config
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8053/udp 8053/tcp 80 443 8080 53

# Start bind9, nginx, node server
CMD ["/bin/sh", "-c", "/usr/sbin/named -g & nginx && node server.js"]
