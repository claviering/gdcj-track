import Koa from "koa";
import Router from "@koa/router";
import { loadAllData, DataStore } from "./dataLoader";
import { renderErrorHtml, renderResultHtml } from "./render";
import { computeSchedule } from "./schedule";

const app = new Koa();
const router = new Router();

let store: DataStore;

async function ensureDataLoaded() {
  if (!store) {
    const rootDir = process.cwd();
    store = await loadAllData(rootDir);
    console.log(`Loaded data: ${store.tracks.length} tracks, ${store.loadedTracks.size} files, ${store.allStationNames.size} stations.`);
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

  const result = computeSchedule(store, start, end);

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
