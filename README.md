<div align="center">

# Just Quantix Connect

**Real-time messaging — dark theme, Socket.IO, Lucy AI companion.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

*Property of Vanta Labs · by Expectations Himself · Synacwave*

</div>

---

## Overview

**Just Quantix Connect** is a full-stack, Telegram-inspired chat app with:

- JWT auth, bcrypt passwords, rate limiting, Helmet CSP
- Direct chats, groups, reactions, polls, media, self-destruct messages
- Real-time updates via **Socket.IO**
- **Lucy** AI companion (keyless Omegatech API primary; optional Gemini via env)
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
git clone https://github.com/Synacwave/Just-Quantix-Connect.git
cd Just-Quantix-Connect
npm install
npm run dev
```

App runs on **http://localhost:3000**.

### Environment (optional)

Create `.env` at the project root:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=change_me_to_a_long_random_string
MONGODB_URI=               # empty = local JSON mode
GEMINI_API_KEY=            # optional Lucy fallback
TELEGRAM_BOT_TOKEN=        # optional report notifications
TELEGRAM_CHAT_ID=          # optional
BOOTSTRAP_ADMIN_USER=      # optional first admin username
BOOTSTRAP_ADMIN_PASS=      # optional first admin password
```

**Never commit real tokens or passwords.** Telegram and Gemini only run when env vars are set.

### Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server (tsx + Vite) |
| `npm run build` | Production client + server bundle |
| `npm start` | Run production server |
| `npm run lint` | Typecheck |

---

## Lucy AI

1. **Primary** — keyless Omegatech chat API (no API key in repo)
2. **Fallback** — Google Gemini when `GEMINI_API_KEY` is set in the environment

---

## Security notes

- Hardcoded Telegram bot tokens and admin passwords were **removed** from source.
- Configure secrets only via environment variables (Render / local `.env`).
- Rotate any token that was previously committed.

---

## Deploy (Render)

See `render.yaml`. Set `MONGODB_URI`, `JWT_SECRET`, and optional `GEMINI_API_KEY` / Telegram vars in the dashboard.

---

## License

**MIT** — see [LICENSE](LICENSE).

---

<div align="center">

**Vanta Labs**  
Synacwave · +2348132803772 · [t.me/GREAT_EXPECTATIONS](https://t.me/GREAT_EXPECTATIONS)

</div>
