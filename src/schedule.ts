import { DataStore, LoadedTrack } from "./dataLoader";
import { DirectSolution, QueryResult, TransferLeg, TransferSolution, TrainTime } from "./types";
import { minutesToHHmm, parseHHmmToMinutes, todayMonthDayLabel } from "./utils";

// Safety caps to avoid generating enormous result sets that exceed memory or file size limits
const MAX_DIRECT_RESULTS = 500;
const MAX_TRANSFER_RESULTS = 500; // final results
const INTERMEDIATE_TRANSFER_CAP = MAX_TRANSFER_RESULTS * 2; // periodic pruning threshold
const PRUNE_TRIGGER_SIZE = MAX_TRANSFER_RESULTS * 4; // when to prune during enumeration
const MAX_WAIT_MINUTES = 180; // ignore transfer options with overly long waits (e.g., > 3h)

type TransferCandidate = {
  solution: TransferSolution;
  arrivalMinutes: number;
};

type AdjacencyMap = Map<string, Set<string>>;

function addEdge(map: AdjacencyMap, from: string, to: string) {
  if (from === to) return;
  let targets = map.get(from);
  if (!targets) {
    targets = new Set<string>();
    map.set(from, targets);
  }
  targets.add(to);
}

function bfs(adj: AdjacencyMap, origin: string): Set<string> {
  const visited = new Set<string>();
  if (!origin) return visited;
  const queue: string[] = [origin];
  let idx = 0;
  while (idx < queue.length) {
    const node = queue[idx++];
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = adj.get(node);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

function computeRelevantStations(store: DataStore, start: string, end: string): Set<string> {
  const forward: AdjacencyMap = new Map();
  const reverse: AdjacencyMap = new Map();

  for (const track of store.loadedTracks.values()) {
    const stations = track.stations;
    for (let i = 0; i < stations.length - 1; i += 1) {
      const from = stations[i].stationName;
      const to = stations[i + 1].stationName;
      addEdge(forward, from, to);
      addEdge(reverse, to, from);
    }
  }

  const reachableFromStart = bfs(forward, start);
  const canReachEnd = bfs(reverse, end);

  const validStations = new Set<string>();
  for (const name of reachableFromStart) {
    if (canReachEnd.has(name)) {
      validStations.add(name);
    }
  }
  validStations.add(start);
  validStations.add(end);
  return validStations;
}

function keepTopMutating(arr: TransferCandidate[], max: number) {
  arr.sort((a, b) =>
    a.solution.totalMinutes - b.solution.totalMinutes ||
    a.solution.waitMinutes - b.solution.waitMinutes ||
    a.arrivalMinutes - b.arrivalMinutes
  );
  if (arr.length > max) arr.length = max;
}

type LegTiming = {
  departStr: string;
  arriveStr: string;
  departMin: number;
  arriveMin: number;
};

function findLegTiming(
  track: LoadedTrack,
  train: TrainTime,
  startStationId: number,
  endStationId: number,
  startPos: number,
  endPos: number
): LegTiming | null {
  const list = train.stationArriveTimeList;
  if (!list || list.length === 0) return null;

  let departIdx = -1;
  for (let i = 0; i < list.length; i += 1) {
    const rec = list[i];
    if (rec.stationId === startStationId && rec.arriveTime && rec.arriveTime !== "-") {
      departIdx = i;
      break;
    }
  }
  if (departIdx === -1) return null;

  let arriveIdx = -1;
  for (let i = departIdx + 1; i < list.length; i += 1) {
    const rec = list[i];
    if (rec.stationId === endStationId && rec.arriveTime && rec.arriveTime !== "-") {
      arriveIdx = i;
      break;
    }
  }
  if (arriveIdx === -1) return null;

  const desiredDirection = Math.sign(endPos - startPos);
  if (desiredDirection === 0) return null;

  const departStation = track.stationById.get(startStationId);
  const arriveStation = track.stationById.get(endStationId);
  if (!departStation || !arriveStation) return null;
  const departPos = departStation.stationPosition;
  const arrivePos = arriveStation.stationPosition;
  if (Math.sign(arrivePos - departPos) !== desiredDirection) return null;

  let prevPos = departPos;
  for (let i = departIdx + 1; i <= arriveIdx; i += 1) {
    const rec = list[i];
    const station = track.stationById.get(rec.stationId);
    if (!station) return null;
    const currentPos = station.stationPosition;
    if (desiredDirection === 1) {
      if (currentPos <= prevPos) return null;
    } else if (currentPos >= prevPos) {
      return null;
    }
    prevPos = currentPos;
  }

  const departStr = list[departIdx].arriveTime;
  const arriveStr = list[arriveIdx].arriveTime;
  const departMin = parseHHmmToMinutes(departStr);
  let arriveMin = parseHHmmToMinutes(arriveStr);
  if (Number.isNaN(departMin) || Number.isNaN(arriveMin)) return null;
  if (arriveMin < departMin) arriveMin += 24 * 60;

  return { departStr, arriveStr, departMin, arriveMin };
}

type DirectCandidate = {
  solution: DirectSolution;
  departMinutes: number;
  arriveMinutes: number;
};

function buildDirectSolutions(store: DataStore, start: string, end: string): DirectSolution[] {
  const dateLabel = todayMonthDayLabel();
  const candidates: DirectCandidate[] = [];

  for (const [cityTrackId, track] of store.loadedTracks) {
    const posStart = track.positionByName.get(start);
    const posEnd = track.positionByName.get(end);
    if (posStart == null || posEnd == null) continue;
    if (posStart >= posEnd) continue; // wrong direction

    const startStationId = track.stationIdByPosition.get(posStart)!;
    const endStationId = track.stationIdByPosition.get(posEnd)!;

    for (const tt of track.trainTimeList) {
      const timing = findLegTiming(track, tt, startStationId, endStationId, posStart, posEnd);
      if (!timing) continue;
      const trainName = tt.trainNumber?.name?.trim() ?? "";
      const durationMinutes = timing.arriveMin - timing.departMin;
      if (durationMinutes <= 0) continue;
      const solution: DirectSolution = {
        type: "direct",
        cityTrackId,
        trainName,
        startStation: start,
        endStation: end,
        departTime: minutesToHHmm(timing.departMin),
        arriveTime: minutesToHHmm(timing.arriveMin),
        dateLabel,
        durationMinutes,
      };
      candidates.push({ solution, departMinutes: timing.departMin, arriveMinutes: timing.arriveMin });
    }
  }

  // sort by arrival time (earliest first), then duration, then departure time
  candidates.sort((a, b) =>
    a.arriveMinutes - b.arriveMinutes ||
    a.solution.durationMinutes - b.solution.durationMinutes ||
    a.departMinutes - b.departMinutes
  );

  const unique: DirectSolution[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const item = candidate.solution;
    const keyBase = item.trainName ? `name:${item.trainName}` : `time:${item.cityTrackId}:${item.departTime}-${item.arriveTime}`;
    if (seen.has(keyBase)) continue;
    seen.add(keyBase);
    unique.push(item);
    if (unique.length >= MAX_DIRECT_RESULTS) break;
  }

  return unique;
}

function enumerateTransferCandidates(store: DataStore, start: string, end: string) {
  type LegCandidate = { cityTrackId: number; track: LoadedTrack; fromPos: number; toPos: number };
  const leg1: LegCandidate[] = [];
  const leg2: LegCandidate[] = [];

  for (const [cityTrackId, track] of store.loadedTracks) {
    const posStart = track.positionByName.get(start);
    if (posStart != null) {
      const posEndOnSameTrack = track.positionByName.get(end);
      const direction = posEndOnSameTrack != null && posEndOnSameTrack !== posStart ? Math.sign(posEndOnSameTrack - posStart) : 0;
      for (const s of track.stations) {
        const candidatePos = s.stationPosition;
        if (candidatePos === posStart) continue;
        if (direction > 0) {
          if (candidatePos <= posStart) continue;
          if (candidatePos >= posEndOnSameTrack!) continue;
        } else if (direction < 0) {
          if (candidatePos >= posStart) continue;
          if (candidatePos <= posEndOnSameTrack!) continue;
        } else if (candidatePos === posStart) {
          continue;
        }
        leg1.push({ cityTrackId, track, fromPos: posStart, toPos: candidatePos });
      }
    }

    const posEnd = track.positionByName.get(end);
    if (posEnd != null) {
      const posStartOnSameTrack = track.positionByName.get(start);
      const direction = posStartOnSameTrack != null && posStartOnSameTrack !== posEnd ? Math.sign(posEnd - posStartOnSameTrack) : 0;
      for (const s of track.stations) {
        const candidatePos = s.stationPosition;
        if (candidatePos === posEnd) continue;
        if (direction > 0) {
          if (posStartOnSameTrack != null && candidatePos <= posStartOnSameTrack) continue;
          if (candidatePos >= posEnd) continue;
        } else if (direction < 0) {
          if (posStartOnSameTrack != null && candidatePos >= posStartOnSameTrack) continue;
          if (candidatePos <= posEnd) continue;
        } else if (candidatePos >= posEnd) {
          continue;
        }
        leg2.push({ cityTrackId, track, fromPos: candidatePos, toPos: posEnd });
      }
    }
  }

  return { leg1, leg2 };
}

function buildTransferSolutions(store: DataStore, start: string, end: string, validStations: Set<string>): TransferSolution[] {
  const dateLabel = todayMonthDayLabel();
  const solutions: TransferCandidate[] = [];

  // Build a map: transferStationName -> list of leg candidates for leg1 and leg2
  const transferStations = new Map<string, { leg1: Array<{ track: LoadedTrack; fromPos: number; toPos: number }>; leg2: Array<{ track: LoadedTrack; fromPos: number; toPos: number }> }>();

  for (const [cityTrackId, track] of store.loadedTracks) {
    const posStart = track.positionByName.get(start);
    const posEnd = track.positionByName.get(end);

    if (posStart != null) {
      const direction = posEnd != null && posEnd !== posStart ? Math.sign(posEnd - posStart) : 0;
      for (const s of track.stations) {
        const candidatePos = s.stationPosition;
        if (!validStations.has(s.stationName)) continue;
        if (candidatePos === posStart) continue;
        if (direction > 0) {
          if (candidatePos <= posStart) continue;
          if (candidatePos >= posEnd!) continue;
        } else if (direction < 0) {
          if (candidatePos >= posStart) continue;
          if (candidatePos <= posEnd!) continue;
        } else if (candidatePos === posStart) {
          continue;
        }

        const key = s.stationName;
        if (!transferStations.has(key)) transferStations.set(key, { leg1: [], leg2: [] });
        transferStations.get(key)!.leg1.push({ track, fromPos: posStart, toPos: candidatePos });
      }
    }

    if (posEnd != null) {
      const posStartOnSameTrack = track.positionByName.get(start);
      const direction = posStartOnSameTrack != null && posStartOnSameTrack !== posEnd ? Math.sign(posEnd - posStartOnSameTrack) : 0;
      for (const s of track.stations) {
        const candidatePos = s.stationPosition;
        if (!validStations.has(s.stationName)) continue;
        if (candidatePos === posEnd) continue;
        if (direction > 0) {
          if (posStartOnSameTrack != null && candidatePos <= posStartOnSameTrack) continue;
          if (candidatePos >= posEnd) continue;
        } else if (direction < 0) {
          if (posStartOnSameTrack != null && candidatePos >= posStartOnSameTrack) continue;
          if (candidatePos <= posEnd) continue;
        } else if (candidatePos >= posEnd) {
          continue;
        }

        const key = s.stationName;
        if (!transferStations.has(key)) transferStations.set(key, { leg1: [], leg2: [] });
        transferStations.get(key)!.leg2.push({ track, fromPos: candidatePos, toPos: posEnd });
      }
    }
  }

  for (const [transferStation, pair] of transferStations) {
    if (pair.leg1.length === 0 || pair.leg2.length === 0) continue;

    for (const l1 of pair.leg1) {
      const startStationId = l1.track.stationIdByPosition.get(l1.fromPos)!;
      const transferStationId = l1.track.stationIdByPosition.get(l1.toPos)!;

      for (const tt1 of l1.track.trainTimeList) {
        const timing1 = findLegTiming(l1.track, tt1, startStationId, transferStationId, l1.fromPos, l1.toPos);
        if (!timing1) continue;
        const dep1m = timing1.departMin;
        const arr1m = timing1.arriveMin;

        for (const l2 of pair.leg2) {
          const transferStationId2 = l2.track.stationIdByPosition.get(l2.fromPos)!; // same station name but different track possible
          const endStationId = l2.track.stationIdByPosition.get(l2.toPos)!;
          // Ensure the transfer station names actually match
          const stationName1 = l1.track.stations.find((s) => s.stationPosition === l1.toPos)!.stationName;
          const stationName2 = l2.track.stations.find((s) => s.stationPosition === l2.fromPos)!.stationName;
          if (stationName1 !== stationName2) continue;

          for (const tt2 of l2.track.trainTimeList) {
            const timing2 = findLegTiming(l2.track, tt2, transferStationId2, endStationId, l2.fromPos, l2.toPos);
            if (!timing2) continue;
            let dep2m = timing2.departMin;
            let arr2m = timing2.arriveMin;
            while (dep2m < arr1m) {
              dep2m += 24 * 60;
              arr2m += 24 * 60;
            }

            const wait = dep2m - arr1m;
            if (wait < 0) continue;
            if (wait > MAX_WAIT_MINUTES) continue; // skip impractically long transfers
            const leg1Dur = arr1m - dep1m;
            const leg2Dur = arr2m - dep2m;
            if (leg1Dur <= 0 || leg2Dur <= 0) continue;
            const totalMinutes = leg1Dur + wait + leg2Dur;

            const leg1TrainName = tt1.trainNumber?.name?.trim() ?? "";
            const leg2TrainName = tt2.trainNumber?.name?.trim() ?? "";
            if (wait === 0 && leg1TrainName && leg1TrainName === leg2TrainName) {
              continue; // same physical train with no wait acts as a direct service
            }

            const leg1: TransferLeg = {
              cityTrackId: l1.track.cityTrackId,
              trainName: leg1TrainName,
              fromStation: start,
              toStation: transferStation,
              departTime: minutesToHHmm(dep1m),
              arriveTime: minutesToHHmm(arr1m),
              durationMinutes: leg1Dur,
            };
            const leg2: TransferLeg = {
              cityTrackId: l2.track.cityTrackId,
              trainName: leg2TrainName,
              fromStation: transferStation,
              toStation: end,
              departTime: minutesToHHmm(dep2m),
              arriveTime: minutesToHHmm(arr2m),
              durationMinutes: leg2Dur,
            };

            const solution: TransferSolution = {
              type: "transfer",
              transferStation,
              leg1,
              leg2,
              waitMinutes: wait,
              dateLabel,
              totalMinutes,
            };

            solutions.push({ solution, arrivalMinutes: arr2m });

            // Periodically prune to keep memory bounded
            if (solutions.length > PRUNE_TRIGGER_SIZE) {
              keepTopMutating(solutions, INTERMEDIATE_TRANSFER_CAP);
            }
          }
        }
      }
    }
  }

  // sort by arrival time of last leg, followed by total time and wait time
  solutions.sort((a, b) =>
    a.arrivalMinutes - b.arrivalMinutes ||
    a.solution.totalMinutes - b.solution.totalMinutes ||
    a.solution.waitMinutes - b.solution.waitMinutes
  );

  const unique: TransferSolution[] = [];
  const seen = new Set<string>();
  for (const candidate of solutions) {
    const item = candidate.solution;
    const leg1Key = item.leg1.trainName ? `name:${item.leg1.trainName}` : `leg1:${item.leg1.cityTrackId}:${item.leg1.departTime}-${item.leg1.arriveTime}`;
    const leg2Key = item.leg2.trainName ? `name:${item.leg2.trainName}` : `leg2:${item.leg2.cityTrackId}:${item.leg2.departTime}-${item.leg2.arriveTime}`;
    const key = `${item.transferStation}|${leg1Key}|${leg2Key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= MAX_TRANSFER_RESULTS) break;
  }

  return unique;
}

export function computeSchedule(store: DataStore, start: string, end: string): QueryResult {
  const validStations = computeRelevantStations(store, start, end);
  const direct = buildDirectSolutions(store, start, end);
  const transfers = direct.length > 0 ? [] : buildTransferSolutions(store, start, end, validStations);
  return {
    start,
    end,
    direct,
    transfers,
    generatedAt: new Date().toISOString(),
  };
}
