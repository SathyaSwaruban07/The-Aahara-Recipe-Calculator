import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDbAvailable } from "./db/pool.js";
import { recipesRouter } from "./routes/recipes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express();
const port = Number(process.env.PORT) || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: [clientOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const db = await isDbAvailable();
  res.json({
    ok: true,
    dbConnected: db,
    storage: db ? "neon-postgres" : "unavailable",
    libreTranslate: process.env.LIBRETRANSLATE_URL || "https://libretranslate.com",
  });
});

app.use("/api/recipes", recipesRouter);

/** After `npm run build`, serve the Vite client so one process is a full web app. */
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`Serving UI from ${clientDist}`);
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS origin: ${clientOrigin}`);
  if (fs.existsSync(clientDist)) {
    console.log(`Web app: http://localhost:${port}`);
  }
});
