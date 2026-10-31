"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addComment,
  createProject,
  createTask,
  deleteComment,
  deleteProject,
  deleteTask,
  inviteMember,
  removeMember,
  saveTaskOrder,
  updateComment,
  updateMemberRole,
  updateProject,
  updateTask,
} from "./data";
import { lookupDirectoryUser } from "./directory";
import { getDb } from "./db";
import type { ColumnId } from "./domain";
import { readSession } from "./session";
import type { TaskInput } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function userId(): Promise<string> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session.sub;
}

function done(path: string): ActionResult {
  revalidatePath(path);
  revalidatePath("/projects");
  return { ok: true };
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const actor = await userId();
  const result = await createProject(getDb(), actor, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!result.ok) redirect(`/projects/new?error=${encodeURIComponent(result.error)}`);
  redirect(`/projects/${result.value}`);
}

export async function updateProjectAction(formData: FormData): Promise<void> {
  const actor = await userId();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await updateProject(getDb(), projectId, actor, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    publicRead: formData.get("publicRead") === "on",
  });
  const target = `/projects/${projectId}/settings`;
  if (!result.ok) redirect(`${target}?error=${encodeURIComponent(result.error)}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(target);
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const actor = await userId();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await deleteProject(getDb(), projectId, actor);
  if (!result.ok) redirect(`/projects/${projectId}/settings?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function inviteMemberAction(formData: FormData): Promise<void> {
  const actor = await userId();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await inviteMember(
    getDb(),
    projectId,
    actor,
    String(formData.get("username") ?? ""),
    String(formData.get("role") ?? ""),
  );
  const target = `/projects/${projectId}/settings`;
  if (!result.ok) redirect(`${target}?error=${encodeURIComponent(result.error)}`);
  revalidatePath(`/projects/${projectId}`);
  redirect(target);
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const actor = await userId();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await updateMemberRole(
    getDb(),
    projectId,
    actor,
    String(formData.get("memberId") ?? ""),
    String(formData.get("role") ?? ""),
  );
  const target = `/projects/${projectId}/settings`;
  if (!result.ok) redirect(`${target}?error=${encodeURIComponent(result.error)}`);
  revalidatePath(`/projects/${projectId}`);
  redirect(target);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const actor = await userId();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await removeMember(getDb(), projectId, actor, String(formData.get("memberId") ?? ""));
  const target = `/projects/${projectId}/settings`;
  if (!result.ok) redirect(`${target}?error=${encodeURIComponent(result.error)}`);
  revalidatePath(`/projects/${projectId}`);
  redirect(target);
}

type TaskDraft = {
  title: string;
  description?: string | null;
  effort?: string | null;
  category?: string | null;
  assigneeId?: string | null;
};

async function taskInput(draft: TaskDraft): Promise<{ ok: true; input: TaskInput } | { ok: false; error: string }> {
  const assigneeId = (draft.assigneeId ?? "").trim();
  const base = {
    title: draft.title,
    description: draft.description,
    effort: draft.effort,
    category: draft.category,
  };
  if (!assigneeId) return { ok: true, input: { ...base, assignee: null } };
  const found = await lookupDirectoryUser(assigneeId);
  if (!found.ok) return found;
  return {
    ok: true,
    input: {
      ...base,
      assignee: {
        id: found.person.id,
        username: found.person.username,
        displayName: found.person.name,
        picture: found.person.picture,
      },
    },
  };
}

export async function createTaskAction(projectId: string, draft: TaskDraft): Promise<ActionResult> {
  const actor = await userId();
  const input = await taskInput(draft);
  if (!input.ok) return input;
  const result = await createTask(getDb(), projectId, actor, input.input);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  draft: TaskDraft,
): Promise<ActionResult> {
  const actor = await userId();
  const input = await taskInput(draft);
  if (!input.ok) return input;
  const result = await updateTask(getDb(), projectId, actor, taskId, input.input);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}

export async function deleteTaskAction(projectId: string, taskId: string): Promise<ActionResult> {
  const actor = await userId();
  const result = await deleteTask(getDb(), projectId, actor, taskId);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}

export async function saveTaskOrderAction(
  projectId: string,
  order: Record<ColumnId, string[]>,
): Promise<ActionResult> {
  const actor = await userId();
  const result = await saveTaskOrder(getDb(), projectId, actor, order);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}

export async function addCommentAction(
  projectId: string,
  taskId: string,
  body: string,
): Promise<ActionResult> {
  const actor = await userId();
  const result = await addComment(getDb(), projectId, actor, taskId, body);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}

export async function updateCommentAction(
  projectId: string,
  commentId: string,
  body: string,
): Promise<ActionResult> {
  const actor = await userId();
  const result = await updateComment(getDb(), projectId, actor, commentId, body);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}

export async function deleteCommentAction(projectId: string, commentId: string): Promise<ActionResult> {
  const actor = await userId();
  const result = await deleteComment(getDb(), projectId, actor, commentId);
  if (!result.ok) return result;
  return done(`/projects/${projectId}`);
}
