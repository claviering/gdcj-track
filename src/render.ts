import { QueryResult, TransferLeg } from "./types";
import { formatDuration } from "./utils";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderResultHtml(q: QueryResult): string {
  // Merge all solutions and sort by arrival time
  type Solution = {
    type: 'direct' | 'transfer';
    data: any;
    arriveTime: string;
    departTime: string;
    totalMinutes: number;
    firstDurationMinutes: number;
  };
  
  const allSolutions: Solution[] = [
    ...q.direct.map(d => ({
      type: 'direct' as const,
      data: d,
      arriveTime: d.arriveTime,
      departTime: d.departTime,
      totalMinutes: d.durationMinutes,
      firstDurationMinutes: d.durationMinutes,
    })),
    ...q.transfers.map(t => ({
      type: 'transfer' as const,
      data: t,
      arriveTime: t.legs[t.legs.length - 1].arriveTime,
      departTime: t.legs[0].departTime,
      totalMinutes: t.totalMinutes,
      firstDurationMinutes: t.legs[0]?.durationMinutes ?? t.totalMinutes,
    }))
  ];

  // Parse time to minutes for sorting
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  allSolutions.sort((a, b) => {
    const arriveA = parseTime(a.arriveTime);
    const arriveB = parseTime(b.arriveTime);
    if (arriveA !== arriveB) return arriveA - arriveB;
    if (a.firstDurationMinutes !== b.firstDurationMinutes) {
      return a.firstDurationMinutes - b.firstDurationMinutes;
    }
    return a.totalMinutes - b.totalMinutes;
  });

  const solutionCards = allSolutions.map((sol, idx) => {
    if (sol.type === 'direct') {
      const d = sol.data;
      return `
      <div class="bg-white rounded-xl shadow p-4 md:p-5 border border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold">${escapeHtml(d.trainName)}</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 rounded bg-green-50 text-green-700">直达</span>
            <span class="text-xs text-gray-500">${escapeHtml(d.dateLabel)}</span>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-sm md:text-base">
          <div class="text-gray-900 font-medium">${escapeHtml(d.departTime)}</div>
          <div class="text-center text-gray-500">用时 ${formatDuration(d.durationMinutes)}</div>
          <div class="text-right text-gray-900 font-medium">${escapeHtml(d.arriveTime)}</div>
          <div class="text-gray-600">${escapeHtml(d.startStation)}</div>
          <div></div>
          <div class="text-right text-gray-600">${escapeHtml(d.endStation)}</div>
        </div>
      </div>`;
    } else {
      const t = sol.data;
      
      // Build leg cards for each leg in the journey
      const legCards = t.legs.map((leg: TransferLeg, legIdx: number) => {
        const isLastLeg = legIdx === t.legs.length - 1;
        return `
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between mb-1">
              <div class="font-medium">${escapeHtml(leg.trainName)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm md:text-base">
              <div class="text-gray-900 font-medium">${escapeHtml(leg.departTime)}</div>
              <div class="text-center text-gray-500">用时 ${formatDuration(leg.durationMinutes)}</div>
              <div class="text-right text-gray-900 font-medium">${escapeHtml(leg.arriveTime)}</div>
              <div class="text-gray-600">${escapeHtml(leg.fromStation)}</div>
              <div></div>
              <div class="text-right text-gray-600">${escapeHtml(leg.toStation)}</div>
            </div>
          </div>
          ${!isLastLeg ? `<div class="text-center text-xs text-amber-700">在 ${escapeHtml(t.transferStations[legIdx])} 中转时间 ${formatDuration(t.waitMinutes[legIdx])}</div>` : ''}
        `;
      }).join('\n');
      
      const transferCount = t.transferStations.length;
      const transferLabel = transferCount === 1 ? '中转' : `${transferCount}次中转`;
      
      return `
      <div class="bg-white rounded-xl shadow p-4 md:p-5 border border-gray-100 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">方案 ${idx + 1}</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">${transferLabel} · 总用时 ${formatDuration(t.totalMinutes)}</span>
            <span class="text-xs text-gray-500">${escapeHtml(t.dateLabel)}</span>
          </div>
        </div>
        <div class="grid gap-3">
          ${legCards}
        </div>
      </div>`;
    }
  }).join("\n");

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
        <h2 class="text-lg font-semibold">最佳方案 <span class="text-sm font-normal text-gray-500">共 ${allSolutions.length} 个方案 (按到达时间排序)</span></h2>
        ${allSolutions.length > 0 ? `<div class=\"grid gap-3\">${solutionCards}</div>` : `<div class=\"text-gray-500 text-sm\">暂无可用方案</div>`}
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

export function renderErrorHtml(message: string): string {
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
