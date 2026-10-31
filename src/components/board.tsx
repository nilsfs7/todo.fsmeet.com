"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveTaskOrderAction } from "@/lib/actions";
import {
  COLUMNS,
  COLUMN_LABELS,
  categorySuggestions,
  columnDropId,
  filtersAreActive,
  orderFromTasks,
  reorderTasks,
  taskMatchesFilter,
  type ColumnId,
  type TaskFilter,
} from "@/lib/domain";
import type { Role } from "@/lib/domain";
import type { TaskView } from "@/lib/types";
import type { DirectoryPerson } from "@/lib/directory";
import { TaskDialog, effortLabel } from "./task-dialog";
import { fieldClass, primaryButtonClass } from "./ui";
import { SelectField, type MenuOption } from "./select-field";

const DOT: Record<ColumnId, string> = {
  backlog: "bg-muted",
  in_progress: "bg-progress",
  done: "bg-done",
};

export function Board({
  projectId,
  role,
  initialTasks,
  currentUserId,
  generatedAt,
  people,
  peopleError,
}: {
  projectId: string;
  role: Role;
  initialTasks: TaskView[];
  currentUserId: string;
  generatedAt: number;
  people: DirectoryPerson[];
  peopleError: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const serialized = JSON.stringify(initialTasks);
  const [snapshot, setSnapshot] = useState(serialized);
  const [tasks, setTasks] = useState(initialTasks);
  if (snapshot !== serialized) {
    setSnapshot(serialized);
    setTasks(initialTasks);
  }

  const [category, setCategory] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [days, setDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | "new" | null>(null);

  const filter: TaskFilter = {
    category: category || null,
    creatorId: creatorId || null,
    assigneeId: assigneeId || null,
    youngerThanDays: Number(days) > 0 ? Number(days) : null,
  };
  const filtering = filtersAreActive(filter);
  const canEdit = role === "owner" || role === "edit";
  const canDrag = canEdit && !filtering;
  const visible = tasks.filter((task) => taskMatchesFilter(task, filter, generatedAt));
  const suggestions = categorySuggestions(tasks.map((task) => task.category));
  const creators = [...new Map(tasks.map((task) => [task.creatorId, task.creatorName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const assignees = [
    ...new Map(
      tasks.flatMap((task) => (task.assigneeId && task.assigneeName ? [[task.assigneeId, task.assigneeName] as const] : [])),
    ).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeTask = tasks.find((task) => task.id === activeId) ?? null;
  const openTask = openId && openId !== "new" ? (tasks.find((task) => task.id === openId) ?? null) : null;
  const mode = openId === "new" ? { type: "create" as const } : openTask ? { type: "edit" as const, task: openTask } : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canDrag || !event.over) return;
    const now = new Date().toISOString();
    const next = reorderTasks(tasks, String(event.active.id), String(event.over.id), now);
    if (!next) return;
    const previous = tasks;
    setTasks(next);
    startTransition(async () => {
      const result = await saveTaskOrderAction(projectId, orderFromTasks(next));
      if (!result.ok) {
        setTasks(previous);
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-card p-3 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSelect
          label="Category"
          value={category}
          onChange={setCategory}
          options={[{ value: "", label: "Any category" }, ...suggestions.map((name) => ({ value: name, label: name }))]}
        />
        <FilterSelect
          label="Creator"
          value={creatorId}
          onChange={setCreatorId}
          options={[{ value: "", label: "Anyone" }, ...creators.map((creator) => ({ value: creator.id, label: creator.name }))]}
        />
        <FilterSelect
          label="Assignee"
          value={assigneeId}
          onChange={setAssigneeId}
          options={[{ value: "", label: "Anyone" }, ...assignees.map((person) => ({ value: person.id, label: person.name }))]}
        />
        <label className="block text-xs font-medium text-muted">
          Younger than (days)
          <input
            type="number"
            min={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            placeholder="Any age"
            className={`${fieldClass} mt-1`}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="text-sm text-navy disabled:text-muted"
            disabled={!filtering}
            onClick={() => {
              setCategory("");
              setCreatorId("");
              setAssigneeId("");
              setDays("");
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      {filtering && canEdit ? (
        <p className="mb-3 text-sm text-muted">Clear the filters to drag tasks.</p>
      ) : null}
      {error ? <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((column) => (
            <Column
              key={column}
              column={column}
              tasks={visible.filter((task) => task.column === column)}
              canDrag={canDrag}
              canEdit={canEdit}
              onOpen={setOpenId}
              onCreate={() => setOpenId("new")}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <article className="rounded-xl border border-line bg-card px-3 py-3 shadow-lg">
              <CardBody task={activeTask} />
            </article>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        projectId={projectId}
        mode={mode}
        suggestions={suggestions}
        canEditTasks={canEdit}
        currentUserId={currentUserId}
        people={people}
        peopleError={peopleError}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: MenuOption[];
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <SelectField className="mt-1" value={value} onValueChange={onChange} options={options} />
    </label>
  );
}

function Column({
  column,
  tasks,
  canDrag,
  canEdit,
  onOpen,
  onCreate,
}: {
  column: ColumnId;
  tasks: TaskView[];
  canDrag: boolean;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column) });
  return (
    <section className={`rounded-2xl border bg-paper/60 p-3 ${isOver ? "border-navy" : "border-line"}`}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${DOT[column]}`} />
          {COLUMN_LABELS[column]}
          <span className="font-normal text-muted">{tasks.length}</span>
        </h2>
        {column === "backlog" && canEdit ? (
          <button type="button" className={primaryButtonClass} onClick={onCreate}>
            Add task
          </button>
        ) : null}
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-48 flex-col gap-2">
          {tasks.length === 0 ? <p className="px-1 text-sm text-muted">No tasks</p> : null}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDrag={canDrag} onOpen={() => onOpen(task.id)} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function TaskCard({ task, canDrag, onOpen }: { task: TaskView; canDrag: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canDrag,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-line bg-card px-3 py-3 shadow-sm ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex gap-2">
        {canDrag ? (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-muted"
            aria-label={`Drag ${task.title}`}
            {...attributes}
            {...listeners}
          >
            <Grip />
          </button>
        ) : null}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <CardBody task={task} />
        </button>
      </div>
    </article>
  );
}

function CardBody({ task }: { task: TaskView }) {
  const effort = effortLabel(task.effort);
  return (
    <>
      <h3 className="font-medium leading-snug">{task.title}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {task.category ? <span className="rounded-full bg-paper px-2 py-0.5 text-ink">{task.category}</span> : null}
        {effort ? <span className="rounded-full bg-navy/10 px-2 py-0.5 font-medium text-navy">{effort}</span> : null}
        {task.assigneeName ? <span className="text-ink">Assigned to {task.assigneeName}</span> : null}
        <span className="text-muted">{task.creatorName}</span>
        {task.comments.length > 0 ? (
          <span className="text-muted">
            {task.comments.length} {task.comments.length === 1 ? "comment" : "comments"}
          </span>
        ) : null}
      </div>
    </>
  );
}

function Grip() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="4" cy="3" r="1.2" fill="currentColor" />
      <circle cx="10" cy="3" r="1.2" fill="currentColor" />
      <circle cx="4" cy="7" r="1.2" fill="currentColor" />
      <circle cx="10" cy="7" r="1.2" fill="currentColor" />
      <circle cx="4" cy="11" r="1.2" fill="currentColor" />
      <circle cx="10" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}
