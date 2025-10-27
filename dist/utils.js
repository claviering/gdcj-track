"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHHmmToMinutes = parseHHmmToMinutes;
exports.minutesToHHmm = minutesToHHmm;
exports.formatDuration = formatDuration;
exports.todayMonthDayLabel = todayMonthDayLabel;
function parseHHmmToMinutes(hhmm) {
    const [hh, mm] = hhmm.split(":").map((v) => parseInt(v, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm))
        return NaN;
    return hh * 60 + mm;
}
function minutesToHHmm(mins) {
    const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = Math.floor(m / 60)
        .toString()
        .padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
}
function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0)
        return `${h}h${m}m`;
    if (h > 0)
        return `${h}h0m`;
    return `${m}m`;
}
function todayMonthDayLabel(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
}
