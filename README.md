# build2ai server {
      listen 443 ssl http2;
      server_name 45.88.137.131;

      ssl_certificate /etc/ssl/certs/api.crt;
      ssl_certificate_key /etc/ssl/private/api.key;
      ssl_protocols TLSv1.2 TLSv1.3;

      location / {
          proxy_pass http://localhost:8001;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }

  server {
      listen 80;
      server_name 45.88.137.131;
      return 301 https://$server_name$request_uri;
  }














  pyardiso = solver
  stifness 
  shader language 3d 

  1. dinamik anliz time hsitory anlaiz
  2. push over anlaiz
