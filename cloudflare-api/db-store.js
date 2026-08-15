import { AsyncLocalStorage } from "node:async_hooks";

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

export async function initializeDatabaseStore() {
  return true;
}

const CHUNK_SIZE = 1000000;

function splitChunks(text) {
  const chunks = [];

  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  return chunks.length ? chunks : [""];
}

async function ensureSchema(db) {
  await db
    .prepare("CREATE TABLE IF NOT EXISTS sheliva_state_chunks (state_key TEXT NOT NULL, chunk_index INTEGER NOT NULL, chunk_value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (state_key, chunk_index))")
    .run();
}

function parseDataImage(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;

  return {
    contentType: match[1],
    base64: match[2]
  };
}

function extensionFor(contentType) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif"
  };

  return map[String(contentType || "").toLowerCase()] || "img";
}

async function uploadDataImage(value, images) {
  const parsed = parseDataImage(value);

  if (!parsed || !images) return value;

  const binary = atob(parsed.base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const key =
    `products/${new Date().toISOString().slice(0, 10)}/` +
    `${crypto.randomUUID()}.${extensionFor(parsed.contentType)}`;

  await images.put(key, bytes, {
    httpMetadata: {
      contentType: parsed.contentType,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  return `/api/images/${key}`;
}

async function moveImagesToR2(value, images, seen = new WeakMap()) {
  if (typeof value === "string") {
    return uploadDataImage(value, images);
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);

    for (const item of value) {
      out.push(await moveImagesToR2(item, images, seen));
    }

    return out;
  }

  const out = {};
  seen.set(value, out);

  for (const [key, item] of Object.entries(value)) {
    out[key] = await moveImagesToR2(item, images, seen);
  }

  return out;
}

async function writeKey(store, key, value) {
  const cleanValue = await moveImagesToR2(value, store.images);
  const json = JSON.stringify(cleanValue ?? null);
  const chunks = splitChunks(json);

  const statements = [
    store.db
      .prepare("DELETE FROM sheliva_state_chunks WHERE state_key = ?")
      .bind(key)
  ];

  chunks.forEach((chunk, index) => {
    statements.push(
      store.db
        .prepare("INSERT INTO sheliva_state_chunks (state_key, chunk_index, chunk_value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")
        .bind(key, index, chunk)
    );
  });

  await store.db.batch(statements);
  return cleanValue;
}

async function loadAll(db) {
  const result = await db
    .prepare("SELECT state_key, chunk_index, chunk_value FROM sheliva_state_chunks ORDER BY state_key, chunk_index")
    .all();

  const grouped = new Map();

  for (const row of result.results || []) {
    if (!grouped.has(row.state_key)) {
      grouped.set(row.state_key, []);
    }

    grouped.get(row.state_key).push(String(row.chunk_value ?? ""));
  }

  const values = new Map();

  for (const [key, parts] of grouped.entries()) {
    try {
      values.set(key, JSON.parse(parts.join("")));
    } catch {
      values.set(key, null);
    }
  }

  return values;
}

async function seedMissing(store, existing) {
  for (const key of Object.keys(fileMap)) {
    if (existing.has(key)) continue;

    const value = Object.prototype.hasOwnProperty.call(defaults, key)
      ? clone(defaults[key])
      : [];

    const saved = await writeKey(store, key, value);
    existing.set(key, clone(saved));
  }
}

async function createRequestStore(workerEnv) {
  const db = workerEnv?.DB;
  const images = workerEnv?.IMAGES;

  if (!db) throw new Error("Cloudflare D1 DB binding eksik.");

  await ensureSchema(db);

  const store = {
    db,
    images,
    cache: new Map(),
    dirty: new Map()
  };

  const existing = await loadAll(db);
  await seedMissing(store, existing);

  for (const [key, file] of Object.entries(fileMap)) {
    const fallback = Object.prototype.hasOwnProperty.call(defaults, key)
      ? defaults[key]
      : [];

    const value =
      existing.has(key) && existing.get(key) != null
        ? existing.get(key)
        : fallback;

    store.cache.set(file, clone(value));
  }

  return store;
}

export async function withDatabaseRequest(workerEnv, task) {
  const store = await createRequestStore(workerEnv);

  return requestStore.run(store, async () => {
    try {
      return await task();
    } finally {
      await flushDatabaseWrites();
    }
  });
}

export function databaseRead(file, fallback = []) {
  const store = currentStore();

  if (!store.cache.has(file)) {
    store.cache.set(file, clone(fallback));
  }

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
    const saved = await writeKey(store, key, snapshot);

    const file = fileMap[key];
    if (file) {
      store.cache.set(file, clone(saved));
    }

    store.dirty.delete(key);
  }
}

export async function databaseHealth() {
  const store = currentStore();

  const result = await store.db
    .prepare("SELECT COUNT(DISTINCT state_key) AS keys, COUNT(*) AS chunks FROM sheliva_state_chunks")
    .first();

  return {
    ok: true,
    database: "cloudflare-d1",
    keys: Number(result?.keys || 0),
    chunks: Number(result?.chunks || 0),
    r2: store.images ? "connected" : "missing",
    serverTime: new Date().toISOString()
  };
}

export async function closeDatabase() {
  const store = requestStore.getStore();
  if (!store) return;

  await flushDatabaseWrites();
}