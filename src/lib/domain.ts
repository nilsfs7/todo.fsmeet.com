export const COLUMNS = ["backlog", "in_progress", "done"] as const;
export type ColumnId = (typeof COLUMNS)[number];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  done: "Done",
};

export const EFFORTS = ["xs", "s", "m", "l", "xl"] as const;
export type Effort = (typeof EFFORTS)[number];

export const EFFORT_LABELS: Record<Effort, string> = {
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
};

export const LIMITS = {
  title: 200,
  description: 5000,
  category: 80,
  comment: 5000,
  username: 80,
} as const;

export type Role = "owner" | "edit" | "read";

export type BoardTask = {
  id: string;
  column: ColumnId;
  position: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type TaskFilter = {
  category?: string | null;
  creatorId?: string | null;
  assigneeId?: string | null;
  youngerThanDays?: number | null;
};

export function isColumn(value: string): value is ColumnId {
  return (COLUMNS as readonly string[]).includes(value);
}

export function isEffort(value: string): value is Effort {
  return (EFFORTS as readonly string[]).includes(value);
}

export function columnDropId(column: ColumnId): string {
  return `column:${column}`;
}

export function normalizeCategory(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, LIMITS.category);
}

export function categorySuggestions(names: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const name of names) {
    const normalized = normalizeCategory(name);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

export function resolveRole(input: {
  userId: string;
  ownerId: string;
  memberRole: "read" | "edit" | null;
  publicRead: boolean;
}): Role | null {
  if (input.userId === input.ownerId) return "owner";
  if (input.memberRole) return input.memberRole;
  if (input.publicRead) return "read";
  return null;
}

export function canView(role: Role | null): boolean {
  return role !== null;
}

export function canEditTasks(role: Role | null): boolean {
  return role === "owner" || role === "edit";
}

export function canManageProject(role: Role | null): boolean {
  return role === "owner";
}

export function canComment(role: Role | null): boolean {
  return role !== null;
}

export function timestampsAfterMove(
  task: Pick<BoardTask, "startedAt" | "completedAt">,
  to: ColumnId,
  nowIso: string,
): { column: ColumnId; startedAt: string | null; completedAt: string | null } {
  let startedAt = task.startedAt;
  let completedAt = task.completedAt;
  if (to === "in_progress" && !startedAt) startedAt = nowIso;
  if (to === "done") completedAt = nowIso;
  else completedAt = null;
  return { column: to, startedAt, completedAt };
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function resolveTarget(
  tasks: BoardTask[],
  overId: string,
): { column: ColumnId; beforeId: string | null } | null {
  if (overId.startsWith("column:")) {
    const column = overId.slice("column:".length);
    if (!isColumn(column)) return null;
    return { column, beforeId: null };
  }
  const over = tasks.find((task) => task.id === overId);
  if (!over) return null;
  return { column: over.column, beforeId: over.id };
}

export function reorderTasks<T extends BoardTask>(
  tasks: T[],
  activeId: string,
  overId: string,
  nowIso: string,
): T[] | null {
  const active = tasks.find((task) => task.id === activeId);
  if (!active) return null;

  const target = resolveTarget(tasks, overId);
  if (!target || target.beforeId === activeId) return null;

  const grouped = new Map<ColumnId, T[]>();
  for (const column of COLUMNS) {
    grouped.set(
      column,
      tasks
        .filter((task) => task.column === column)
        .sort((a, b) => a.position - b.position),
    );
  }

  const source = grouped.get(active.column)!;
  const fromIndex = source.findIndex((task) => task.id === activeId);
  if (fromIndex < 0) return null;

  if (active.column === target.column) {
    const list = source.slice();
    const toIndex = target.beforeId
      ? list.findIndex((task) => task.id === target.beforeId)
      : list.length - 1;
    if (toIndex < 0 || fromIndex === toIndex) return null;
    grouped.set(active.column, arrayMove(list, fromIndex, toIndex));
  } else {
    grouped.set(
      active.column,
      source.filter((task) => task.id !== activeId),
    );
    const dest = grouped.get(target.column)!.slice();
    const stamped = timestampsAfterMove(active, target.column, nowIso);
    const moved: T = {
      ...active,
      column: stamped.column,
      startedAt: stamped.startedAt,
      completedAt: stamped.completedAt,
    };
    if (target.beforeId) {
      const index = dest.findIndex((task) => task.id === target.beforeId);
      dest.splice(index < 0 ? dest.length : index, 0, moved);
    } else {
      dest.push(moved);
    }
    grouped.set(target.column, dest);
  }

  const next: T[] = [];
  for (const column of COLUMNS) {
    grouped.get(column)!.forEach((task, position) => {
      next.push({ ...task, column, position });
    });
  }
  return next;
}

export function applyColumnOrder<T extends BoardTask>(
  tasks: T[],
  order: Record<ColumnId, string[]>,
  nowIso: string,
): T[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const next: T[] = [];

  for (const column of COLUMNS) {
    const ids = order[column];
    if (!Array.isArray(ids)) throw new Error("Missing column");
    ids.forEach((id, position) => {
      if (seen.has(id)) throw new Error("Duplicate task");
      const task = byId.get(id);
      if (!task) throw new Error("Unknown task");
      seen.add(id);
      if (task.column === column) {
        next.push({ ...task, position });
        return;
      }
      const stamped = timestampsAfterMove(task, column, nowIso);
      next.push({ ...task, ...stamped, position });
    });
  }

  if (seen.size !== tasks.length) throw new Error("Missing task");
  return next;
}

export function orderFromTasks(tasks: BoardTask[]): Record<ColumnId, string[]> {
  const order: Record<ColumnId, string[]> = {
    backlog: [],
    in_progress: [],
    done: [],
  };
  for (const column of COLUMNS) {
    order[column] = tasks
      .filter((task) => task.column === column)
      .sort((a, b) => a.position - b.position)
      .map((task) => task.id);
  }
  return order;
}

export function isYoungerThan(createdAtIso: string, days: number, nowMs: number): boolean {
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created) || !Number.isFinite(days) || days <= 0) return false;
  return nowMs - created < days * 24 * 60 * 60 * 1000;
}

export function taskMatchesFilter(
  task: {
    category: string | null;
    creatorId: string;
    assigneeId: string | null;
    createdAt: string;
  },
  filter: TaskFilter,
  nowMs: number,
): boolean {
  if (filter.category && task.category !== filter.category) return false;
  if (filter.creatorId && task.creatorId !== filter.creatorId) return false;
  if (filter.assigneeId && task.assigneeId !== filter.assigneeId) return false;
  if (filter.youngerThanDays && filter.youngerThanDays > 0) {
    if (!isYoungerThan(task.createdAt, filter.youngerThanDays, nowMs)) return false;
  }
  return true;
}

export function filtersAreActive(filter: TaskFilter): boolean {
  return Boolean(
    filter.category || filter.creatorId || filter.assigneeId || (filter.youngerThanDays && filter.youngerThanDays > 0),
  );
}
