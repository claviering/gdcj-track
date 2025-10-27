import fs from "fs/promises";
import path from "path";
import { CityTrackFile, SingleCityTrackFile, Station, TrainTime } from "./types";

export type TrackInfo = {
  cityTrackId: number;
  startStationName: string;
  endStationName: string;
  trackName: string;
};

export type LoadedTrack = {
  cityTrackId: number;
  stations: Station[];
  trainTimeList: TrainTime[];
  // quick lookups
  stationById: Map<number, Station>;
  positionByName: Map<string, number>;
  stationIdByPosition: Map<number, number>;
};

export type DataStore = {
  rootDir: string;
  tracks: TrackInfo[];
  loadedTracks: Map<number, LoadedTrack>;
  allStationNames: Set<string>;
};

export async function loadAllData(rootDir: string): Promise<DataStore> {
  // Load SingleCityTrack.json
  // Data files are now under the "data" directory at repo root
  const singleCityPath = path.join(rootDir, "data", "SingleCityTrack.json");
  const singleRaw = await fs.readFile(singleCityPath, "utf8");
  const single: SingleCityTrackFile = JSON.parse(singleRaw);

  const tracks: TrackInfo[] = [];
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

  const loadedTracks = new Map<number, LoadedTrack>();
  const allStationNames = new Set<string>();

  // Load each {cityTrackId}.json
  for (const t of tracks) {
  const trackPath = path.join(rootDir, "data", `${t.cityTrackId}.json`);
    const raw = await fs.readFile(trackPath, "utf8");
    const file: CityTrackFile = JSON.parse(raw);

    const stations = file.body.stationList.slice().sort((a, b) => a.stationPosition - b.stationPosition);
    const trainTimeList = file.body.trainTimeList || [];

    const stationById = new Map<number, Station>();
    const positionByName = new Map<string, number>();
    const stationIdByPosition = new Map<number, number>();

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
