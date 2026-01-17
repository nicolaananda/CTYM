# CattyMail

CattyMail is a disposable email service supporting `@catty.my.id` and `@cattyprems.top`.

## Features
- Random or custom username generation.
- 24-hour retention for emails and addresses.
- Real-time inbox polling.
- Clean, dark-mode web interface.

## Project Structure
- `backend/`: Go implementation (API + IMAP Ingestor).
- `frontend/`: React + Vite + TypeScript application.
- `deploy/`: Configuration files for Nginx and Systemd.

## Requirements
- Go 1.22+
- Node.js 18+
- Redis
- Access to an IMAP server (configured catch-all).

## 🐳 Docker Deployment (Recommended)

### Prerequisites
- Docker & Docker Compose installed.
- `.env` file with `IMAP_PASS` set.

### Quick Start
```bash
# 1. Clone the repository
git clone git@github.com:nicolaananda/CTYM.git
cd CTYM

# 2. Create environment file
echo "IMAP_PASS=your_imap_password" > .env

# 3. Build and run all services
docker-compose up --build -d

# 4. Check status
docker-compose ps
```

### Access
| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:4412   |
| API      | http://localhost:8080   |
| Redis    | localhost:6379          |

### Useful Commands
```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up --build -d
```

---

## Local Development (Without Docker)

For frontend development with hot-reload:
```bash
# Terminal 1: Start backend (requires Docker for Redis)
docker-compose up redis api ingestor -d

# Terminal 2: Start frontend dev server
cd frontend
npm install
npm run dev
```
Frontend will be at `http://localhost:5173` and automatically proxies `/api` to the backend.

---

## Production Deployment (VPS)

1. **Build Backend**:
   ```bash
   cd backend
   go build -o api ./cmd/api
   go build -o ingestor ./cmd/ingestor
   ```

2. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   # Output is in dist/
   ```

3. **Setup Directories**:
   - `/opt/cattymail/backend/`: Place `api` and `ingestor` binaries here.
   - `/var/www/cattymail/`: Place contents of `frontend/dist/` here.
   - `/etc/cattymail/env`: Environment variables file.

4. **Environment Variables**:
   Create `/etc/cattymail/env`:
   ```env
   REDIS_URL=redis://localhost:6379/0
   IMAP_HOST=mail.nicola.id
   IMAP_PORT=993
   IMAP_USER=catsflix@nicola.id
   IMAP_PASS=your_real_password
   ALLOWED_DOMAINS=catty.my.id,cattyprems.top
   TTL_SECONDS=86400
   ```

5. **Systemd Services**:
   - Copy `deploy/systemd/*.service` to `/etc/systemd/system/`.
   - `systemctl daemon-reload`
   - `systemctl enable --now cattymail-api cattymail-ingestor`

6. **Nginx**:
   - Copy `deploy/nginx.conf` to `/etc/nginx/sites-available/cattymail`.
   - Symlink to `sites-enabled`.
   - `systemctl restart nginx`.

## Security
- Rate limiting implemented for creation and fetching.
- HTML content is sanitized using DOMPurify.
- Redis keys expire automatically after 24 hours.
