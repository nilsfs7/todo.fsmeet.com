import assert from "node:assert/strict";
import test from "node:test";
import {
  addComment,
  createProject,
  createTask,
  deleteComment,
  getBoard,
  inviteMember,
  listVisibleProjects,
  saveTaskOrder,
  updateComment,
  updateProject,
  updateTask,
  upsertUser,
} from "./data";
import { isAssignableUserType, personLabel } from "./directory";
import { openTestDatabase, type Sql } from "./db";

async function fixture(): Promise<{
  db: Sql;
  projectOf: (userId: string, title: string) => Promise<string>;
}> {
  const db = await openTestDatabase();
  await upsertUser(db, { id: "ada", username: "ada", displayName: "Ada" });
  await upsertUser(db, { id: "bea", username: "bea", displayName: "Bea" });
  const projectOf = async (userId: string, title: string) => {
    const created = await createProject(db, userId, { title });
    if (!created.ok) throw new Error(created.error);
    return created.value;
  };
  return { db, projectOf };
}

test("tasks start in Backlog and categories stay inside the project", async () => {
  const { db, projectOf } = await fixture();
  try {
    const project = await projectOf("ada", "Board");
    const other = await projectOf("ada", "Other");

    assert.equal((await createTask(db, project, "ada", { title: "Write spec", category: "Docs" })).ok, true);
    assert.equal((await createTask(db, project, "ada", { title: "Fix bug", category: "Docs" })).ok, true);

    const board = await getBoard(db, project, "ada");
    assert.ok(board);
    assert.deepEqual(
      board.tasks.map((task) => [task.column, task.position]),
      [
        ["backlog", 0],
        ["backlog", 1],
      ],
    );

    const only = await createTask(db, project, "ada", { title: "Unique", category: "Bug" });
    assert.equal(only.ok, true);
    if (!only.ok) return;
    await updateTask(db, project, "ada", only.value, { title: "Unique", category: "Defect" });
    const names = (await getBoard(db, project, "ada"))?.categories ?? [];
    assert.equal(names.includes("Bug"), false);
    assert.equal(names.includes("Defect"), true);
    assert.equal(names.includes("Docs"), true);

    const docsTask = (await getBoard(db, project, "ada"))?.tasks.find((task) => task.category === "Docs");
    assert.ok(docsTask);
    await updateTask(db, project, "ada", docsTask.id, { title: docsTask.title, category: "" });
    const remainingDocs = (await getBoard(db, project, "ada"))?.tasks.filter((task) => task.category === "Docs") ?? [];
    assert.equal(remainingDocs.length, 1);

    await updateTask(db, project, "ada", remainingDocs[0]!.id, { title: remainingDocs[0]!.title, category: "" });
    assert.equal((await getBoard(db, project, "ada"))?.categories.includes("Docs"), false);

    await createTask(db, other, "ada", { title: "Elsewhere", category: "Secret" });
    assert.equal((await getBoard(db, project, "ada"))?.categories.includes("Secret"), false);
    assert.deepEqual((await getBoard(db, other, "ada"))?.categories, ["Secret"]);
  } finally {
    await db.close();
  }
});

test("column moves stamp start and completion times", async () => {
  const { db, projectOf } = await fixture();
  try {
    const project = await projectOf("ada", "Flow");
    const created = await createTask(db, project, "ada", { title: "Ship it" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const now = "2026-10-31T15:00:00.000Z";

    assert.equal(
      (
        await saveTaskOrder(db, project, "ada", { backlog: [], in_progress: [created.value], done: [] }, now)
      ).ok,
      true,
    );
    let task = (await getBoard(db, project, "ada"))?.tasks[0];
    assert.equal(task?.column, "in_progress");
    assert.equal(task?.startedAt, now);
    assert.equal(task?.completedAt, null);

    const later = "2026-10-31T16:00:00.000Z";
    await saveTaskOrder(db, project, "ada", { backlog: [], in_progress: [], done: [created.value] }, later);
    task = (await getBoard(db, project, "ada"))?.tasks[0];
    assert.equal(task?.startedAt, now);
    assert.equal(task?.completedAt, later);

    await saveTaskOrder(
      db,
      project,
      "ada",
      { backlog: [created.value], in_progress: [], done: [] },
      "2026-10-31T17:00:00.000Z",
    );
    task = (await getBoard(db, project, "ada"))?.tasks[0];
    assert.equal(task?.column, "backlog");
    assert.equal(task?.startedAt, now);
    assert.equal(task?.completedAt, null);
  } finally {
    await db.close();
  }
});

test("a task can be assigned to a person and unassigned again", async () => {
  const { db, projectOf } = await fixture();
  try {
    const project = await projectOf("ada", "Crew");
    const created = await createTask(db, project, "ada", {
      title: "Hang lights",
      assignee: { id: "nils", username: "nils", displayName: "Nille", picture: null },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    let task = (await getBoard(db, project, "ada"))?.tasks[0];
    assert.equal(task?.assigneeId, "nils");
    assert.equal(task?.assigneeName, "Nille");

    await updateTask(db, project, "ada", created.value, { title: "Hang lights", category: "Stage" });
    task = (await getBoard(db, project, "ada"))?.tasks[0];
    assert.equal(task?.assigneeId, "nils");
    assert.equal(task?.category, "Stage");

    assert.equal((await updateTask(db, project, "ada", created.value, { title: "Hang lights", assignee: null })).ok, true);
    task = (await getBoard(db, project, "ada"))?.tasks[0];
    assert.equal(task?.assigneeId, null);
    assert.equal(task?.assigneeName, null);

    assert.equal((await inviteMember(db, project, "ada", "bea", "read")).ok, true);
    assert.equal(
      (
        await updateTask(db, project, "bea", created.value, {
          title: "Hang lights",
          assignee: { id: "c1", username: "c1", displayName: "Sera Knapp", picture: null },
        })
      ).ok,
      false,
    );
  } finally {
    await db.close();
  }
});

test("directory names prefer a nickname, then a full name", () => {
  assert.equal(personLabel({ username: "nils", nickName: "Nille", firstName: "Nils", lastName: "Effinghausen" }), "Nille");
  assert.equal(personLabel({ username: "c1", nickName: "", firstName: "Sera", lastName: "Knapp" }), "Sera Knapp");
  assert.equal(personLabel({ username: "wffa", nickName: null, firstName: null, lastName: null }), "wffa");
  assert.equal(isAssignableUserType("freestyler"), true);
  assert.equal(isAssignableUserType("ADMINISTRATIVE"), false);
  assert.equal(isAssignableUserType("fan"), false);
  assert.equal(isAssignableUserType(undefined), true);
});

test("invites, public read, and comments follow the access rules", async () => {
  const { db, projectOf } = await fixture();
  try {
    const project = await projectOf("ada", "Shared");
    const created = await createTask(db, project, "ada", { title: "Look" });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    assert.equal(await getBoard(db, project, "bea"), null);
    assert.equal((await inviteMember(db, project, "ada", "bea", "read")).ok, true);
    assert.equal((await getBoard(db, project, "bea"))?.role, "read");
    assert.equal(
      (await saveTaskOrder(db, project, "bea", { backlog: [], in_progress: [created.value], done: [] })).ok,
      false,
    );

    const comment = await addComment(db, project, "bea", created.value, "I can discuss this.");
    assert.equal(comment.ok, true);
    if (!comment.ok) return;
    assert.equal((await updateComment(db, project, "ada", comment.value, "Nope")).ok, false);
    assert.equal((await updateComment(db, project, "bea", comment.value, "Edited")).ok, true);
    assert.equal((await deleteComment(db, project, "ada", comment.value)).ok, false);
    assert.equal((await deleteComment(db, project, "bea", comment.value)).ok, true);

    assert.equal((await updateProject(db, project, "ada", { title: "Shared", publicRead: true })).ok, true);
    await upsertUser(db, { id: "cy", username: "cy", displayName: "Cy" });
    assert.equal((await getBoard(db, project, "cy"))?.role, "read");
    const visible = await listVisibleProjects(db, "cy");
    assert.equal(visible.publicBoards.some((item) => item.id === project), true);
    assert.equal(visible.owned.length, 0);
  } finally {
    await db.close();
  }
});
