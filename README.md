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

## Local Development (Docker Compose)
1. Set `IMAP_PASS` environment variable or create `.env` file.
   ```bash
   export IMAP_PASS="your_password"
   ```
2. Run with Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Open `http://localhost:5173` (Frontend requires manual start if not dockerized in dev, see below).

**Note**: The provided `docker-compose.yml` builds the backend. For frontend development:
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Update `frontend/.env` to point to `VITE_API_BASE_URL=http://localhost:8080/api` (or configure proxy).

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
