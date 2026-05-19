import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, "../../.cache");
const cachePath = path.join(cacheDir, "supplier-scorecards.json");
let cacheWriteQueue = Promise.resolve();

const ensureCacheDir = async () => {
  await fs.mkdir(cacheDir, { recursive: true });
};

export const readFileCache = async () => {
  try {
    const content = await fs.readFile(cachePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }

    if (error instanceof SyntaxError) {
      console.warn("Supplier scorecard cache is invalid JSON; rebuilding cache.");
      return {};
    }

    throw error;
  }
};

export const getFileCachedScorecard = async (supplierKey) => {
  const cache = await readFileCache();
  return cache[supplierKey] ?? null;
};

const writeJsonCache = async (payload) => {
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(
    tempPath,
    JSON.stringify(payload, null, 2),
    "utf8",
  );
  await fs.rename(tempPath, cachePath);
};

const queueCacheWrite = (task) => {
  const next = cacheWriteQueue.then(task, task);
  cacheWriteQueue = next.catch(() => {});
  return next;
};

export const writeFileCachedScorecard = async (scorecard) => {
  await queueCacheWrite(async () => {
    await ensureCacheDir();
    const cache = await readFileCache();
    cache[scorecard.supplier_key] = scorecard;
    await writeJsonCache(cache);
  });
  return scorecard;
};

export const writeAllFileCachedScorecards = async (
  scorecards,
) => {
  await queueCacheWrite(async () => {
    await ensureCacheDir();
    const payload = Object.fromEntries(
      scorecards.map((scorecard) => [
        scorecard.supplier_key,
        scorecard,
      ]),
    );
    await writeJsonCache(payload);
  });
};
