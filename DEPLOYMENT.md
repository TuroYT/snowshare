# SnowShare Docker Deployment Guide 🐳

This guide covers deploying SnowShare using Docker in production.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/TuroYT/snowshare
   cd snowshare
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.production
   ```
   
   Edit `.env.production` and set:
   ```env
   DATABASE_URL="file:./data/snowshare.db"
   NEXTAUTH_SECRET="your-super-secret-key-change-this"
   NEXTAUTH_URL="https://your-domain.com"  # Change to your domain
   ALLOW_SIGNUP=true  # Set to false if you want to disable new user registration
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access your application**
   - Local: http://localhost:3000
   - Production: https://your-domain.com

## Data Persistence

SnowShare uses two Docker volumes for data persistence:

- **`snowshare_data`**: Contains the SQLite database
- **`snowshare_uploads`**: Contains uploaded files

### Backup Data

To backup your data:

```bash
# Backup database
docker run --rm -v snowshare_data:/data -v $(pwd):/backup alpine cp /data/snowshare.db /backup/

# Backup uploads
docker run --rm -v snowshare_uploads:/uploads -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /uploads .
```

### Restore Data

```bash
# Restore database
docker run --rm -v snowshare_data:/data -v $(pwd):/backup alpine cp /backup/snowshare.db /data/

# Restore uploads
docker run --rm -v snowshare_uploads:/uploads -v $(pwd):/backup alpine tar xzf /backup/uploads.tar.gz -C /uploads
```

## Production Considerations

### Reverse Proxy

For production, use a reverse proxy like Nginx or Traefik:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL/HTTPS

Make sure to:
1. Set `NEXTAUTH_URL` to your HTTPS domain
2. Configure SSL certificates (Let's Encrypt recommended)
3. Set up automatic certificate renewal

### Security

- Change the default `NEXTAUTH_SECRET` to a secure random string
- Consider setting `ALLOW_SIGNUP=false` after creating initial users
- Regularly update the Docker image
- Monitor logs for suspicious activity

### Monitoring

The application includes a health check endpoint at `/api/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2023-..."
}
```

## Troubleshooting

### Check container logs
```bash
docker-compose logs snowshare
```

### Check container status
```bash
docker-compose ps
```

### Restart the application
```bash
docker-compose restart snowshare
```

### Reset everything (CAUTION: This will delete all data)
```bash
docker-compose down -v
docker-compose up -d
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | SQLite database path | `file:./data/snowshare.db` | Yes |
| `NEXTAUTH_URL` | Public URL of your app | `http://localhost:3000` | Yes |
| `NEXTAUTH_SECRET` | Secret for JWT encryption | - | Yes |
| `ALLOW_SIGNUP` | Allow new user registration | `true` | No |
| `NODE_ENV` | Node.js environment | `production` | No |

## Updates

To update SnowShare:

1. **Pull the latest changes**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. **Check logs**
   ```bash
   docker-compose logs -f snowshare
   ```