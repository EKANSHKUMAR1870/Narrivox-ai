import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const defaultDbPath = join(dataDir, "db.json");
const mongoUri = process.env.MONGODB_URI || "";
const mongoDbName = process.env.MONGODB_DB_NAME || "narrivox_ai";

const DEFAULT_DB = {
  users: [],
  scripts: []
};

let mongoClientPromise = null;

function isMongoConfigured() {
  return Boolean(mongoUri);
}

async function ensureDbFile(dbPath) {
  await mkdir(dirname(dbPath), { recursive: true });

  try {
    await readFile(dbPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await writeFile(dbPath, JSON.stringify(DEFAULT_DB, null, 2));
      return;
    }

    throw error;
  }
}

async function readFileDatabase(dbPath = defaultDbPath) {
  await ensureDbFile(dbPath);
  const raw = await readFile(dbPath, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      scripts: Array.isArray(parsed.scripts) ? parsed.scripts : []
    };
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

async function writeFileDatabase(db, dbPath = defaultDbPath) {
  await ensureDbFile(dbPath);
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

async function updateFileDatabase(updater, dbPath = defaultDbPath) {
  const current = await readFileDatabase(dbPath);
  const next = await updater(current);
  await writeFileDatabase(next, dbPath);
  return next;
}

async function getMongoDb() {
  if (!isMongoConfigured()) {
    return null;
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(mongoUri);
    mongoClientPromise = client.connect();
  }

  const client = await mongoClientPromise;
  return client.db(mongoDbName);
}

function sanitizeMongoDocument(document) {
  if (!document) {
    return null;
  }

  const { _id, ...rest } = document;
  return rest;
}

export async function findUserByEmail(email) {
  if (!isMongoConfigured()) {
    const db = await readFileDatabase();
    return db.users.find((user) => user.email === email) || null;
  }

  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ email });
  return sanitizeMongoDocument(user);
}

export async function findUserById(id) {
  if (!isMongoConfigured()) {
    const db = await readFileDatabase();
    return db.users.find((user) => user.id === id) || null;
  }

  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ id });
  return sanitizeMongoDocument(user);
}

export async function findUserBySessionToken(token) {
  if (!isMongoConfigured()) {
    const db = await readFileDatabase();
    return db.users.find((user) => (user.sessions || []).some((session) => session.token === token)) || null;
  }

  const db = await getMongoDb();
  const user = await db.collection("users").findOne({
    "sessions.token": token
  });
  return sanitizeMongoDocument(user);
}

export async function createUser(user) {
  if (!isMongoConfigured()) {
    await updateFileDatabase((current) => ({
      ...current,
      users: [...current.users, user]
    }));
    return user;
  }

  const db = await getMongoDb();
  await db.collection("users").insertOne(user);
  return user;
}

export async function replaceUserSessions(userId, sessions) {
  if (!isMongoConfigured()) {
    await updateFileDatabase((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId ? { ...user, sessions } : user
      )
    }));
    return;
  }

  const db = await getMongoDb();
  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        sessions
      }
    }
  );
}

export async function listScriptsByUserId(userId, limit = 30) {
  if (!isMongoConfigured()) {
    const db = await readFileDatabase();
    return db.scripts
      .filter((script) => script.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit);
  }

  const db = await getMongoDb();
  const scripts = await db
    .collection("scripts")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return scripts.map(sanitizeMongoDocument);
}

export async function findScriptById(scriptId, userId) {
  if (!isMongoConfigured()) {
    const db = await readFileDatabase();
    return (
      db.scripts.find((script) => script.id === scriptId && script.userId === userId) || null
    );
  }

  const db = await getMongoDb();
  const script = await db.collection("scripts").findOne({
    id: scriptId,
    userId
  });
  return sanitizeMongoDocument(script);
}

export async function createScriptRecord(script) {
  if (!isMongoConfigured()) {
    await updateFileDatabase((current) => ({
      ...current,
      scripts: [script, ...current.scripts].slice(0, 300)
    }));
    return script;
  }

  const db = await getMongoDb();
  await db.collection("scripts").insertOne(script);
  return script;
}

export async function updateScriptThumbnail(scriptId, userId, thumbnail) {
  if (!isMongoConfigured()) {
    await updateFileDatabase((current) => ({
      ...current,
      scripts: current.scripts.map((script) =>
        script.id === scriptId && script.userId === userId
          ? { ...script, thumbnail }
          : script
      )
    }));
    return;
  }

  const db = await getMongoDb();
  await db.collection("scripts").updateOne(
    {
      id: scriptId,
      userId
    },
    {
      $set: {
        thumbnail
      }
    }
  );
}

export async function deleteScriptRecord(scriptId, userId) {
  if (!isMongoConfigured()) {
    await updateFileDatabase((current) => ({
      ...current,
      scripts: current.scripts.filter(
        (script) => !(script.id === scriptId && script.userId === userId)
      )
    }));
    return;
  }

  const db = await getMongoDb();
  await db.collection("scripts").deleteOne({
    id: scriptId,
    userId
  });
}

export { defaultDbPath, isMongoConfigured, mongoDbName };
