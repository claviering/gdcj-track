import { TransferSolution, DirectSolution } from "../types";
import { scenarioZhangmutoudongToKeyunlu } from "./scenarios/zhangmutoudongToKeyunlu";
import { scenarioZhuliaoToKeyunluTransfers, scenarioZhuliaoToKeyunluDirect } from "./scenarios/zhuliaoToKeyunlu";
import { scenarioXiaojinkouToBaiyunAirportSouth } from "./scenarios/xiaojinkouToBaiyunAirportSouth";
import { scenarioYinpingToChangpingnanTransfers, scenarioYinpingToChangpingnanDirect } from "./scenarios/yinpingToChangpingnan";

export type ScenarioCase = {
  name: string;
  start: string;
  end: string;
  departTime?: string;
  getExpectedDirect?: (dateLabel: string) => DirectSolution[];
  getExpectedTransfers: (dateLabel: string) => TransferSolution[];
};

export const scenarioCases: ScenarioCase[] = [
  {
    name: "樟木头东 -> 科韵路",
    start: "樟木头东",
    end: "科韵路",
    departTime: "07:00",
    getExpectedTransfers: scenarioZhangmutoudongToKeyunlu,
  },
  {
    name: "竹料 -> 科韵路",
    start: "竹料",
    end: "科韵路",
    departTime: "07:20",
    getExpectedDirect: scenarioZhuliaoToKeyunluDirect,
    getExpectedTransfers: scenarioZhuliaoToKeyunluTransfers,
  },
  {
    name: "小金口 -> 白云机场南",
    start: "小金口",
    end: "白云机场南",
    departTime: "07:00",
    getExpectedTransfers: scenarioXiaojinkouToBaiyunAirportSouth,
  },
  {
    name: "银瓶 -> 常平南",
    start: "银瓶",
    end: "常平南",
    getExpectedDirect: scenarioYinpingToChangpingnanDirect,
    getExpectedTransfers: scenarioYinpingToChangpingnanTransfers,
  },
];
