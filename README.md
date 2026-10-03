<div align="center">

# Quantix Connect

**Real-time messaging platform built for speed, clarity, and presence.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%20Local-47A248.svg)](https://www.mongodb.com/)

*Property of Vanta Labs · by Expectations Himself · Synacwave*

</div>

---

## Overview

**Quantix Connect** is a full-stack chat application with:

- User registration & login (JWT)
- Direct messages and group chats
- Message history and last-message previews
- Modern dark UI with intro splash and responsive layout
- Express API + MongoDB backend, React + Vite frontend

| Layer | Stack |
|-------|--------|
| **Client** | React 18, Vite, React Router, Axios, Framer Motion |
| **Server** | Node.js, Express, Mongoose, JWT, bcrypt, Socket.IO (ready) |
| **Database** | MongoDB |

---

## Project structure

```text
Quantix-Connect/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Auth, chat, layout, modals, intro
│   │   ├── context/        # AuthContext
│   │   ├── pages/          # AuthPage, HomePage, LoginPage
│   │   ├── services/       # API, auth, chat, message services
│   │   └── styles/
│   └── package.json
├── server/                 # Express API
│   ├── src/
│   │   ├── config/         # MongoDB connection
│   │   ├── controllers/    # Auth, chat, message
│   │   ├── middleware/     # JWT auth
│   │   ├── models/         # User, Chat, Message
│   │   ├── routes/
│   │   └── server.js
│   └── package.json
├── index.js                # Root entry / helper
├── package.json            # Root scripts (run both apps)
├── LICENSE                 # MIT
└── README.md
```

---

## Quick start

### Prerequisites

- **Node.js** 18+
- **MongoDB** (local or Atlas)
- npm or yarn

### 1. Clone & install

```bash
git clone https://github.com/Synacwave/Quantix-Connect.git
cd Quantix-Connect

# Install root + both packages
npm install
npm run install:all
```

### 2. Environment variables

**Server** — create `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/quantix-connect
JWT_SECRET=your_strong_secret_here
CLIENT_URL=http://localhost:5173
```

**Client** — `client/.env` (already present for local):

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Run development servers

From the **project root**:

```bash
npm run dev
```

This starts:

- **API** → [http://localhost:5000](http://localhost:5000)
- **Client** → [http://localhost:5173](http://localhost:5173)

Or run them separately:

```bash
npm run dev:server   # API only
npm run dev:client   # Vite only
```

### 4. Production API

```bash
npm start
```

---

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register (fullName, username, email, password) |
| `POST` | `/api/auth/login` | Login (emailOrUsername, password) |
| `GET`  | `/api/auth/me` | Current user (Bearer token) |
| `GET`  | `/api/chats` | List user chats |
| `POST` | `/api/chats` | Create DM or group |
| `GET`  | `/api/messages/:chatId` | Messages for a chat |
| `POST` | `/api/messages/:chatId` | Send message |

Protected routes require:

```http
Authorization: Bearer <jwt>
```

---

## Features

- **Auth** — Register / login with JWT; password hashing via bcrypt
- **Chats** — DMs and groups; participants, admins, last message
- **Messages** — Persist and load conversation history
- **UI** — Intro splash, auth screens, sidebar + chat window, new-chat modal, mobile-friendly layout
- **Design** — Dark theme, orbs/grid accents, Quantix branding

---

## Scripts reference

| Command | Action |
|---------|--------|
| `npm run install:all` | Install dependencies in `server/` and `client/` |
| `npm run dev` | Concurrent API + client (via `concurrently`) |
| `npm run dev:server` | Server only (`nodemon`) |
| `npm run dev:client` | Client only (`vite`) |
| `npm start` | Production server |
| `npm run build` | Build client for production |

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE).

---

<div align="center">

**Vanta Labs**  
Synacwave · +2348132803772 · [t.me/GREAT_EXPECTATIONS](https://t.me/GREAT_EXPECTATIONS)

*Built with focus. Shipped with intent.*

</div>
