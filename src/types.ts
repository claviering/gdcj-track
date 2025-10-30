export type Station = {
  stationId: number;
  stationName: string;
  stationPosition: number;
};

export type TrainNumber = {
  trainNumberId: number;
  name: string;
};

export type StationArriveTime = {
  id: number;
  stationId: number;
  trainNumberId: number;
  arriveTime: string; // "HH:mm"
};

export type TrainTime = {
  trainNumber: TrainNumber;
  stationArriveTimeList: StationArriveTime[];
};

export type CityTrackFile = {
  body: {
    stationList: Station[];
    trainTimeList: TrainTime[];
  };
};

export type SingleCityTrackEntry = {
  trackName: string;
  list: Array<{
    cityTrackId: number;
    trackName: string;
    startStationName: string;
    endStationName: string;
  }>;
};

export type SingleCityTrackFile = {
  body: SingleCityTrackEntry[];
};

export type DirectSolution = {
  type: "direct";
  cityTrackId: number;
  trainName: string;
  startStation: string;
  endStation: string;
  departTime: string; // HH:mm
  arriveTime: string; // HH:mm
  dateLabel: string; // e.g., "10月15日"
  durationMinutes: number;
};

export type TransferLeg = {
  cityTrackId: number;
  trainName: string;
  fromStation: string;
  toStation: string;
  departTime: string;
  arriveTime: string;
  durationMinutes: number;
};

export type TransferSolution = {
  type: "transfer";
  transferStations: string[]; // Array of transfer station names
  legs: TransferLeg[]; // Array of legs (2 for one transfer, 3 for two transfers)
  waitMinutes: number[]; // Array of wait times between legs
  dateLabel: string;
  totalMinutes: number;
};

export type QueryResult = {
  start: string;
  end: string;
  direct: DirectSolution[];
  transfers: TransferSolution[];
  generatedAt: string; // ISO
};

export type CachedResult = QueryResult;
