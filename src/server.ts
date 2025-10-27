import Koa from "koa";
import Router from "@koa/router";
import { loadAllData, DataStore } from "./dataLoader";
import { renderErrorHtml, renderResultHtml } from "./render";
import { computeSchedule } from "./schedule";
import { renderHomePage } from "./templates";

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
  const departTime = (ctx.query.departTime as string | undefined)?.trim();

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

  const result = computeSchedule(store, start, end, departTime);

  ctx.type = "text/html; charset=utf-8";
  ctx.body = renderResultHtml(result);
});

router.get("/", async (ctx) => {
  await ensureDataLoaded();
  
  ctx.type = "text/html; charset=utf-8";
  ctx.body = renderHomePage(store.allStationNames);
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
