# Discord AI Bot (Node.js)

Bot Discord dengan fitur AI menggunakan **9Router API** (OpenAI-compatible) + Node.js + discord.js.

## Fitur

- Slash command `/ai` untuk tanya AI
- Mention bot di chat untuk auto-reply AI
- Slash command `/ping` dan `/help`
- Slash command `/toggle-ai` untuk admin enable/disable AI per server
- Support custom model dari 9Router

## Tech Stack

- Node.js 18+
- discord.js v14
- OpenAI SDK (OpenAI-compatible)
- lowdb (JSON storage sederhana)

## Setup Local

1. Clone repository

```bash
git clone https://github.com/USERNAME/discord-ai-bot.git
cd discord-ai-bot
```

2. Install dependencies

```bash
npm install
```

3. Copy env

```bash
cp .env.example .env
```

4. Isi `.env`

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_client_id
API_BASE_URL=https://rwvg2am.9router.com/v1
API_KEY=sk-fcea5bb08adacb25-bwtept-ff2ee319
AI_MODEL=combo9
```

5. Deploy slash commands

```bash
npm run deploy-commands
```

6. Jalankan bot

```bash
npm start
```

## Setup Discord Developer Portal

1. Buka https://discord.com/developers/applications
2. Create Application baru
3. Masuk ke tab **Bot** > Add Bot
4. Copy **Token** ke `DISCORD_TOKEN`
5. Masuk ke **OAuth2 > URL Generator**:
   - Scope: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`
6. Invite bot ke server pakai URL generated
7. Copy **Application ID** ke `DISCORD_CLIENT_ID`

## Deploy ke GitHub

```bash
git init
git add .
git commit -m "init discord ai bot"
git branch -M main
git remote add origin https://github.com/USERNAME/discord-ai-bot.git
git push -u origin main
```

## Deploy Public (Rekomendasi)

### Opsi A - Railway

1. Push project ke GitHub
2. Buka Railway > New Project > Deploy from GitHub Repo
3. Pilih repo `discord-ai-bot`
4. Tambahkan Environment Variables:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `API_BASE_URL`
   - `API_KEY`
   - `AI_MODEL`
5. Railway akan auto deploy

### Opsi B - Render

Pakai **Background Worker**, bukan Web Service.

1. Push project ke GitHub
2. Buka Render > New > **Background Worker**
3. Connect repo GitHub
4. Render bisa baca `render.yaml` otomatis, atau set manual:
   - Build Command: `npm ci`
   - Start Command: `npm start`
5. Tambahkan environment variables:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `API_BASE_URL`
   - `API_KEY`
   - `AI_MODEL`
6. Deploy
7. Cek logs sampai muncul:
   - `✅ Bot ready! Logged in as ...`

## GitHub Actions

Sudah tersedia workflow di:

- `.github/workflows/deploy.yml`

Tambahkan repository secrets di GitHub:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `API_BASE_URL`
- `API_KEY`
- `AI_MODEL`
- `SERVER_RESTART_WEBHOOK` (opsional)

## Command List

- `/ai prompt:<teks>` - tanya AI
- `/ping` - cek latency
- `/help` - bantuan
- `/toggle-ai` - on/off AI per guild (admin)

## Catatan Penting

- Jangan commit file `.env`
- Slash command global butuh beberapa menit sampai muncul di semua server
- Untuk production, disarankan pakai process manager (PM2) jika deploy ke VPS

## Deploy via GitHub Organization + GHCR

### 1) Push repo ke GitHub Organization

Contoh repo:

- `github.com/galangsw27/discord-ai-bot`

### 2) Build image otomatis ke GHCR

Workflow sudah tersedia:

- `.github/workflows/ghcr.yml`

Saat push ke `main`, image dipublish ke:

- `ghcr.io/galangsw27/discord-ai-bot:latest`
- `ghcr.io/galangsw27/discord-ai-bot:sha-...`

### 3) Jalankan image di server

Copy `docker-compose.yml` ke server, lalu edit image:

```yaml
image: ghcr.io/galangsw27/discord-ai-bot:latest
```

Siapkan `.env` di server:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=1499882668098060452
API_BASE_URL=https://rwvg2am.9router.com/v1
API_KEY=...
AI_MODEL=ComboCodexMili
```

Jalankan:

```bash
docker compose pull
docker compose up -d
```

Atau pakai script helper:

```bash
chmod +x deploy.sh check.sh
./deploy.sh
```

Cek log:

```bash
docker compose logs -f
```

Cek status cepat:

```bash
./check.sh
```

### 4) Auto restart

Sudah diset di compose:

- `restart: unless-stopped`

## Lisensi

MIT
