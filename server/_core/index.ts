import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Serve static web build (Expo export output)
  // Web build is in dist/client/, server build is in dist/server/
  const webBuildPath = path.resolve(process.cwd(), "dist", "client");
  const fallbackWebPath = path.resolve(process.cwd(), "dist");
  const staticPath = fs.existsSync(webBuildPath) ? webBuildPath : fallbackWebPath;

  // Only serve static files if index.html exists (avoid serving server JS as static)
  const indexHtmlPath = path.join(staticPath, "index.html");
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(staticPath, { index: false }));
    // SPA fallback: serve index.html for all non-API routes
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      // Skip serving .js files that are server bundles
      if (req.path === "/index.js" || req.path === "/server/index.js") return next();
      const filePath = path.join(staticPath, req.path);
      // Try exact file first, then .html, then index.html
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
      }
      const htmlPath = filePath.endsWith(".html") ? filePath : `${filePath}.html`;
      if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
      }
      res.sendFile(indexHtmlPath);
    });
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
