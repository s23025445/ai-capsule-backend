import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { initializeDatabase } from "./db/database.js";
import authenticate from "./middleware/authenticate.js";
import authRoutes from "./routes/auth.js";
import capsuleRoutes from "./routes/capsules.js";

initializeDatabase();

const app = express();
const port = process.env.PORT || 3001;

// For hosting. This lets secure cookies work there.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "AI Capsule API" });
});

// Keep this public so the cloud service can be checked without logging in.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(authRoutes);
app.use("/api/capsules", authenticate, capsuleRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);

  const status = error.status || 500;
  const message =
    status === 500 ? "Something went wrong on the server" : error.message;

  res.status(status).json({ error: message });
});

// Tests import the app without opening a port. Running this file starts the server normally.
const isMainFile =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainFile) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
