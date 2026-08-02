import pg from "pg";
import fs from "fs";

const { Pool } = pg;

let pool = null;
let fileMap = {};
let defaults = {};
const cache = new Map();
let writeQueue = Promise.resolve();
let initialized = false;

const clone = value =>
  value == null ? value : JSON.parse(JSON.stringify(value));

function keyForFile(file) {
  const found = Object.entries(fileMap).find(([, full]) => full === file);
  if (!found) throw new Error(`Bilinmeyen veri anahtari: ${file}`);
  return found[0];
}

function readLocal(file, fallback) {
  try {
    if (!fs.existsSync(file)) return clone(fallback);
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return clone(fallback);
    return JSON.parse(raw);
  } catch {
    return clone(fallback);
  }
}

export function configureDatabaseStore(files, defaultValues) {
  fileMap = { ...files };
  defaults = { ...defaultValues };
}

export async function initializeDatabaseStore() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL eksik.");
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000
  });

  await pool.query("SELECT 1");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sheliva_state (
      state_key TEXT PRIMARY KEY,
      state_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existingResult = await pool.query(
    "SELECT state_key, state_value FROM sheliva_state"
  );

  const existing = new Map(
    existingResult.rows.map(row => [row.state_key, row.state_value])
  );

  for (const [key, file] of Object.entries(fileMap)) {
    if (existing.has(key)) {
      cache.set(file, clone(existing.get(key)));
      continue;
    }

    const fallback = Object.prototype.hasOwnProperty.call(defaults, key)
      ? defaults[key]
      : [];

    const seed = readLocal(file, fallback);
    cache.set(file, clone(seed));

    await pool.query(
      `INSERT INTO sheliva_state(state_key, state_value, updated_at)
       VALUES($1, $2::jsonb, NOW())
       ON CONFLICT(state_key) DO NOTHING`,
      [key, JSON.stringify(seed)]
    );
  }

  initialized = true;
  console.log("NEON POSTGRESQL BAGLANDI - KALICI VERI AKTIF");
}

export function databaseRead(file, fallback = []) {
  if (!initialized) return readLocal(file, fallback);
  if (!cache.has(file)) cache.set(file, clone(fallback));
  return clone(cache.get(file));
}

export function databaseWrite(file, value) {
  const key = keyForFile(file);
  const snapshot = clone(value);

  cache.set(file, snapshot);

  writeQueue = writeQueue
    .then(() =>
      pool.query(
        `INSERT INTO sheliva_state(state_key, state_value, updated_at)
         VALUES($1, $2::jsonb, NOW())
         ON CONFLICT(state_key)
         DO UPDATE SET
           state_value = EXCLUDED.state_value,
           updated_at = NOW()`,
        [key, JSON.stringify(snapshot)]
      )
    )
    .catch(error => {
      console.error(`POSTGRESQL YAZMA HATASI [${key}]:`, error?.message || error);
    });
}

export async function flushDatabaseWrites() {
  await writeQueue;
}

export async function databaseHealth() {
  if (!pool || !initialized) return { ok:false, database:"not-ready" };

  const result = await pool.query(
    "SELECT NOW() AS now, COUNT(*)::int AS keys FROM sheliva_state"
  );

  return {
    ok:true,
    database:"neon-postgresql",
    keys:result.rows[0].keys,
    serverTime:result.rows[0].now
  };
}

export async function closeDatabase() {
  try {
    await flushDatabaseWrites();
  } finally {
    if (pool) await pool.end();
  }
}