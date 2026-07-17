# Quantix Connect

Quantix Connect is a lightweight, modern, and high-performance real-time messaging application. Built with a responsive **Midnight Cosmic** dark blue and black theme, and splendid Telegram-like transitions, it supports instant text messaging, presence awareness, read receipts, custom base64-driven file and photo attachments, and a native Web Audio recording module for voice message uploads.

---

## 🚀 Key Features

*   **Real-time Synchronization**: Powered by **Socket.IO** with presence awareness (online/offline status metrics) and pulsing live typing indicators.
*   **Splendid Micro-Animations**: Built with fluid `motion/react` layout transitions.
*   **Media Sharing**: Image sharing, generic file uploads, and native microphone voice message recording.
*   **Rich Chat Controls**: Pin chats to the top, delete messages dynamically, unread message counters, and cross-tab syncing.
*   **Flexible Hybrid DB Architecture**: Seamlessly runs in **Local JSON mode** out-of-the-box (no configuration needed for instant local/preview testing), and connects to a real **MongoDB Atlas** cluster simply by providing the `MONGODB_URI` environment secret.
*   **Advanced Security**: Encoded with JWT token auth, bcrypt password hashing, CORS protection, express-rate-limiting, and custom Helmet CSP headers.

---

## 🛠️ Tech Stack

*   **Frontend**: React, Tailwind CSS, Lucide icons, Motion (Framer Motion).
*   **Backend**: Node.js + Express, Socket.IO.
*   **Database**: MongoDB Atlas (with a resilient local JSON database fallback).
*   **Authentication**: JSON Web Tokens (JWT) & bcryptjs.

---

## ⚙️ Environment Configuration

Define the following keys inside your environment variables or in a `.env` file at the project root:

```env
# MongoDB Atlas connection string (Falls back to Local JSON DB if empty)
MONGODB_URI="your_mongodb_atlas_connection_string"

# Token signing secret
JWT_SECRET="quantix_connect_super_secret_key_1337"

# Environment
NODE_ENV="production"
PORT=3000
```

---

## 📋 Local Development & Compilation

To start the application locally in development mode:

```bash
# Install dependencies
npm install

# Start Express & Vite dev server (on port 3000)
npm run dev
```

To compile the application for production:

```bash
# Build Vite client assets and bundle server.ts with esbuild
npm run build

# Start production server
npm run start
```

---

## ☁️ Deployment Instructions for Render

Quantix Connect is fully configured and ready for direct deployment on **Render** (using the custom `render.yaml` specification)!

### Option 1: Automatic Blueprints (Recommended)
1. Push this repository to your **GitHub** account.
2. Log in to the **Render Dashboard** (https://dashboard.render.com).
3. Click **New** -> **Blueprint**.
4. Connect your GitHub repository. Render will automatically parse the `render.yaml` specification and configure the web service with all compilation scripts.
5. In the Render environment tab, configure your `MONGODB_URI` environment variable pointing to your MongoDB Atlas cluster.

### Option 2: Manual Web Service Setup
If you prefer configuring the Web Service manually:
1. Select **New** -> **Web Service**.
2. Connect your repository.
3. Configure settings:
   * **Language**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm run start`
   * **Plan**: `Free`
4. In the **Environment** tab, add:
   * `NODE_ENV`: `production`
   * `PORT`: `3000`
   * `JWT_SECRET`: Generate a safe random string.
   * `MONGODB_URI`: Your MongoDB connection string.
