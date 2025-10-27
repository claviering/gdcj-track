"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAllData = loadAllData;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
async function loadAllData(rootDir) {
    // Load SingleCityTrack.json
    // Data files are now under the "data" directory at repo root
    const singleCityPath = path_1.default.join(rootDir, "data", "SingleCityTrack.json");
    const singleRaw = await promises_1.default.readFile(singleCityPath, "utf8");
    const single = JSON.parse(singleRaw);
    const tracks = [];
    for (const entry of single.body) {
        for (const item of entry.list) {
            tracks.push({
                cityTrackId: item.cityTrackId,
                startStationName: item.startStationName,
                endStationName: item.endStationName,
                trackName: item.trackName,
            });
        }
    }
    const loadedTracks = new Map();
    const allStationNames = new Set();
    // Load each {cityTrackId}.json
    for (const t of tracks) {
        const trackPath = path_1.default.join(rootDir, "data", `${t.cityTrackId}.json`);
        const raw = await promises_1.default.readFile(trackPath, "utf8");
        const file = JSON.parse(raw);
        const stations = file.body.stationList.slice().sort((a, b) => a.stationPosition - b.stationPosition);
        const trainTimeList = file.body.trainTimeList || [];
        const stationById = new Map();
        const positionByName = new Map();
        const stationIdByPosition = new Map();
        for (const s of stations) {
            stationById.set(s.stationId, s);
            positionByName.set(s.stationName, s.stationPosition);
            stationIdByPosition.set(s.stationPosition, s.stationId);
            allStationNames.add(s.stationName);
        }
        loadedTracks.set(t.cityTrackId, {
            cityTrackId: t.cityTrackId,
            stations,
            trainTimeList,
            stationById,
            positionByName,
            stationIdByPosition,
        });
    }
    return { rootDir, tracks, loadedTracks, allStationNames };
}
