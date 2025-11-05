import { DataStore, LoadedTrack } from "./dataLoader";
import { DirectSolution, QueryResult, TransferLeg, TransferSolution, TrainTime } from "./types";
import { minutesToHHmm, parseHHmmToMinutes, todayMonthDayLabel } from "./utils";

// Safety caps to avoid generating enormous result sets that exceed memory or file size limits
const MAX_DIRECT_RESULTS = 500;
const MAX_TRANSFER_RESULTS = 500; // final results
const INTERMEDIATE_TRANSFER_CAP = MAX_TRANSFER_RESULTS * 2; // periodic pruning threshold
const PRUNE_TRIGGER_SIZE = MAX_TRANSFER_RESULTS * 4; // when to prune during enumeration
const MAX_WAIT_MINUTES = 50; // ignore transfer options with overly long waits (e.g., > 3h)

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

function computeRelevantTracks(store: DataStore, start: string, end: string): {directTrackIds: Set<number>, reverseTrackIds: Set<number>} {
  const directTrackIds = new Set<number>();
  const reverseTrackIds = new Set<number>();

  for (const [cityTrackId, track] of store.loadedTracks) {
    const startPos = track.positionByName.get(start);
    const endPos = track.positionByName.get(end);
    const hasStart = startPos != null;
    const hasEnd = endPos != null;

    if (hasStart && hasEnd && startPos! < endPos!) {
      directTrackIds.add(cityTrackId);
    } else if (hasStart && hasEnd && startPos! > endPos!) {
      reverseTrackIds.add(cityTrackId);
    }
  }

  return {directTrackIds, reverseTrackIds};
}

function keepTopMutating(arr: TransferCandidate[], max: number) {
  arr.sort((a, b) =>
    a.solution.totalMinutes - b.solution.totalMinutes ||
    a.solution.waitMinutes.reduce((sum, w) => sum + w, 0) - b.solution.waitMinutes.reduce((sum, w) => sum + w, 0) ||
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

/**
 * Find the closest option departing at or after the target time.
 * Returns null if no options depart at or after the target time.
 */
function findClosestDepartingAtOrAfter<T extends { departMinutes: number }>(
  options: T[],
  targetDepartMinutes: number
): T | null {
  let closestOption: T | null = null;
  let minTimeDiff = Infinity;
  
  for (const option of options) {
    // Only consider trains departing at or after the target time
    if (option.departMinutes < targetDepartMinutes) {
      continue;
    }
    
    const timeDiff = option.departMinutes - targetDepartMinutes;
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff;
      closestOption = option;
    }
  }
  
  return closestOption;
}

function buildDirectSolutions(store: DataStore, start: string, end: string, relevantTracks?: Set<number>, departTime?: string): DirectSolution[] {
  const dateLabel = todayMonthDayLabel();
  const candidates: DirectCandidate[] = [];
  
  // Parse the target departure time if provided
  const targetDepartMinutes = departTime ? parseHHmmToMinutes(departTime) : undefined;
  const hasTargetTime = targetDepartMinutes !== undefined && !Number.isNaN(targetDepartMinutes);

  // Determine which tracks to iterate over
  const tracksToCheck = relevantTracks && relevantTracks.size > 0 
    ? Array.from(relevantTracks).map(id => [id, store.loadedTracks.get(id)] as [number, LoadedTrack | undefined])
    : Array.from(store.loadedTracks.entries());

  for (const [cityTrackId, track] of tracksToCheck) {
    if (!track) continue;
    
    const posStart = track.positionByName.get(start);
    const posEnd = track.positionByName.get(end);
    if (posStart == null || posEnd == null) continue;
    if (posStart >= posEnd) continue; // wrong direction

    const startStationId = track.stationIdByPosition.get(posStart)!;
    const endStationId = track.stationIdByPosition.get(posEnd)!;

    for (const tt of track.trainTimeList) {
      const list = tt.stationArriveTimeList;
      if (!list || list.length === 0) continue;

      // Use position-based indexing (positions are 1-indexed, array is 0-indexed)
      const startIndex = posStart - 1;
      const endIndex = posEnd - 1;
      
      // Validate: indices must be within bounds and stations must match
      if (startIndex < 0 || endIndex >= list.length) continue;
      if (list[startIndex].stationId !== startStationId || list[endIndex].stationId !== endStationId) continue;

      const departTimeStr = list[startIndex].arriveTime;
      const arriveTimeStr = list[endIndex].arriveTime;
      
      // Check if both times are valid (not "-" or missing)
      if (!departTimeStr || departTimeStr === "-" || !arriveTimeStr || arriveTimeStr === "-") continue;

      // Parse times
      const departMin = parseHHmmToMinutes(departTimeStr);
      let arriveMin = parseHHmmToMinutes(arriveTimeStr);
      if (Number.isNaN(departMin) || Number.isNaN(arriveMin)) continue;
      
      // Handle cross-midnight arrivals
      if (arriveMin < departMin) arriveMin += 24 * 60;
      
      const durationMinutes = arriveMin - departMin;
      if (durationMinutes <= 0) continue;

      const trainName = tt.trainNumber?.name?.trim() ?? "";
      const solution: DirectSolution = {
        type: "direct",
        cityTrackId,
        trainName,
        startStation: start,
        endStation: end,
        departTime: minutesToHHmm(departMin),
        arriveTime: minutesToHHmm(arriveMin),
        dateLabel,
        durationMinutes,
      };
      candidates.push({ solution, departMinutes: departMin, arriveMinutes: arriveMin });
    }
  }

  // If target time specified, find the closest train departing at or after that time
  if (hasTargetTime) {
    const closestCandidate = findClosestDepartingAtOrAfter(candidates, targetDepartMinutes!);
    return closestCandidate ? [closestCandidate.solution] : [];
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

function buildTransferSolutions(store: DataStore, start: string, end: string, directTrackIds: Set<number>, reverseTrackIds: Set<number>, departTime?: string): TransferSolution[] {
  const validStations = computeRelevantStations(store, start, end);
  const dateLabel = todayMonthDayLabel();
  const solutions: TransferCandidate[] = [];
  
  // Parse the target departure time if provided
  const targetDepartMinutes = departTime ? parseHHmmToMinutes(departTime) : undefined;
  const hasTargetTime = targetDepartMinutes !== undefined && !Number.isNaN(targetDepartMinutes);

  // Build a map: transferStationName -> list of leg candidates for leg1 and leg2
  // Track whether each candidate is from direct or reverse tracks
  const transferStations = new Map<string, { 
    leg1: Array<{ track: LoadedTrack; fromPos: number; toPos: number; isReverse: boolean }>; 
    leg2: Array<{ track: LoadedTrack; fromPos: number; toPos: number; isReverse: boolean }> 
  }>();

  // Process direct tracks first
  const trackIds = directTrackIds.size > 0 ? directTrackIds : new Set(store.loadedTracks.keys());

  for (const cityTrackId of trackIds) {
    const track = store.loadedTracks.get(cityTrackId);
    if (!track) continue;
    const posStart = track.positionByName.get(start);
    const posEnd = track.positionByName.get(end);
    const isReverse = false;

    if (posStart != null) {
      const direction = posEnd != null && posEnd !== posStart ? Math.sign(posEnd - posStart) : 0;
      for (const s of track.stations) {
        const candidatePos = s.stationPosition;
        if (!validStations.has(s.stationName)) continue;
        if (candidatePos === posStart) continue;
        if (direction > 0) {
          // track A -> B -> C -> D -> E -> F, start at B, end at E, can transfer at C or D
          if (candidatePos <= posStart) continue;
          if (candidatePos >= posEnd!) continue;
        } else if (direction < 0) {
          // track F -> E -> D -> C -> B -> A, start at B, end at E, can transfer at A
          if (candidatePos <= posStart) continue;
        } else if (candidatePos === posStart) {
          continue;
        }

        const key = s.stationName;
        if (!transferStations.has(key)) transferStations.set(key, { leg1: [], leg2: [] });
        transferStations.get(key)!.leg1.push({ track, fromPos: posStart, toPos: candidatePos, isReverse });
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
          if (posStartOnSameTrack != null && candidatePos <= posStartOnSameTrack) continue;
        } else if (candidatePos >= posEnd) {
          continue;
        }

        const key = s.stationName;
        if (!transferStations.has(key)) transferStations.set(key, { leg1: [], leg2: [] });
        transferStations.get(key)!.leg2.push({ track, fromPos: candidatePos, toPos: posEnd, isReverse });
      }
    }
  }

  // Process reverse tracks separately for leg1 (start to transfer station)
  for (const cityTrackId of reverseTrackIds) {
    const track = store.loadedTracks.get(cityTrackId);
    if (!track) continue;
    const posStart = track.positionByName.get(start);
    if (posStart == null) continue;
    const isReverse = true;

    // For reverse tracks: start at B, end at E on track F -> E -> D -> C -> B -> A
    // Can transfer at stations after start position (A) in the track direction
    for (const s of track.stations) {
      const candidatePos = s.stationPosition;
      if (!validStations.has(s.stationName)) continue;
      if (candidatePos === posStart) continue;
      // Allow transfers at stations after the start position (reverse direction)
      if (candidatePos < posStart) continue;

      const key = s.stationName;
      if (!transferStations.has(key)) transferStations.set(key, { leg1: [], leg2: [] });
      transferStations.get(key)!.leg1.push({ track, fromPos: posStart, toPos: candidatePos, isReverse });
    }
  }

  // For leg2 of reverse track transfers, use direct tracks (from transfer station to end)
  // This connects the reverse leg1 to a forward leg2
  for (const cityTrackId of trackIds) {
    const track = store.loadedTracks.get(cityTrackId);
    if (!track) continue;
    const posEnd = track.positionByName.get(end);
    if (posEnd == null) continue;
    const isReverse = true; // Mark as part of reverse transfer solution

    for (const s of track.stations) {
      const candidatePos = s.stationPosition;
      if (!validStations.has(s.stationName)) continue;
      if (candidatePos === posEnd) continue;
      // Only consider stations before the end position (forward direction)
      if (candidatePos >= posEnd) continue;

      const key = s.stationName;
      // Only add leg2 if we already have leg1 from reverse tracks at this transfer station
      const existing = transferStations.get(key);
      if (existing && existing.leg1.some(l => l.isReverse)) {
        transferStations.get(key)!.leg2.push({ track, fromPos: candidatePos, toPos: posEnd, isReverse });
      }
    }
  }

  // Compute solutions and track minimum time for direct track transfers
  let minDirectTrackTime: number | null = null;
  const directSolutions: TransferCandidate[] = [];
  const reverseSolutions: TransferCandidate[] = [];

  for (const [transferStation, pair] of transferStations) {
    if (pair.leg1.length === 0 || pair.leg2.length === 0) continue;

    // If target time specified, first find the closest first-leg train
    type FirstLegOption = {
      l1: { track: LoadedTrack; fromPos: number; toPos: number; isReverse: boolean };
      tt1: TrainTime;
      timing1: LegTiming;
      dep1m: number;
      arr1m: number;
    };
    
    const firstLegOptions: FirstLegOption[] = [];
    
    for (const l1 of pair.leg1) {
      const startStationId = l1.track.stationIdByPosition.get(l1.fromPos)!;
      const transferStationId = l1.track.stationIdByPosition.get(l1.toPos)!;

      for (const tt1 of l1.track.trainTimeList) {
        const timing1 = findLegTiming(l1.track, tt1, startStationId, transferStationId, l1.fromPos, l1.toPos);
        if (!timing1) continue;
        
        const dep1m = timing1.departMin;
        const arr1m = timing1.arriveMin;
        
        firstLegOptions.push({ l1, tt1, timing1, dep1m, arr1m });
      }
    }
    
    // Filter to closest first-leg departing at or after target time if specified
    let firstLegsToProcess = firstLegOptions;
    if (hasTargetTime) {
      const closestOption = findClosestDepartingAtOrAfter(
        firstLegOptions.map(opt => ({ ...opt, departMinutes: opt.dep1m })),
        targetDepartMinutes!
      );
      
      firstLegsToProcess = closestOption ? [firstLegOptions.find(opt => opt.dep1m === closestOption.dep1m)!] : [];
    }
    
    // Build transfer solutions for selected first legs
    for (const { l1, tt1, timing1, dep1m, arr1m } of firstLegsToProcess) {
      const transferStationId = l1.track.stationIdByPosition.get(l1.toPos)!;

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
            transferStations: [transferStation],
            legs: [leg1, leg2],
            waitMinutes: [wait],
            dateLabel,
            totalMinutes,
          };

          const candidate = { solution, arrivalMinutes: arr2m };

          // Track if this involves any reverse track legs
          const isReverseTransfer = l1.isReverse || l2.isReverse;

          if (isReverseTransfer) {
            reverseSolutions.push(candidate);
          } else {
            directSolutions.push(candidate);
            // Track the fastest direct-track transfer time
            if (minDirectTrackTime === null || totalMinutes < minDirectTrackTime) {
              minDirectTrackTime = totalMinutes;
            }
          }

          // Periodically prune to keep memory bounded
          if (directSolutions.length + reverseSolutions.length > PRUNE_TRIGGER_SIZE) {
            keepTopMutating(directSolutions, INTERMEDIATE_TRANSFER_CAP);
            keepTopMutating(reverseSolutions, INTERMEDIATE_TRANSFER_CAP);
          }
        }
      }
    }
  }

  // Filter reverse solutions: only keep those faster than the fastest direct-track transfer
  const filteredReverseSolutions = minDirectTrackTime !== null
    ? reverseSolutions.filter(candidate => candidate.solution.totalMinutes < minDirectTrackTime)
    : reverseSolutions;

  // Combine all solutions
  solutions.push(...directSolutions, ...filteredReverseSolutions);

  // If no direct tracks available, try two-transfer solutions
  if (directTrackIds.size === 0 && reverseTrackIds.size === 0) {
    // Get the minimum time from one-transfer solutions to use as threshold
    const minOneTransferTime = solutions.length > 0
      ? Math.min(...solutions.map(s => s.solution.totalMinutes))
      : null;

    const twoTransferSolutions = buildTwoTransferSolutions(store, start, end, departTime);
    if (minOneTransferTime !== null) {
      const fasterTwoTransfers = twoTransferSolutions.filter(t => t.totalMinutes < minOneTransferTime);
      // Convert to TransferCandidate format
      const twoTransferCandidates: TransferCandidate[] = fasterTwoTransfers.map(sol => ({
        solution: sol,
        arrivalMinutes: parseHHmmToMinutes(sol.legs[sol.legs.length - 1].arriveTime)
      }));
      solutions.push(...twoTransferCandidates);
    } else if (twoTransferSolutions.length > 0) {
      // If no one-transfer solutions, include all two-transfer solutions
      const twoTransferCandidates: TransferCandidate[] = twoTransferSolutions.map(sol => ({
        solution: sol,
        arrivalMinutes: parseHHmmToMinutes(sol.legs[sol.legs.length - 1].arriveTime)
      }));
      solutions.push(...twoTransferCandidates);
    }
  }

  // sort by arrival time of last leg, followed by total time and wait time
  solutions.sort((a, b) =>
    a.arrivalMinutes - b.arrivalMinutes ||
    a.solution.totalMinutes - b.solution.totalMinutes ||
    a.solution.waitMinutes.reduce((sum, w) => sum + w, 0) - b.solution.waitMinutes.reduce((sum, w) => sum + w, 0)
  );

  const unique: TransferSolution[] = [];
  const seen = new Set<string>();
  for (const candidate of solutions) {
    const item = candidate.solution;
    // Deduplicate by first leg + transfer station only, keeping the fastest total time for each first-leg choice
    const leg1 = item.legs[0];
    const leg1Key = leg1.trainName ? `name:${leg1.trainName}` : `leg1:${leg1.cityTrackId}:${leg1.departTime}-${leg1.arriveTime}`;
    const key = `${item.transferStations.join('|')}|${leg1Key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= MAX_TRANSFER_RESULTS) break;
  }

  return unique;
}

function buildTwoTransferSolutions(store: DataStore, start: string, end: string, departTime?: string): TransferSolution[] {
  const validStations = computeRelevantStations(store, start, end);
  const dateLabel = todayMonthDayLabel();
  const solutions: TransferCandidate[] = [];
  
  // Parse the target departure time if provided
  const targetDepartMinutes = departTime ? parseHHmmToMinutes(departTime) : undefined;
  const hasTargetTime = targetDepartMinutes !== undefined && !Number.isNaN(targetDepartMinutes);

  // For two transfers: start → transfer1 → transfer2 → end
  // We need to find all valid combinations of two intermediate stations
  const validStationsArray = Array.from(validStations).filter(s => s !== start && s !== end);
  
  // Build solutions for each pair of transfer stations
  for (let i = 0; i < validStationsArray.length; i++) {
    const transfer1 = validStationsArray[i];
    
    // Get first leg options: start → transfer1
    const leg1Options = buildDirectSolutions(store, start, transfer1);
    if (leg1Options.length === 0) continue;
    
    // If target time specified, find the closest first-leg train departing at or after target time
    const leg1Candidates = leg1Options.map(leg1 => ({
      leg1,
      departMinutes: parseHHmmToMinutes(leg1.departTime)
    }));
    
    let firstLegsToProcess = leg1Options;
    if (hasTargetTime) {
      const closest = findClosestDepartingAtOrAfter(leg1Candidates, targetDepartMinutes!);
      if (!closest) continue; // No trains depart at or after target time
      firstLegsToProcess = [closest.leg1];
    }
    
    for (let j = 0; j < validStationsArray.length; j++) {
      if (i === j) continue; // Same station can't be both transfers
      const transfer2 = validStationsArray[j];
      
      // Get second leg options: transfer1 → transfer2
      const leg2Options = buildDirectSolutions(store, transfer1, transfer2);
      if (leg2Options.length === 0) continue;
      
      // Get third leg options: transfer2 → end
      const leg3Options = buildDirectSolutions(store, transfer2, end);
      if (leg3Options.length === 0) continue;
      
      // Combine all three legs
      for (const leg1 of firstLegsToProcess) {
        const arr1m = parseHHmmToMinutes(leg1.arriveTime);
        if (Number.isNaN(arr1m)) continue;
        
        for (const leg2 of leg2Options) {
          let dep2m = parseHHmmToMinutes(leg2.departTime);
          let arr2m = parseHHmmToMinutes(leg2.arriveTime);
          if (Number.isNaN(dep2m) || Number.isNaN(arr2m)) continue;
          
          // Handle cross-midnight for leg2
          while (dep2m < arr1m) {
            dep2m += 24 * 60;
            arr2m += 24 * 60;
          }
          
          const wait1 = dep2m - arr1m;
          // Skip if same train continues (wait time is 0 and same train number)
          if (wait1 <= 0 || leg1.trainName === leg2.trainName || wait1 > MAX_WAIT_MINUTES) continue;
          
          for (const leg3 of leg3Options) {
            let dep3m = parseHHmmToMinutes(leg3.departTime);
            let arr3m = parseHHmmToMinutes(leg3.arriveTime);
            if (Number.isNaN(dep3m) || Number.isNaN(arr3m)) continue;
            
            // Handle cross-midnight for leg3
            while (dep3m < arr2m) {
              dep3m += 24 * 60;
              arr3m += 24 * 60;
            }
            
            const wait2 = dep3m - arr2m;
            // Skip if same train continues (wait time is 0 and same train number)
            if (wait2 <= 0 || leg2.trainName === leg3.trainName || wait2 > MAX_WAIT_MINUTES) continue;
            
            const totalMinutes = leg1.durationMinutes + wait1 + leg2.durationMinutes + wait2 + leg3.durationMinutes;
            
            // Represent the complete three-leg journey as two connected transfer solutions
            // First solution: start → transfer1 → transfer2
            const firstLeg: TransferLeg = {
              cityTrackId: leg1.cityTrackId,
              trainName: leg1.trainName,
              fromStation: start,
              toStation: transfer1,
              departTime: leg1.departTime,
              arriveTime: minutesToHHmm(arr1m),
              durationMinutes: leg1.durationMinutes,
            };
            
            const secondLeg: TransferLeg = {
              cityTrackId: leg2.cityTrackId,
              trainName: leg2.trainName,
              fromStation: transfer1,
              toStation: transfer2,
              departTime: minutesToHHmm(dep2m),
              arriveTime: minutesToHHmm(arr2m),
              durationMinutes: leg2.durationMinutes,
            };
            
            const thirdLeg: TransferLeg = {
              cityTrackId: leg3.cityTrackId,
              trainName: leg3.trainName,
              fromStation: transfer2,
              toStation: end,
              departTime: minutesToHHmm(dep3m),
              arriveTime: minutesToHHmm(arr3m),
              durationMinutes: leg3.durationMinutes,
            };
            
            // Create the complete two-transfer solution showing the full journey
            const solution: TransferSolution = {
              type: "transfer",
              transferStations: [transfer1, transfer2],
              legs: [firstLeg, secondLeg, thirdLeg],
              waitMinutes: [wait1, wait2],
              dateLabel,
              totalMinutes,
            };
            
            solutions.push({ 
              solution, 
              arrivalMinutes: arr3m  // Use final arrival time
            });
          }
        }
      }
      
      // Limit solutions to avoid memory issues
      if (solutions.length > PRUNE_TRIGGER_SIZE) {
        keepTopMutating(solutions, INTERMEDIATE_TRANSFER_CAP);
      }
    }
  }
  
  // Sort and deduplicate
  solutions.sort((a, b) =>
    a.arrivalMinutes - b.arrivalMinutes ||
    a.solution.totalMinutes - b.solution.totalMinutes ||
    a.solution.waitMinutes.reduce((sum, w) => sum + w, 0) - b.solution.waitMinutes.reduce((sum, w) => sum + w, 0)
  );
  
  const unique: TransferSolution[] = [];
  const seen = new Set<string>();
  for (const candidate of solutions) {
    const item = candidate.solution;
    const leg1 = item.legs[0];
    const leg1Key = leg1.trainName ? `name:${leg1.trainName}` : `leg1:${leg1.cityTrackId}:${leg1.departTime}-${leg1.arriveTime}`;
    const key = `${item.transferStations.join('|')}|${leg1Key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= MAX_TRANSFER_RESULTS) break;
  }
  
  return unique;
}

export function computeSchedule(store: DataStore, start: string, end: string, departTime?: string): QueryResult {
  const {directTrackIds, reverseTrackIds} = computeRelevantTracks(store, start, end);
  const direct = buildDirectSolutions(store, start, end, directTrackIds, departTime);
  
  // Always compute transfer solutions (which now includes two-transfer solutions when beneficial)
  const transfers = buildTransferSolutions(store, start, end, directTrackIds, reverseTrackIds, departTime);
  
  // Filter transfers: only keep those faster than the fastest direct route
  const filteredTransfers = direct.length > 0
    ? transfers.filter(t => t.totalMinutes < direct[0].durationMinutes)
    : transfers;
  
  return {
    start,
    end,
    direct,
    transfers: filteredTransfers,
    generatedAt: new Date().toISOString(),
  };
}
