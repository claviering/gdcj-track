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
  const stationsJson = JSON.stringify([...store.allStationNames].sort());
  
  ctx.type = "text/html; charset=utf-8";
  ctx.body = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>列车时刻查询</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .station-dropdown {
      max-height: 200px;
      overflow-y: auto;
    }
    .station-option {
      cursor: pointer;
      padding: 0.5rem 0.75rem;
    }
    .station-option:hover {
      background-color: #f3f4f6;
    }
  </style>
</head>
<body class="min-h-screen bg-gray-50">
  <div class="max-w-xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">列车时刻查询</h1>
    <form action="/train-schedule" method="get" class="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow">
      <div class="relative">
        <label class="block text-sm text-gray-600 mb-1">起点站</label>
        <input type="text" id="startInput" name="start" autocomplete="off" class="w-full border rounded px-3 py-2" placeholder="请选择或输入起点站" required />
        <div id="startDropdown" class="hidden absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg station-dropdown"></div>
      </div>
      <div class="relative">
        <label class="block text-sm text-gray-600 mb-1">终点站</label>
        <input type="text" id="endInput" name="end" autocomplete="off" class="w-full border rounded px-3 py-2" placeholder="请选择或输入终点站" required />
        <div id="endDropdown" class="hidden absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg station-dropdown"></div>
      </div>
      <div>
        <label class="block text-sm text-gray-600 mb-1">出发时间（可选）</label>
        <input type="time" name="departTime" class="w-full border rounded px-3 py-2" placeholder="如：09:00" />
        <p class="text-xs text-gray-500 mt-1">留空表示查询全天班次；填写时间则查询最接近该时间的班次</p>
      </div>
      <button type="submit" class="w-full bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700">查询</button>
    </form>
    <p class="text-xs text-gray-500 mt-3">系统已支持 ${store.allStationNames.size} 个站点</p>
  </div>

  <script>
    const stations = ${stationsJson};
    
    function setupStationInput(inputId, dropdownId) {
      const input = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      
      input.addEventListener('focus', function() {
        filterAndShowDropdown(this.value, dropdown);
      });
      
      input.addEventListener('input', function() {
        filterAndShowDropdown(this.value, dropdown);
      });
      
      input.addEventListener('blur', function() {
        setTimeout(() => dropdown.classList.add('hidden'), 200);
      });
      
      function filterAndShowDropdown(query, dropdown) {
        const filtered = query 
          ? stations.filter(s => s.includes(query))
          : stations;
        
        if (filtered.length === 0) {
          dropdown.classList.add('hidden');
          return;
        }
        
        dropdown.innerHTML = filtered.slice(0, 50).map(station => 
          \`<div class="station-option" data-station="\${station}">\${station}</div>\`
        ).join('');
        
        dropdown.querySelectorAll('.station-option').forEach(option => {
          option.addEventListener('mousedown', function(e) {
            e.preventDefault();
            input.value = this.dataset.station;
            dropdown.classList.add('hidden');
          });
        });
        
        dropdown.classList.remove('hidden');
      }
    }
    
    setupStationInput('startInput', 'startDropdown');
    setupStationInput('endInput', 'endDropdown');
  </script>
</body>
</html>`;
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
