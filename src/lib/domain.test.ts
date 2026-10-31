import assert from "node:assert/strict";
import test from "node:test";
import {
  applyColumnOrder,
  categorySuggestions,
  filtersAreActive,
  isYoungerThan,
  normalizeCategory,
  reorderTasks,
  resolveRole,
  taskMatchesFilter,
  timestampsAfterMove,
  type BoardTask,
} from "./domain";

const NOW = "2026-10-31T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function task(partial: Partial<BoardTask> & Pick<BoardTask, "id" | "column" | "position">): BoardTask {
  return {
    startedAt: null,
    completedAt: null,
    ...partial,
  };
}

test("a new move into In Progress sets the start time once", () => {
  const first = timestampsAfterMove({ startedAt: null, completedAt: null }, "in_progress", NOW);
  assert.equal(first.startedAt, NOW);
  assert.equal(first.completedAt, null);

  const again = timestampsAfterMove(
    { startedAt: "2026-10-01T00:00:00.000Z", completedAt: null },
    "in_progress",
    NOW,
  );
  assert.equal(again.startedAt, "2026-10-01T00:00:00.000Z");
});

test("Done sets completion and leaving Done clears it", () => {
  const done = timestampsAfterMove(
    { startedAt: "2026-10-01T00:00:00.000Z", completedAt: null },
    "done",
    NOW,
  );
  assert.equal(done.completedAt, NOW);
  assert.equal(done.startedAt, "2026-10-01T00:00:00.000Z");

  const back = timestampsAfterMove(done, "backlog", "2026-11-01T00:00:00.000Z");
  assert.equal(back.completedAt, null);
  assert.equal(back.startedAt, "2026-10-01T00:00:00.000Z");
});

test("moving straight to Done does not invent a start time", () => {
  const done = timestampsAfterMove({ startedAt: null, completedAt: null }, "done", NOW);
  assert.equal(done.startedAt, null);
  assert.equal(done.completedAt, NOW);
});

test("reorder within a column changes priority and keeps timestamps", () => {
  const tasks = [
    task({ id: "a", column: "backlog", position: 0, startedAt: "keep" }),
    task({ id: "b", column: "backlog", position: 1 }),
    task({ id: "c", column: "backlog", position: 2 }),
  ];
  const next = reorderTasks(tasks, "a", "c", NOW);
  assert.ok(next);
  const backlog = next.filter((item) => item.column === "backlog").sort((a, b) => a.position - b.position);
  assert.deepEqual(
    backlog.map((item) => item.id),
    ["b", "c", "a"],
  );
  assert.equal(backlog.find((item) => item.id === "a")?.startedAt, "keep");
});

test("moving across columns updates the automatic timestamps", () => {
  const tasks = [
    task({ id: "a", column: "backlog", position: 0 }),
    task({ id: "b", column: "in_progress", position: 0 }),
  ];
  const next = reorderTasks(tasks, "a", "column:in_progress", NOW);
  assert.ok(next);
  const moved = next.find((item) => item.id === "a");
  assert.equal(moved?.column, "in_progress");
  assert.equal(moved?.startedAt, NOW);
  assert.equal(moved?.position, 1);
});

test("saved column order is a full permutation and stamps first entry into In Progress", () => {
  const tasks = [
    task({ id: "a", column: "backlog", position: 0 }),
    task({ id: "b", column: "backlog", position: 1 }),
  ];
  const next = applyColumnOrder(
    tasks,
    { backlog: ["b"], in_progress: ["a"], done: [] },
    NOW,
  );
  const moved = next.find((item) => item.id === "a");
  assert.equal(moved?.column, "in_progress");
  assert.equal(moved?.startedAt, NOW);
  assert.equal(next.find((item) => item.id === "b")?.position, 0);
});

test("category suggestions are the names still in use", () => {
  assert.deepEqual(categorySuggestions(["Bug", " Bug ", "", null, "Idea"]), ["Bug", "Idea"]);
  assert.equal(normalizeCategory("  only   once  "), "only once");
});

test("filters combine and younger-than is strict", () => {
  const sample = {
    category: "Bug",
    creatorId: "ada",
    assigneeId: "nils",
    createdAt: "2026-10-30T12:00:00.000Z",
  };
  assert.equal(
    taskMatchesFilter(sample, { category: "Bug", creatorId: "ada", assigneeId: "nils", youngerThanDays: 2 }, NOW_MS),
    true,
  );
  assert.equal(taskMatchesFilter(sample, { assigneeId: "ada" }, NOW_MS), false);
  assert.equal(taskMatchesFilter({ ...sample, assigneeId: null }, { assigneeId: "nils" }, NOW_MS), false);
  assert.equal(taskMatchesFilter(sample, { category: "Idea" }, NOW_MS), false);
  assert.equal(isYoungerThan(sample.createdAt, 1, NOW_MS), false);
  assert.equal(filtersAreActive({}), false);
  assert.equal(filtersAreActive({ youngerThanDays: 3 }), true);
  assert.equal(filtersAreActive({ assigneeId: "nils" }), true);
});

test("access is owner, invite, public read, or none", () => {
  assert.equal(resolveRole({ userId: "a", ownerId: "a", memberRole: null, publicRead: false }), "owner");
  assert.equal(resolveRole({ userId: "b", ownerId: "a", memberRole: "edit", publicRead: false }), "edit");
  assert.equal(resolveRole({ userId: "c", ownerId: "a", memberRole: null, publicRead: true }), "read");
  assert.equal(resolveRole({ userId: "d", ownerId: "a", memberRole: null, publicRead: false }), null);
});
