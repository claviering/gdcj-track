import { TransferSolution, DirectSolution } from "../../types";

export function scenarioZhuliaoToKeyunluTransfers(dateLabel: string): TransferSolution[] {
  return [];
}

export function scenarioZhuliaoToKeyunluDirect(dateLabel: string): DirectSolution[] {
  return [
    {
      type: "direct",
      cityTrackId: 240,
      trainName: "S4731",
      startStation: "竹料",
      endStation: "科韵路",
      departTime: "07:29",
      arriveTime: "08:02",
      dateLabel,
      durationMinutes: 33,
    },
  ];
}
