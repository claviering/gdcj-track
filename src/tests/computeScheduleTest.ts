import { strict as assert } from "node:assert";
import { loadAllData } from "../dataLoader";
import { computeSchedule } from "../schedule";
import { TransferSolution, DirectSolution } from "../types";
import { todayMonthDayLabel } from "../utils";
import { scenarioCases } from "./expectedTransfers";

function sortTransfers(transfers: TransferSolution[]): TransferSolution[] {
  return [...transfers]
    .map((item) => JSON.parse(JSON.stringify(item)) as TransferSolution)
    .sort((a, b) => {
      const keyA = `${a.legs[0].trainName}|${a.legs[0].fromStation}|${a.transferStations.join('|')}|${a.legs[a.legs.length - 1].trainName}|${a.legs[a.legs.length - 1].departTime}`;
      const keyB = `${b.legs[0].trainName}|${b.legs[0].fromStation}|${b.transferStations.join('|')}|${b.legs[b.legs.length - 1].trainName}|${b.legs[b.legs.length - 1].departTime}`;
      return keyA.localeCompare(keyB);
    });
}

function sortDirect(direct: DirectSolution[]): DirectSolution[] {
  return [...direct]
    .map((item) => JSON.parse(JSON.stringify(item)) as DirectSolution)
    .sort((a, b) => {
      const keyA = `${a.trainName}|${a.departTime}|${a.arriveTime}`;
      const keyB = `${b.trainName}|${b.departTime}|${b.arriveTime}`;
      return keyA.localeCompare(keyB);
    });
}

async function main() {
  const store = await loadAllData(process.cwd());
  const dateLabel = todayMonthDayLabel();

  for (const scenario of scenarioCases) {
    const expectedTransfers = scenario.getExpectedTransfers(dateLabel);
    const expectedDirect = scenario.getExpectedDirect ? scenario.getExpectedDirect(dateLabel) : [];
    const result = computeSchedule(store, scenario.start, scenario.end, scenario.departTime ?? undefined);

    assert.equal(result.start, scenario.start, `Unexpected start station in ${scenario.name} result.`);
    assert.equal(result.end, scenario.end, `Unexpected end station in ${scenario.name} result.`);

    // Check direct solutions
    const sortedActualDirect = sortDirect(result.direct);
    const sortedExpectedDirect = sortDirect(expectedDirect);
    assert.deepStrictEqual(sortedActualDirect, sortedExpectedDirect, `Direct solutions did not match expected output for ${scenario.name}.`);

    // Check transfer solutions
    const sortedActual = sortTransfers(result.transfers);
    const sortedExpected = sortTransfers(expectedTransfers);

    assert.deepStrictEqual(sortedActual, sortedExpected, `Transfer solutions did not match expected output for ${scenario.name}.`);

    assert.ok(
      typeof result.generatedAt === "string" && !Number.isNaN(Date.parse(result.generatedAt)),
      `${scenario.name} generatedAt should be a valid ISO timestamp.`
    );

    console.log(
      `[SCENARIO] ${scenario.name}: ${result.direct.length} direct + ${result.transfers.length} transfer solutions matched expected output.`
    );
  }

  console.log("All computeSchedule tests passed.");
}

main().catch((error) => {
  console.error("computeSchedule test failed:", error);
  process.exit(1);
});
