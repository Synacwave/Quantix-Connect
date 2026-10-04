<div align="center">

# Quantix Connect

**Real-time messaging — dark theme, Socket.IO, Lucy AI companion.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

*Property of Vanta Labs · by Expectations Himself · Synacwave*

</div>

---

## Overview

**Quantix Connect** is a full-stack, Telegram-inspired chat app with:

- JWT auth, bcrypt passwords, rate limiting, Helmet CSP
- Direct chats, groups, reactions, polls, media, self-destruct messages
- Real-time updates via **Socket.IO**
- **Lucy** AI companion
- Admin tools, reports, blocks
- MongoDB Atlas **or** local JSON DB fallback

| Layer | Stack |
|-------|--------|
| **Frontend** | React 19, Vite, Tailwind CSS 4, Motion, Lucide |
| **Backend** | Node, Express, Socket.IO, JWT, bcrypt |
| **Database** | MongoDB (optional) / local JSON |

---

## Quick start

```bash
git clone https://github.com/Synacwave/Quantix-Connect.git
cd Quantix-Connect
npm install
npm run dev
```

App runs on **http://localhost:3000**.

### Environment (`.env`)

Copy `.env.example` to `.env` in the project root and fill in what you need. The server loads this file on startup via `dotenv`.

| Variable | Required | What it does |
|----------|----------|--------------|
| `PORT` | No | HTTP port (default `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | Recommended | Secret used to sign login tokens |
| `MONGODB_URI` | No | MongoDB connection string. **Leave empty** to use the built-in local JSON database |
| `GEMINI_API_KEY` | No | Enables Gemini as a Lucy AI fallback |
| `TELEGRAM_BOT_TOKEN` | No | Bot token for optional report notifications |
| `TELEGRAM_CHAT_ID` | No | Chat/user ID that receives those notifications |
| `BOOTSTRAP_ADMIN_USER` | No | Username created as admin on first matching login if the user does not exist yet |
| `BOOTSTRAP_ADMIN_PASS` | No | Password for that bootstrap admin |

Example:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=change_me_to_a_long_random_string
MONGODB_URI=
GEMINI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
BOOTSTRAP_ADMIN_USER=
BOOTSTRAP_ADMIN_PASS=
```

Only set the optional keys when you want those features. Keep `.env` local — it is listed in `.gitignore` so it is not committed.

### Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server (tsx + Vite) |
| `npm run build` | Production client + server bundle |
| `npm start` | Run production server |
| `npm run lint` | Typecheck |

---

## Lucy AI

Lucy answers in chat using the primary AI provider. If `GEMINI_API_KEY` is set in `.env`, Gemini is available as a fallback.

---

## Deploy (Render)

The repo includes `render.yaml` for Render blueprints. In the Render dashboard, set the same environment variables as above (`MONGODB_URI`, `JWT_SECRET`, and any optional keys you use).

---

## License

**MIT** — see [LICENSE](LICENSE).

---

<div align="center">

**Vanta Labs**  
Synacwave · +2348132803772 · [t.me/GREAT_EXPECTATIONS](https://t.me/GREAT_EXPECTATIONS)

</div>
