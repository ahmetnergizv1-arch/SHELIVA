import pg from "pg";
import fs from "fs";
import { AsyncLocalStorage } from "node:async_hooks";

const { Client } = pg;
const requestStore = new AsyncLocalStorage();

let fileMap = {};
let defaults = {};

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

function currentStore() {
  const store = requestStore.getStore();
  if (!store) {
    throw new Error("Veritabani islemi request context disinda yapildi.");
  }
  return store;
}

export function configureDatabaseStore(files, defaultValues) {
  fileMap = { ...files };
  defaults = { ...defaultValues };
}

/*
  Eski Node sunucusunda başlangıçta çağrılıyordu.
  Worker'da gerçek bağlantı her HTTP isteğinin içinde açılır.
*/
export async function initializeDatabaseStore() {
  return true;
}

async function createRequestStore(connectionString) {
  if (!connectionString) throw new Error("DATABASE_URL eksik.");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
  });

  await client.connect();
  await client.query("SELECT 1");

  await client.query(`
    CREATE TABLE IF NOT EXISTS sheliva_state (
      state_key TEXT PRIMARY KEY,
      state_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existingResult = await client.query(
    "SELECT state_key, state_value FROM sheliva_state"
  );

  const existing = new Map(
    existingResult.rows.map(row => [row.state_key, row.state_value])
  );

  const cache = new Map();

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

    await client.query(
      `INSERT INTO sheliva_state(state_key, state_value, updated_at)
       VALUES($1, $2::jsonb, NOW())
       ON CONFLICT(state_key) DO NOTHING`,
      [key, JSON.stringify(seed)]
    );
  }

  return {
    client,
    cache,
    dirty: new Map()
  };
}

export async function withDatabaseRequest(connectionString, task) {
  const store = await createRequestStore(connectionString);

  return requestStore.run(store, async () => {
    try {
      return await task();
    } finally {
      try {
        await flushDatabaseWrites();
      } finally {
        await store.client.end().catch(() => {});
      }
    }
  });
}

export function databaseRead(file, fallback = []) {
  const store = currentStore();
  if (!store.cache.has(file)) store.cache.set(file, clone(fallback));
  return clone(store.cache.get(file));
}

export function databaseWrite(file, value) {
  const store = currentStore();
  const key = keyForFile(file);
  const snapshot = clone(value);

  store.cache.set(file, snapshot);
  store.dirty.set(key, snapshot);
}

export async function flushDatabaseWrites() {
  const store = currentStore();
  const entries = [...store.dirty.entries()];

  for (const [key, snapshot] of entries) {
    await store.client.query(
      `INSERT INTO sheliva_state(state_key, state_value, updated_at)
       VALUES($1, $2::jsonb, NOW())
       ON CONFLICT(state_key)
       DO UPDATE SET
         state_value = EXCLUDED.state_value,
         updated_at = NOW()`,
      [key, JSON.stringify(snapshot)]
    );

    store.dirty.delete(key);
  }
}

export async function databaseHealth() {
  const store = currentStore();

  const result = await store.client.query(
    "SELECT NOW() AS now, COUNT(*)::int AS keys FROM sheliva_state"
  );

  return {
    ok: true,
    database: "neon-postgresql",
    keys: result.rows[0].keys,
    serverTime: result.rows[0].now
  };
}

export async function closeDatabase() {
  const store = requestStore.getStore();
  if (!store) return;

  try {
    await flushDatabaseWrites();
  } finally {
    await store.client.end().catch(() => {});
  }
}