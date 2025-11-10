import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://gdcj.gzmtr.com/metrogzApi/api';
const AUTHORIZATION = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblRpbWUiOiIxNzYyNzQwOTU3MTg2IiwidXNlcm5hbWUiOiJvYm1hZjYzaGVwLXBxa2V3aWRya212cHR0ejIwIn0.SBi3qvcbAwzzy7DXKmMb80X5vEXGIisIJiU4OahN3Jw';

const DATA_DIR = path.join(__dirname, '../data');

interface RawTrackEntry {
  trackName: string;
  list: Array<{
    cityTrackId: number;
    trackName: string;
    startStationName: string;
    endStationName: string;
    status?: number;
    createTime?: string | null;
    creator?: string | null;
    modifyTime?: string | null;
    modifier?: string | null;
  }>;
}

interface RawSingleCityTrackResponse {
  body: RawTrackEntry[];
}

interface RawStation {
  stationId: number;
  stationName: string;
  stationPosition: number;
  status?: number;
  cityTrackId?: number;
  createTime?: string | null;
  creator?: string | null;
  modifyTime?: string | null;
  modifier?: string | null;
}

interface RawStationArriveTime {
  id: number;
  stationId: number;
  trainNumberId: number;
  arriveTime: string;
  isStartStation?: number;
  status?: number;
  createTime?: string | null;
  creator?: string | null;
  modifyTime?: string | null;
  modifier?: string | null;
}

interface RawTrainNumber {
  trainNumberId: number;
  name: string;
  cityTrackId?: number;
  status?: number;
  createTime?: string | null;
  creator?: string | null;
  modifyTime?: string | null;
  modifier?: string | null;
}

interface RawTrainTime {
  trainNumber: RawTrainNumber;
  stationArriveTimeList: RawStationArriveTime[];
}

interface RawCityTrackResponse {
  body: {
    stationList: RawStation[];
    trainTimeList: RawTrainTime[];
  };
}

async function fetchData(url: string): Promise<any> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Authorization': AUTHORIZATION,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

function cleanTrackEntry(entry: RawTrackEntry): RawTrackEntry {
  return {
    trackName: entry.trackName,
    list: entry.list.map(item => ({
      cityTrackId: item.cityTrackId,
      trackName: item.trackName,
      startStationName: item.startStationName,
      endStationName: item.endStationName,
    })),
  };
}

function cleanStation(station: RawStation) {
  return {
    stationId: station.stationId,
    stationName: station.stationName,
    stationPosition: station.stationPosition,
    status: station.status,
    cityTrackId: station.cityTrackId,
  };
}

function cleanStationArriveTime(arriveTime: RawStationArriveTime) {
  return {
    id: arriveTime.id,
    stationId: arriveTime.stationId,
    trainNumberId: arriveTime.trainNumberId,
    arriveTime: arriveTime.arriveTime,
  };
}

function cleanTrainNumber(trainNumber: RawTrainNumber) {
  return {
    trainNumberId: trainNumber.trainNumberId,
    name: trainNumber.name,
    cityTrackId: trainNumber.cityTrackId,
  };
}

async function updateSingleCityTrack() {
  console.log('Fetching SingleCityTrack data...');
  const url = `${API_BASE}/cityTrack/getSingleCityTrack?status=1`;
  const data: RawSingleCityTrackResponse = await fetchData(url);

  const cleaned = {
    body: data.body.map(cleanTrackEntry),
  };

  const filePath = path.join(DATA_DIR, 'SingleCityTrack.json');
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`✓ Updated ${filePath}`);

  return cleaned.body;
}

async function updateCityTrackData(cityTrackId: number) {
  console.log(`Fetching data for cityTrackId ${cityTrackId}...`);
  const url = `${API_BASE}/stationArriveTime/listByCityTrackId?cityTrackId=${cityTrackId}`;
  const data: RawCityTrackResponse = await fetchData(url);

  const cleaned = {
    body: {
      stationList: data.body.stationList.map(cleanStation),
      trainTimeList: data.body.trainTimeList.map(trainTime => ({
        trainNumber: cleanTrainNumber(trainTime.trainNumber),
        stationArriveTimeList: trainTime.stationArriveTimeList.map(cleanStationArriveTime),
      })),
    },
  };

  const filePath = path.join(DATA_DIR, `${cityTrackId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`✓ Updated ${filePath}`);
}

async function main() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Update SingleCityTrack.json
    const trackEntries = await updateSingleCityTrack();

    // Extract all cityTrackIds
    const cityTrackIds = new Set<number>();
    for (const entry of trackEntries) {
      for (const item of entry.list) {
        cityTrackIds.add(item.cityTrackId);
      }
    }

    console.log(`\nFound ${cityTrackIds.size} city tracks to update`);

    // Update each cityTrack data file
    for (const cityTrackId of Array.from(cityTrackIds).sort((a, b) => a - b)) {
      await updateCityTrackData(cityTrackId);
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n✓ All data files updated successfully!');
  } catch (error) {
    console.error('Error updating data:', error);
    process.exit(1);
  }
}

main();
