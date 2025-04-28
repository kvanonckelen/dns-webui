# DNS WebUI Manager

A full Bind9 DNS Manager with a secure WebUI, built inside a Ubuntu container.

## Features

- Full Bind9 DNS Server inside
- Node.js Express backend
- Tabler-based responsive frontend
- User authentication & password management
- HTTPS support with Nginx reverse proxy
- Docker + Docker Compose ready
- Automatic SOA serial bumping
- Add/Delete/Edit DNS records
- Create/Delete Zones dynamically
- Manage multiple users from UI

## Quick Start

```bash
git clone https://github.com/kvanonckelen/dns-webui.git
cd dns-webui
```

## Docker-compose file

```yml
services:
  dns-webui:
    image: kevinvobw/dns-webui
    container_name: dns-webui
    ports:
      - "53:53/udp"
      - "53:53/tcp"
      - "80:80"
      - "443:443"
    volumes:
      - ./bind/etc:/etc/bind
      - ./nginx/certs:/etc/nginx/certs
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    restart: unless-stopped
```

Make sure you have created a volume where the nginx configuration files can be stored. 
If that is done, you can start the container.

```bash
docker compose up --build
```

Then visit:

    http://localhost:8080 ➔ Redirects automatically to https://localhost

Default credentials:

    Username: admin

    Password: admin123

    (Force password change required after first login)



## PORTS

Service | Port
DNS (Bind9) | 53 TCP/UDP
HTTP | 80
HTTPS | 443

## DEVELOPMENT

To generate your own self-signed SSL certificates:

```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

### Advanced

Want to do more with it? please see my [github repo](https://github.com/kvanonckelen/dns-webui).

## LICENSE

MIT License

Copyright (c) 2025 kvanonckelen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


