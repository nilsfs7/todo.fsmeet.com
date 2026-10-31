import { randomUUID } from "node:crypto";
import type { Sql, SqlValue } from "./db";
import {
  applyColumnOrder,
  canComment,
  canEditTasks,
  canManageProject,
  canView,
  categorySuggestions,
  isEffort,
  LIMITS,
  normalizeCategory,
  resolveRole,
  type ColumnId,
  type Effort,
  type Role,
} from "./domain";
import type {
  AssigneeInput,
  CommentView,
  MemberView,
  ProjectListItem,
  ProjectView,
  TaskInput,
  TaskView,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail(error: string): Result<never> {
  return { ok: false, error };
}

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  picture: string | null;
  created_at: string;
};

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  public_read: number;
  created_at: string;
  owner_name: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  effort: Effort | null;
  category: string | null;
  column_name: ColumnId;
  position: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  assignee_id: string | null;
  creator_name: string;
  assignee_name: string | null;
};

type CommentRow = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  author_name: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

function personName(displayName: string | null, username: string): string {
  return displayName?.trim() || username;
}

function cleanText(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

function optionalText(value: string | null | undefined, max: number): string | null {
  const text = cleanText(value, max);
  return text || null;
}

export async function upsertUser(
  db: Sql,
  input: {
    id: string;
    username: string;
    displayName?: string | null;
    email?: string | null;
    picture?: string | null;
  },
): Promise<void> {
  const createdAt = nowIso();
  await db.run(
    `INSERT INTO users (id, username, display_name, email, picture, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       display_name = VALUES(display_name),
       email = VALUES(email),
       picture = VALUES(picture)`,
    [
      input.id,
      input.username,
      input.displayName ?? null,
      input.email ?? null,
      input.picture ?? null,
      createdAt,
    ],
  );
}

async function ensureUser(db: Sql, username: string): Promise<Result<UserRow>> {
  const name = cleanText(username, LIMITS.username);
  if (!name) return fail("Enter a FSMeet username.");
  const existing = await db.get<UserRow>("SELECT * FROM users WHERE id = ? OR username = ?", [name, name]);
  if (existing) return ok(existing);
  await upsertUser(db, { id: name, username: name, displayName: null });
  const created = await db.get<UserRow>("SELECT * FROM users WHERE id = ?", [name]);
  if (!created) return fail("Enter a FSMeet username.");
  return ok(created);
}

type AccessRow = {
  project: ProjectRow;
  role: Role;
};

async function loadAccess(db: Sql, projectId: string, userId: string): Promise<AccessRow | null> {
  const project = await db.get<ProjectRow>(
    `SELECT p.*, COALESCE(NULLIF(owner.display_name, ''), owner.username) AS owner_name
     FROM projects p
     JOIN users owner ON owner.id = p.owner_id
     WHERE p.id = ?`,
    [projectId],
  );
  if (!project) return null;
  const membership = await db.get<{ role: "read" | "edit" }>(
    "SELECT role FROM memberships WHERE project_id = ? AND user_id = ?",
    [projectId, userId],
  );
  const role = resolveRole({
    userId,
    ownerId: project.owner_id,
    memberRole: membership?.role ?? null,
    publicRead: Boolean(project.public_read),
  });
  if (!role || !canView(role)) return null;
  return { project, role };
}

function toProject(row: ProjectRow): ProjectView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    publicRead: Boolean(row.public_read),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
  };
}

export async function listVisibleProjects(
  db: Sql,
  userId: string,
): Promise<{ owned: ProjectListItem[]; shared: ProjectListItem[]; publicBoards: ProjectListItem[] }> {
  const ownedRows = await db.all<ProjectRow>(
    `SELECT p.*, COALESCE(NULLIF(owner.display_name, ''), owner.username) AS owner_name
     FROM projects p
     JOIN users owner ON owner.id = p.owner_id
     WHERE p.owner_id = ?
     ORDER BY p.created_at DESC`,
    [userId],
  );

  const sharedRows = await db.all<ProjectRow & { member_role: "read" | "edit" }>(
    `SELECT p.*, m.role AS member_role,
            COALESCE(NULLIF(owner.display_name, ''), owner.username) AS owner_name
     FROM projects p
     JOIN memberships m ON m.project_id = p.id
     JOIN users owner ON owner.id = p.owner_id
     WHERE m.user_id = ? AND p.owner_id != ?
     ORDER BY p.created_at DESC`,
    [userId, userId],
  );

  const publicRows = await db.all<ProjectRow>(
    `SELECT p.*, COALESCE(NULLIF(owner.display_name, ''), owner.username) AS owner_name
     FROM projects p
     JOIN users owner ON owner.id = p.owner_id
     WHERE p.public_read = 1
       AND p.owner_id != ?
       AND NOT EXISTS (
         SELECT 1 FROM memberships m WHERE m.project_id = p.id AND m.user_id = ?
       )
     ORDER BY p.created_at DESC`,
    [userId, userId],
  );

  return {
    owned: ownedRows.map((row) => ({ ...toProject(row), role: "owner" as const })),
    shared: sharedRows.map((row) => ({ ...toProject(row), role: row.member_role })),
    publicBoards: publicRows.map((row) => ({ ...toProject(row), role: "read" as const })),
  };
}

export async function createProject(
  db: Sql,
  userId: string,
  input: { title: string; description?: string | null },
): Promise<Result<string>> {
  const title = cleanText(input.title, LIMITS.title);
  if (!title) return fail("Title is required.");
  const id = randomUUID();
  await db.run(
    `INSERT INTO projects (id, title, description, owner_id, public_read, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, title, optionalText(input.description, LIMITS.description), userId, nowIso()],
  );
  return ok(id);
}

export async function updateProject(
  db: Sql,
  projectId: string,
  userId: string,
  input: { title: string; description?: string | null; publicRead: boolean },
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canManageProject(access.role)) return fail("Only the owner can change project settings.");
  const title = cleanText(input.title, LIMITS.title);
  if (!title) return fail("Title is required.");
  await db.run("UPDATE projects SET title = ?, description = ?, public_read = ? WHERE id = ?", [
    title,
    optionalText(input.description, LIMITS.description),
    input.publicRead ? 1 : 0,
    projectId,
  ]);
  return ok(undefined);
}

export async function deleteProject(db: Sql, projectId: string, userId: string): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canManageProject(access.role)) return fail("Only the owner can delete a project.");
  await db.run("DELETE FROM projects WHERE id = ?", [projectId]);
  return ok(undefined);
}

export async function listMembers(db: Sql, projectId: string, userId: string): Promise<Result<MemberView[]>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canManageProject(access.role)) return fail("Only the owner can manage invites.");
  const rows = await db.all<{
    user_id: string;
    username: string;
    display_name: string | null;
    role: "read" | "edit";
  }>(
    `SELECT u.id AS user_id, u.username, u.display_name, m.role
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.project_id = ?
     ORDER BY u.username`,
    [projectId],
  );
  return ok(
    rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      displayName: personName(row.display_name, row.username),
      role: row.role,
    })),
  );
}

export async function inviteMember(
  db: Sql,
  projectId: string,
  actorId: string,
  username: string,
  role: string,
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, actorId);
  if (!access) return fail("Project not found.");
  if (!canManageProject(access.role)) return fail("Only the owner can invite people.");
  if (role !== "read" && role !== "edit") return fail("Choose read or edit access.");
  const user = await ensureUser(db, username);
  if (!user.ok) return user;
  if (user.value.id === access.project.owner_id) return fail("That user already owns this project.");
  const existing = await db.get<{ role: string }>("SELECT role FROM memberships WHERE project_id = ? AND user_id = ?", [
    projectId,
    user.value.id,
  ]);
  if (existing) return fail("This user is already on the project. Change their access below.");
  await db.run("INSERT INTO memberships (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)", [
    projectId,
    user.value.id,
    role,
    nowIso(),
  ]);
  return ok(undefined);
}

export async function updateMemberRole(
  db: Sql,
  projectId: string,
  actorId: string,
  memberId: string,
  role: string,
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, actorId);
  if (!access) return fail("Project not found.");
  if (!canManageProject(access.role)) return fail("Only the owner can change access.");
  if (role !== "read" && role !== "edit") return fail("Choose read or edit access.");
  const result = await db.run("UPDATE memberships SET role = ? WHERE project_id = ? AND user_id = ?", [
    role,
    projectId,
    memberId,
  ]);
  if (result.changes === 0) {
    const existing = await db.get("SELECT user_id FROM memberships WHERE project_id = ? AND user_id = ?", [
      projectId,
      memberId,
    ]);
    if (!existing) return fail("That person is not on the project.");
  }
  return ok(undefined);
}

export async function removeMember(
  db: Sql,
  projectId: string,
  actorId: string,
  memberId: string,
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, actorId);
  if (!access) return fail("Project not found.");
  if (!canManageProject(access.role)) return fail("Only the owner can remove people.");
  await db.run("DELETE FROM memberships WHERE project_id = ? AND user_id = ?", [projectId, memberId]);
  return ok(undefined);
}

function loadTaskRows(db: Sql, projectId: string): Promise<TaskRow[]> {
  return db.all<TaskRow>(
    `SELECT t.*,
            COALESCE(NULLIF(u.display_name, ''), u.username) AS creator_name,
            COALESCE(NULLIF(a.display_name, ''), a.username) AS assignee_name
     FROM tasks t
     JOIN users u ON u.id = t.creator_id
     LEFT JOIN users a ON a.id = t.assignee_id
     WHERE t.project_id = ?
     ORDER BY t.position ASC, t.created_at ASC`,
    [projectId],
  );
}

function loadCommentRows(db: Sql, projectId: string): Promise<CommentRow[]> {
  return db.all<CommentRow>(
    `SELECT c.*, COALESCE(NULLIF(u.display_name, ''), u.username) AS author_name
     FROM comments c
     JOIN tasks t ON t.id = c.task_id
     JOIN users u ON u.id = c.author_id
     WHERE t.project_id = ?
     ORDER BY c.created_at ASC`,
    [projectId],
  );
}

function toComment(row: CommentRow): CommentView {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorId: row.author_id,
    authorName: row.author_name,
  };
}

function toTask(row: TaskRow, comments: CommentView[]): TaskView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    effort: row.effort,
    category: row.category,
    column: row.column_name,
    position: Number(row.position),
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_id ? row.assignee_name : null,
    comments,
  };
}

async function rememberAssignee(db: Sql, assignee: AssigneeInput): Promise<Result<string>> {
  const id = cleanText(assignee.id, LIMITS.username);
  const username = cleanText(assignee.username, LIMITS.username);
  if (!id || id !== username) return fail("Choose a person.");
  await db.run(
    `INSERT INTO users (id, username, display_name, email, picture, created_at)
     VALUES (?, ?, ?, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       display_name = COALESCE(VALUES(display_name), display_name),
       picture = COALESCE(VALUES(picture), picture)`,
    [id, username, optionalText(assignee.displayName, LIMITS.title), assignee.picture ?? null, nowIso()],
  );
  return ok(id);
}

async function resolveAssignee(
  db: Sql,
  assignee: TaskInput["assignee"],
): Promise<Result<string | null | undefined>> {
  if (assignee === undefined) return ok(undefined);
  if (assignee === null) return ok(null);
  return rememberAssignee(db, assignee);
}

export async function getBoard(
  db: Sql,
  projectId: string,
  userId: string,
): Promise<{ project: ProjectView; role: Role; tasks: TaskView[]; categories: string[] } | null> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return null;
  const commentsByTask = new Map<string, CommentView[]>();
  for (const row of await loadCommentRows(db, projectId)) {
    const list = commentsByTask.get(row.task_id) ?? [];
    list.push(toComment(row));
    commentsByTask.set(row.task_id, list);
  }
  const tasks = (await loadTaskRows(db, projectId)).map((row) => toTask(row, commentsByTask.get(row.id) ?? []));
  return {
    project: toProject(access.project),
    role: access.role,
    tasks,
    categories: categorySuggestions(tasks.map((task) => task.category)),
  };
}

function parseEffort(value: string | null | undefined): Result<Effort | null> {
  const raw = (value ?? "").trim();
  if (!raw) return ok(null);
  if (!isEffort(raw)) return fail("Choose a t-shirt size.");
  return ok(raw);
}

function parseTaskInput(input: TaskInput): Result<{
  title: string;
  description: string | null;
  effort: Effort | null;
  category: string | null;
}> {
  const title = cleanText(input.title, LIMITS.title);
  if (!title) return fail("Title is required.");
  const effort = parseEffort(input.effort);
  if (!effort.ok) return effort;
  return ok({
    title,
    description: optionalText(input.description, LIMITS.description),
    effort: effort.value,
    category: normalizeCategory(input.category),
  });
}

export async function createTask(
  db: Sql,
  projectId: string,
  userId: string,
  input: TaskInput,
): Promise<Result<string>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canEditTasks(access.role)) return fail("You can view this board, but not change tasks.");
  const parsed = parseTaskInput(input);
  if (!parsed.ok) return parsed;
  const assignee = await resolveAssignee(db, input.assignee);
  if (!assignee.ok) return assignee;
  const positionRow = await db.get<{ max_position: number }>(
    "SELECT COALESCE(MAX(position), -1) AS max_position FROM tasks WHERE project_id = ? AND column_name = 'backlog'",
    [projectId],
  );
  const id = randomUUID();
  await db.run(
    `INSERT INTO tasks (
       id, project_id, creator_id, title, description, effort, category,
       column_name, position, created_at, started_at, completed_at, assignee_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'backlog', ?, ?, NULL, NULL, ?)`,
    [
      id,
      projectId,
      userId,
      parsed.value.title,
      parsed.value.description,
      parsed.value.effort,
      parsed.value.category,
      Number(positionRow?.max_position ?? -1) + 1,
      nowIso(),
      assignee.value ?? null,
    ],
  );
  return ok(id);
}

export async function updateTask(
  db: Sql,
  projectId: string,
  userId: string,
  taskId: string,
  input: TaskInput,
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canEditTasks(access.role)) return fail("You can view this board, but not change tasks.");
  const parsed = parseTaskInput(input);
  if (!parsed.ok) return parsed;
  const assignee = await resolveAssignee(db, input.assignee);
  if (!assignee.ok) return assignee;
  const fields = ["title = ?", "description = ?", "effort = ?", "category = ?"];
  const values: SqlValue[] = [
    parsed.value.title,
    parsed.value.description,
    parsed.value.effort,
    parsed.value.category,
  ];
  if (assignee.value !== undefined) {
    fields.push("assignee_id = ?");
    values.push(assignee.value);
  }
  const result = await db.run(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ? AND project_id = ?`, [
    ...values,
    taskId,
    projectId,
  ]);
  if (result.changes === 0) {
    const existing = await db.get("SELECT id FROM tasks WHERE id = ? AND project_id = ?", [taskId, projectId]);
    if (!existing) return fail("Task not found.");
  }
  return ok(undefined);
}

export async function deleteTask(db: Sql, projectId: string, userId: string, taskId: string): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canEditTasks(access.role)) return fail("You can view this board, but not change tasks.");
  const result = await db.run("DELETE FROM tasks WHERE id = ? AND project_id = ?", [taskId, projectId]);
  if (result.changes === 0) return fail("Task not found.");
  return ok(undefined);
}

export async function saveTaskOrder(
  db: Sql,
  projectId: string,
  userId: string,
  order: Record<ColumnId, string[]>,
  now = nowIso(),
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canEditTasks(access.role)) return fail("You can view this board, but not move tasks.");
  try {
    await db.transaction(async () => {
      const rows = (await loadTaskRows(db, projectId)).map((row) => ({
        ...row,
        column: row.column_name,
        position: Number(row.position),
        startedAt: row.started_at,
        completedAt: row.completed_at,
      }));
      const next = applyColumnOrder(rows, order, now);
      for (const task of next) {
        await db.run(
          `UPDATE tasks
           SET column_name = ?, position = ?, started_at = ?, completed_at = ?
           WHERE id = ? AND project_id = ?`,
          [task.column, task.position, task.startedAt, task.completedAt, task.id, projectId],
        );
      }
    });
  } catch {
    return fail("Could not save the new order.");
  }
  return ok(undefined);
}

export async function addComment(
  db: Sql,
  projectId: string,
  userId: string,
  taskId: string,
  body: string,
): Promise<Result<string>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  if (!canComment(access.role)) return fail("You cannot comment on this task.");
  const text = cleanText(body, LIMITS.comment);
  if (!text) return fail("Write a comment first.");
  const task = await db.get("SELECT id FROM tasks WHERE id = ? AND project_id = ?", [taskId, projectId]);
  if (!task) return fail("Task not found.");
  const id = randomUUID();
  await db.run(
    "INSERT INTO comments (id, task_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL)",
    [id, taskId, userId, text, nowIso()],
  );
  return ok(id);
}

export async function updateComment(
  db: Sql,
  projectId: string,
  userId: string,
  commentId: string,
  body: string,
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  const text = cleanText(body, LIMITS.comment);
  if (!text) return fail("Write a comment first.");
  const comment = await db.get<{ author_id: string }>(
    `SELECT c.author_id
     FROM comments c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.id = ? AND t.project_id = ?`,
    [commentId, projectId],
  );
  if (!comment) return fail("Comment not found.");
  if (comment.author_id !== userId) return fail("You can only edit your own comments.");
  await db.run("UPDATE comments SET body = ?, updated_at = ? WHERE id = ?", [text, nowIso(), commentId]);
  return ok(undefined);
}

export async function deleteComment(
  db: Sql,
  projectId: string,
  userId: string,
  commentId: string,
): Promise<Result<void>> {
  const access = await loadAccess(db, projectId, userId);
  if (!access) return fail("Project not found.");
  const comment = await db.get<{ author_id: string }>(
    `SELECT c.author_id
     FROM comments c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.id = ? AND t.project_id = ?`,
    [commentId, projectId],
  );
  if (!comment) return fail("Comment not found.");
  if (comment.author_id !== userId) return fail("You can only delete your own comments.");
  await db.run("DELETE FROM comments WHERE id = ?", [commentId]);
  return ok(undefined);
}
