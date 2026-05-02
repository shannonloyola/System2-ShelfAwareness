import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, "../../.cache");
const cachePath = path.join(cacheDir, "supplier-scorecards.json");

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

    throw error;
  }
};

export const getFileCachedScorecard = async (supplierKey) => {
  const cache = await readFileCache();
  return cache[supplierKey] ?? null;
};

export const writeFileCachedScorecard = async (scorecard) => {
  await ensureCacheDir();
  const cache = await readFileCache();
  cache[scorecard.supplier_key] = scorecard;
  await fs.writeFile(
    cachePath,
    JSON.stringify(cache, null, 2),
    "utf8",
  );
  return scorecard;
};

export const writeAllFileCachedScorecards = async (scorecards) => {
  await ensureCacheDir();
  const payload = Object.fromEntries(
    scorecards.map((scorecard) => [scorecard.supplier_key, scorecard]),
  );
  await fs.writeFile(
    cachePath,
    JSON.stringify(payload, null, 2),
    "utf8",
  );
};
