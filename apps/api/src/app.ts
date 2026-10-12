import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { isProd } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { ok } from "./lib/http.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many attempts, try again later" },
  });

  app.get("/health", (_req, res) => {
    res.json(ok({ status: "ok", uptime: process.uptime() }));
  });

  app.use("/api/auth", loginLimiter);
  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log("[api] running in development mode");
  }

  return app;
}
