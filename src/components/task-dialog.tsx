"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addCommentAction,
  createTaskAction,
  deleteCommentAction,
  deleteTaskAction,
  updateCommentAction,
  updateTaskAction,
} from "@/lib/actions";
import { EFFORTS, EFFORT_LABELS, type Effort } from "@/lib/domain";
import type { DirectoryPerson } from "@/lib/directory";
import type { TaskView } from "@/lib/types";
import { LocalTime } from "./local-time";
import { dangerButtonClass, fieldClass, primaryButtonClass, quietButtonClass } from "./ui";
import { SelectField, SuggestField } from "./select-field";

type Mode = { type: "create" } | { type: "edit"; task: TaskView };

export function TaskDialog({
  projectId,
  mode,
  suggestions,
  canEditTasks,
  currentUserId,
  people,
  peopleError,
  onClose,
}: {
  projectId: string;
  mode: Mode | null;
  suggestions: string[];
  canEditTasks: boolean;
  currentUserId: string;
  people: DirectoryPerson[];
  peopleError: string | null;
  onClose: () => void;
}) {
  const ref = useDialog(mode !== null);

  return (
    <dialog
      ref={ref}
      className="task-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {mode ? (
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">{mode.type === "create" ? "New task" : "Task"}</h2>
          <button type="button" className={quietButtonClass} onClick={onClose}>
            Close
          </button>
        </div>
        <TaskForm
          key={mode.type === "edit" ? mode.task.id : "new"}
          projectId={projectId}
          mode={mode}
          suggestions={suggestions}
          canEditTasks={canEditTasks}
          people={people}
          peopleError={peopleError}
          onClose={onClose}
        />
        {mode.type === "edit" ? (
          <Comments
            projectId={projectId}
            task={mode.task}
            currentUserId={currentUserId}
          />
        ) : null}
      </div>
      ) : null}
    </dialog>
  );
}

function useDialog(open: boolean) {
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
    return () => {
      if (node.open) node.close();
    };
  }, [node, open]);
  return setNode;
}

function TaskForm({
  projectId,
  mode,
  suggestions,
  canEditTasks,
  people,
  peopleError,
  onClose,
}: {
  projectId: string;
  mode: Mode;
  suggestions: string[];
  canEditTasks: boolean;
  people: DirectoryPerson[];
  peopleError: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const task = mode.type === "edit" ? mode.task : null;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const locked = mode.type === "edit" && !canEditTasks;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      effort: String(form.get("effort") ?? ""),
      category: String(form.get("category") ?? ""),
      assigneeId: String(form.get("assignee") ?? ""),
    };
    setPending(true);
    const result =
      mode.type === "create"
        ? await createTaskAction(projectId, input)
        : await updateTaskAction(projectId, task!.id, input);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    if (mode.type === "create") onClose();
  }

  async function onDelete() {
    if (!task || !window.confirm("Delete this task?")) return;
    setPending(true);
    const result = await deleteTaskAction(projectId, task.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input name="title" required maxLength={200} defaultValue={task?.title ?? ""} disabled={locked} className={fieldClass} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={task?.description ?? ""}
          disabled={locked}
          className={fieldClass}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Effort</span>
          <SelectField
            name="effort"
            defaultValue={task?.effort ?? ""}
            disabled={locked}
            options={[
              { value: "", label: "No estimate" },
              ...EFFORTS.map((effort) => ({ value: effort, label: EFFORT_LABELS[effort] })),
            ]}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Category</span>
          <SuggestField
            name="category"
            maxLength={80}
            defaultValue={task?.category ?? ""}
            disabled={locked}
            placeholder="Type or pick one"
            suggestions={suggestions}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Assigned to</span>
        <SelectField
          name="assignee"
          defaultValue={task?.assigneeId ?? ""}
          disabled={locked}
          options={[
            { value: "", label: "Unassigned" },
            ...assigneeOptions(people, task).map((person) => ({
              value: person.id,
              label: person.name === person.username ? person.username : `${person.name} (${person.username})`,
            })),
          ]}
        />
        {peopleError ? <span className="mt-1 block text-xs text-danger">{peopleError}</span> : null}
      </label>
      {mode.type === "create" ? (
        <p className="text-xs text-muted">New tasks are added to Backlog. Categories already used in this project are suggested.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-paper px-3 py-2 text-xs text-muted">
          <div>
            <dt>Creator</dt>
            <dd className="text-ink">{task?.creatorName}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd className="text-ink">
              <LocalTime iso={task?.createdAt ?? null} />
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd className="text-ink">
              <LocalTime iso={task?.startedAt ?? null} />
            </dd>
          </div>
          <div>
            <dt>Finished</dt>
            <dd className="text-ink">
              <LocalTime iso={task?.completedAt ?? null} />
            </dd>
          </div>
        </dl>
      )}
      {locked ? null : (
        <div className="flex items-center justify-between gap-3 pt-1">
          {task ? (
            <button type="button" className={dangerButtonClass} onClick={onDelete} disabled={pending}>
              Delete task
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={primaryButtonClass} disabled={pending}>
            {pending ? "Saving…" : mode.type === "create" ? "Create task" : "Save task"}
          </button>
        </div>
      )}
    </form>
  );
}

function assigneeOptions(
  people: DirectoryPerson[],
  task: TaskView | null,
): Array<Pick<DirectoryPerson, "id" | "username" | "name">> {
  if (!task?.assigneeId || people.some((person) => person.id === task.assigneeId)) return people;
  return [
    { id: task.assigneeId, username: task.assigneeId, name: task.assigneeName || task.assigneeId },
    ...people,
  ];
}

function Comments({
  projectId,
  task,
  currentUserId,
}: {
  projectId: string;
  task: TaskView;
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await addCommentAction(projectId, task.id, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setError(null);
    router.refresh();
  }

  return (
    <section className="mt-6 border-t border-line pt-4">
      <h3 className="mb-3 text-sm font-semibold">Comments</h3>
      <ul className="space-y-3">
        {task.comments.length === 0 ? <li className="text-sm text-muted">No comments yet.</li> : null}
        {task.comments.map((comment) => (
          <li key={comment.id} className="rounded-lg border border-line bg-white px-3 py-2">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted">
              <span className="font-medium text-ink">{comment.authorName}</span>
              <span>
                <LocalTime iso={comment.createdAt} />
                {comment.updatedAt ? " · edited" : ""}
              </span>
            </div>
            {editingId === comment.id ? (
              <CommentEditor
                initial={comment.body}
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  const result = await updateCommentAction(projectId, comment.id, next);
                  if (!result.ok) return result.error;
                  setEditingId(null);
                  router.refresh();
                  return null;
                }}
              />
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                {comment.authorId === currentUserId ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="text-xs text-navy" onClick={() => setEditingId(comment.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={async () => {
                        if (!window.confirm("Delete this comment?")) return;
                        const result = await deleteCommentAction(projectId, comment.id);
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        router.refresh();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={onAdd} className="mt-3 space-y-2">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Add a comment"
          className={fieldClass}
        />
        <button type="submit" className={primaryButtonClass} disabled={pending}>
          {pending ? "Saving…" : "Add comment"}
        </button>
      </form>
    </section>
  );
}

function CommentEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (body: string) => Promise<string | null>;
}) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const message = await onSave(body);
        setPending(false);
        setError(message);
      }}
      className="space-y-2"
    >
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} className={fieldClass} />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass} disabled={pending}>
          Save
        </button>
        <button type="button" className={quietButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function effortLabel(effort: Effort | null): string | null {
  return effort ? EFFORT_LABELS[effort] : null;
}
