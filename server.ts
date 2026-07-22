import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

import { initializeSocket } from "./server/socket.js";
import apiRoutes from "./server/routes.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable trust proxy for reverse proxies (Nginx, Cloud Run, VPS)
app.set("trust proxy", 1);

// Security Middlewares
// Use custom helmet settings that allow loading external assets and inline scripts/styles
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https:", "http:", "wss:", "ws:", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "https:", "http:", "wss:", "ws:", "data:", "blob:"],
        fontSrc: ["'self'", "https:", "http:", "data:"],
        mediaSrc: ["'self'", "data:", "blob:", "https:", "http:"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large base64 attachments (images, voice, files)
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve Uploaded static files
const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

// Rate Limiter for security
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 mins
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", apiLimiter);

// Mount API routes
app.use("/api", apiRoutes);

// Setup Socket.IO Server
initializeSocket(server);

// Setup frontend serving based on environment
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, mount Vite dev server as middleware
    console.log("🛠️  Quantix Connect: Running in DEVELOPMENT mode, enabling Vite dev middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve built static assets
    console.log("🚀 Quantix Connect: Running in PRODUCTION mode, serving static files");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupFrontend().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✨ Quantix Connect is running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server:", err);
});
