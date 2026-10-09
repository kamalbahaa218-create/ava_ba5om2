import { test } from "node:test";
import { strictEqual } from "node:assert";
import { unseenSections } from "./sections";
const u = [{ section: "content", updated_at: "2026-10-08T10:00:00Z" }];
test("never seen section is new", () => strictEqual(unseenSections(u, []).has("content"), true));
test("update after seen is new", () =>
  strictEqual(
    unseenSections(u, [{ section: "content", seen_at: "2026-10-08T09:00:00Z" }]).has("content"),
    true,
  ));
test("seen after update is not new", () =>
  strictEqual(
    unseenSections(u, [{ section: "content", seen_at: "2026-10-08T11:00:00Z" }]).has("content"),
    false,
  ));
