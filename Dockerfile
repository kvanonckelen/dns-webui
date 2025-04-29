FROM ubuntu:22.04

# Install required packages
RUN apt-get update && apt-get install -y \
    bind9 \
    bind9utils \
    bind9-doc \
    dnsutils \
    nginx \
    curl \
    openssl \
    npm\
    gnupg \
    ca-certificates

# ❗ Remove preinstalled nodejs and libnode-dev completely
RUN apt-get remove -y nodejs libnode-dev && apt-get autoremove -y

# Create required directories
RUN mkdir -p /etc/bind/zones /app/zones /app/public /app/nginx/certs && \
    chown -R www-data:www-data /etc/bind /app && \
    chmod -R 755 /etc/bind /app

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Copy application code
COPY . .

# Install Node.js dependencies
RUN npm install

# Generate self-signed SSL certs if not present
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /app/nginx/certs/privkey.pem \
    -out /app/nginx/certs/fullchain.pem \
    -subj "/CN=localhost"

# ✅ Inject the custom nginx config
RUN echo 'user www-data;\n\
worker_processes auto;\n\
pid /run/nginx.pid;\n\
\n\
events {\n\
    worker_connections 1024;\n\
}\n\
\n\
http {\n\
    include       mime.types;\n\
    default_type  application/octet-stream;\n\
    sendfile        on;\n\
    keepalive_timeout  65;\n\
\n\
    server {\n\
        listen 80 default_server;\n\
        listen [::]:80 default_server;\n\
        listen 443 ssl default_server;\n\
        listen [::]:443 ssl default_server;\n\
\n\
        ssl_certificate /etc/nginx/certs/fullchain.pem;\n\
        ssl_certificate_key /etc/nginx/certs/privkey.pem;\n\
        ssl_session_cache shared:SSL:10m;\n\
        ssl_session_timeout 10m;\n\
        ssl_protocols TLSv1.2 TLSv1.3;\n\
        ssl_ciphers HIGH:!aNULL:!MD5;\n\
\n\
        server_name _;\n\
\n\
        location /static/ {\n\
            proxy_pass http://localhost:8080/static/;\n\
            proxy_http_version 1.1;\n\
            proxy_set_header Upgrade $http_upgrade;\n\
            proxy_set_header Connection \"upgrade\";\n\
            proxy_set_header Host $host;\n\
            proxy_cache_bypass $http_upgrade;\n\
        }\n\
\n\
        root /app/views;\n\
        index index.html;\n\
\n\
        location / {\n\
            try_files $uri $uri/ =404;\n\
        }\n\
\n\
        location /api/ {\n\
            proxy_pass http://localhost:8080/api/;\n\
            proxy_http_version 1.1;\n\
            proxy_set_header Upgrade $http_upgrade;\n\
            proxy_set_header Connection \"upgrade\";\n\
            proxy_set_header Host $host;\n\
            proxy_cache_bypass $http_upgrade;\n\
        }\n\
\n\
        location /zone {\n\
            proxy_pass http://localhost:8080/zone;\n\
            proxy_http_version 1.1;\n\
            proxy_set_header Upgrade $http_upgrade;\n\
            proxy_set_header Connection \"upgrade\";\n\
            proxy_set_header Host $host;\n\
            proxy_cache_bypass $http_upgrade;\n\
        }\n\
\n\
        location /login {\n\
            proxy_pass http://localhost:8080/login;\n\
        }\n\
\n\
        location /change-password {\n\
            proxy_pass http://localhost:8080/change-password;\n\
        }\n\
\n\
        location /users {\n\
            proxy_pass http://localhost:8080/users;\n\
        }\n\
    }\n\
}' > /etc/nginx/nginx.conf

# After creating default certs in /app/nginx/certs
RUN mkdir -p /etc/nginx/certs && \
    cp /app/nginx/certs/*.pem /etc/nginx/certs/


EXPOSE 53/udp 53/tcp 80 443

# Start all services: bind9, nginx, node app
CMD ["/bin/sh", "-c", "/usr/sbin/named -g & nginx && node server.js"]
