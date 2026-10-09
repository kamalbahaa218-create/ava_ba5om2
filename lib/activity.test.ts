import { describe, test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { historyPreview, journeyStates, readFullHistory } from "./activity";

describe("activity history", () => {
  test("shows only latest 2 activities initially", () => {
    deepStrictEqual(historyPreview([5, 4, 3, 2, 1], false), [5, 4]);
  });
  test("view more exposes full history", () => {
    deepStrictEqual(historyPreview([5, 4, 3, 2, 1], true), [5, 4, 3, 2, 1]);
  });
  test("full history includes rows beyond one page", async () => {
    const rows = Array.from({ length: 1005 }, (_, i) => i);
    deepStrictEqual(
      await readFullHistory(async (from, to) => ({ data: rows.slice(from, to + 1), error: null })),
      rows,
    );
  });
});
describe("scheduled journey", () => {
  const steps = ["16:00:00", "16:15:00", "16:30:00"].map((startTime) => ({
    programDate: "2026-10-08",
    startTime,
  }));
  test("before start all checkpoints remain pending", () => {
    deepStrictEqual(journeyStates(steps, new Date("2026-10-08T12:59:59Z")), [
      "pending",
      "pending",
      "pending",
    ]);
  });
  test("activates at exact Cairo scheduled time", () => {
    deepStrictEqual(journeyStates(steps, new Date("2026-10-08T13:00:00Z")), [
      "active",
      "pending",
      "pending",
    ]);
  });
  test("completes previous step when next begins", () => {
    deepStrictEqual(journeyStates(steps, new Date("2026-10-08T13:15:00Z")), [
      "completed",
      "active",
      "pending",
    ]);
  });
  test("past programs completed and future programs pending", () => {
    deepStrictEqual(journeyStates(steps, new Date("2026-10-09T13:15:00Z")), [
      "completed",
      "completed",
      "completed",
    ]);
    deepStrictEqual(journeyStates(steps, new Date("2026-10-07T13:15:00Z")), [
      "pending",
      "pending",
      "pending",
    ]);
  });
  test("missing schedule never loops or invents an active step", () => {
    deepStrictEqual(journeyStates([{}], new Date("2026-10-08T13:15:00Z")), ["pending"]);
  });
});
