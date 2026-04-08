const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "store.json");

const defaultStore = {
  users: [
    {
      id: 1,
      email: process.env.OWNER_EMAIL || "owner@jewelmanage.com",
      password: process.env.OWNER_PASSWORD || "admin123",
      name: "Owner"
    }
  ],
  products: [],
  customers: [],
  purchases: [],
  recommendationHistory: []
};

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(defaultStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...defaultStore,
    ...parsed
  };
}

function writeStore(nextStore) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(nextStore, null, 2));
}

function nextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

module.exports = {
  readStore,
  writeStore,
  nextId
};
