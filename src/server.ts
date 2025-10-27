import Koa from "koa";
import Router from "@koa/router";
import path from "path";
import fs from "fs/promises";
import { loadAllData, DataStore } from "./dataLoader";
import { renderErrorHtml, renderResultHtml } from "./render";
import { computeSchedule } from "./schedule";
import { CachedResult, QueryResult } from "./types";
import { fileKey, sanitizeFilename } from "./utils";

const app = new Koa();
const router = new Router();

let store: DataStore;
const resultCache = new Map<string, QueryResult>();
const CACHE_DIR_NAME = "cache";

async function ensureDataLoaded() {
  if (!store) {
    const rootDir = process.cwd();
    store = await loadAllData(rootDir);
    console.log(`Loaded data: ${store.tracks.length} tracks, ${store.loadedTracks.size} files, ${store.allStationNames.size} stations.`);
    // Ensure cache directory exists
    try {
      await fs.mkdir(path.join(rootDir, CACHE_DIR_NAME), { recursive: true });
    } catch {}
  }
}

async function loadFromFileCache(start: string, end: string): Promise<QueryResult | null> {
  const key = fileKey(start, end);
  const fname = `${sanitizeFilename(key)}-schedule.json`;
  const fpath = path.join(store.rootDir, CACHE_DIR_NAME, fname);
  try {
    const raw = await fs.readFile(fpath, "utf8");
    const obj: CachedResult = JSON.parse(raw);
    return obj;
  } catch {
    return null;
  }
}

async function saveToFileCache(result: QueryResult): Promise<void> {
  const key = fileKey(result.start, result.end);
  const fname = `${sanitizeFilename(key)}-schedule.json`;
  const fpath = path.join(store.rootDir, CACHE_DIR_NAME, fname);
  // Write compact JSON to reduce size; wrap in try/catch to avoid crashing on rare stringify issues
  try {
    const serialized = JSON.stringify(result);
    await fs.writeFile(fpath, serialized, "utf8");
  } catch (e) {
    // Fallback: write a trimmed summary
    const summary = {
      start: result.start,
      end: result.end,
      generatedAt: result.generatedAt,
      directCount: result.direct.length,
      transferCount: result.transfers.length,
      direct: result.direct.slice(0, 50),
      transfers: result.transfers.slice(0, 50),
    };
    await fs.writeFile(fpath, JSON.stringify(summary), "utf8");
  }
}

router.get("/train-schedule", async (ctx) => {
  await ensureDataLoaded();

  const start = (ctx.query.start as string | undefined)?.trim();
  const end = (ctx.query.end as string | undefined)?.trim();

  if (!start || !end) {
    ctx.status = 400;
    ctx.body = renderErrorHtml("Missing query parameters: start and end");
    return;
  }
  if (start === end) {
    ctx.status = 400;
    ctx.body = renderErrorHtml("Start and end stations cannot be the same.");
    return;
  }

  if (!store.allStationNames.has(start) || !store.allStationNames.has(end)) {
    ctx.status = 400;
    ctx.body = renderErrorHtml("One or both stations not found in the system.");
    return;
  }

  const key = fileKey(start, end);
  let result = resultCache.get(key);
  if (!result) {
    // Try file cache
    const cached = await loadFromFileCache(start, end);
    if (cached) {
      result = cached;
      resultCache.set(key, result);
    } else {
      // Compute and cache
      result = computeSchedule(store, start, end);
      resultCache.set(key, result);
      await saveToFileCache(result);
    }
  }

  ctx.type = "text/html; charset=utf-8";
  ctx.body = renderResultHtml(result);
});

router.get("/", async (ctx) => {
  await ensureDataLoaded();
  ctx.type = "text/html; charset=utf-8";
  ctx.body = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>列车时刻查询</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50">
  <div class="max-w-xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">列车时刻查询</h1>
    <form action="/train-schedule" method="get" class="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow">
      <div>
        <label class="block text-sm text-gray-600 mb-1">起点站</label>
        <input name="start" class="w-full border rounded px-3 py-2" placeholder="如：惠州北" />
      </div>
      <div>
        <label class="block text-sm text-gray-600 mb-1">终点站</label>
        <input name="end" class="w-full border rounded px-3 py-2" placeholder="如：肇庆" />
      </div>
      <button class="w-full bg-blue-600 text-white rounded px-3 py-2">查询</button>
    </form>
    <p class="text-xs text-gray-500 mt-3">已支持的站点：${[...store.allStationNames].join("、")}</p>
  </div>
</body>
</html>`;
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
