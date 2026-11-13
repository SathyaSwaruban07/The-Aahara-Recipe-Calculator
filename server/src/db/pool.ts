import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/db or server/dist/db → repo root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const { Pool } = pg;

let pool: pg.Pool | null = null;

function connectionConfig(url: string): pg.PoolConfig {
  const isNeon = url.includes("neon.tech") || url.includes("sslmode=require");

  // Avoid pg treating sslmode=require as verify-full (breaks Neon on some Node versions)
  let connectionString = url
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/([?&])channel_binding=[^&]*/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");

  return {
    connectionString,
    ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  };
}

export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new Pool(connectionConfig(url));
  }
  return pool;
}

export async function isDbAvailable(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
