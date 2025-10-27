"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderResultHtml = renderResultHtml;
exports.renderErrorHtml = renderErrorHtml;
const utils_1 = require("./utils");
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function renderResultHtml(q) {
    const hasDirect = q.direct.length > 0;
    const hasTransfer = q.transfers.length > 0;
    const directCards = q.direct
        .map((d) => `
      <div class="bg-white rounded-xl shadow p-4 md:p-5 border border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold">${escapeHtml(d.trainName)}</h3>
          <span class="text-xs text-gray-500">${escapeHtml(d.dateLabel)}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-sm md:text-base">
          <div class="text-gray-900 font-medium">${escapeHtml(d.departTime)}</div>
          <div class="text-center text-gray-500">用时 ${(0, utils_1.formatDuration)(d.durationMinutes)}</div>
          <div class="text-right text-gray-900 font-medium">${escapeHtml(d.arriveTime)}</div>
          <div class="text-gray-600">${escapeHtml(d.startStation)}</div>
          <div></div>
          <div class="text-right text-gray-600">${escapeHtml(d.endStation)}</div>
        </div>
      </div>`)
        .join("\n");
    const transferBlocks = q.transfers
        .map((t, idx) => {
        return `
      <div class="bg-white rounded-xl shadow p-4 md:p-5 border border-gray-100 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">方案 ${idx + 1}</h3>
          <span class="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">总用时 ${(0, utils_1.formatDuration)(t.totalMinutes)}</span>
        </div>
        <div class="grid gap-3">
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between mb-1">
              <div class="font-medium">${escapeHtml(t.leg1.trainName)}</div>
              <div class="text-xs text-gray-500">${escapeHtml(t.dateLabel)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm md:text-base">
              <div class="text-gray-900 font-medium">${escapeHtml(t.leg1.departTime)}</div>
              <div class="text-center text-gray-500">用时 ${(0, utils_1.formatDuration)(t.leg1.durationMinutes)}</div>
              <div class="text-right text-gray-900 font-medium">${escapeHtml(t.leg1.arriveTime)}</div>
              <div class="text-gray-600">${escapeHtml(t.leg1.fromStation)}</div>
              <div></div>
              <div class="text-right text-gray-600">${escapeHtml(t.leg1.toStation)}</div>
            </div>
          </div>

          <div class="text-center text-xs text-amber-700">在 ${escapeHtml(t.transferStation)} 中转时间 ${(0, utils_1.formatDuration)(t.waitMinutes)}</div>

          <div class="rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between mb-1">
              <div class="font-medium">${escapeHtml(t.leg2.trainName)}</div>
              <div class="text-xs text-gray-500">${escapeHtml(t.dateLabel)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm md:text-base">
              <div class="text-gray-900 font-medium">${escapeHtml(t.leg2.departTime)}</div>
              <div class="text-center text-gray-500">用时 ${(0, utils_1.formatDuration)(t.leg2.durationMinutes)}</div>
              <div class="text-right text-gray-900 font-medium">${escapeHtml(t.leg2.arriveTime)}</div>
              <div class="text-gray-600">${escapeHtml(t.leg2.fromStation)}</div>
              <div></div>
              <div class="text-right text-gray-600">${escapeHtml(t.leg2.toStation)}</div>
            </div>
          </div>
        </div>
      </div>`;
    })
        .join("\n");
    const body = `
  <div class="min-h-screen bg-gray-50">
    <header class="py-4 md:py-6 bg-white border-b border-gray-100">
      <div class="container mx-auto px-4">
        <h1 class="text-xl md:text-2xl font-bold">列车时刻查询</h1>
        <p class="text-sm text-gray-500 mt-1">${escapeHtml(q.start)} → ${escapeHtml(q.end)}</p>
      </div>
    </header>

    <main class="container mx-auto px-4 py-4 md:py-6 space-y-6">
      <section class="space-y-3">
        <h2 class="text-lg font-semibold">直达列车 <span class="text-sm font-normal text-gray-500">共 ${q.direct.length} 趟</span></h2>
        ${hasDirect ? `<div class=\"grid gap-3 md:grid-cols-2\">${directCards}</div>` : `<div class=\"text-gray-500 text-sm\">暂无直达</div>`}
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-semibold">中转方案 <span class="text-sm font-normal text-gray-500">共 ${q.transfers.length} 趟</span></h2>
        ${hasTransfer ? `<div class=\"grid gap-3\">${transferBlocks}</div>` : `<div class=\"text-gray-500 text-sm\">暂无中转方案</div>`}
      </section>
    </main>
  </div>`;
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(q.start)} 到 ${escapeHtml(q.end)} 列车时刻</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>${body}</body>
</html>`;
}
function renderErrorHtml(message) {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>查询错误</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div class="max-w-md w-full bg-white border border-gray-100 rounded-xl shadow p-6">
      <h1 class="text-xl font-semibold mb-2">无法完成查询</h1>
      <p class="text-gray-600">${message}</p>
    </div>
  </div>
</body>
</html>`;
}
