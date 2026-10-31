import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Board } from "@/components/board";
import { LocalTime } from "@/components/local-time";
import { quietButtonClass } from "@/components/ui";
import { getBoard } from "@/lib/data";
import { listDirectoryUsers } from "@/lib/directory";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/domain";
import { readSession } from "@/lib/session";
import { requestNow } from "@/lib/site";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  edit: "Can edit",
  read: "View only",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await readSession();
  const { id } = await params;
  if (!session) return { title: "Project" };
  const board = await getBoard(getDb(), id, session.sub);
  return { title: board?.project.title ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const board = await getBoard(getDb(), id, session.sub);
  if (!board) notFound();
  const directory = await listDirectoryUsers();

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {ROLE_LABEL[board.role]}
              {board.project.publicRead ? " · Public to read" : ""}
            </p>
            <h1 className="font-display text-4xl">{board.project.title}</h1>
            {board.project.description ? <p className="mt-2 max-w-2xl text-muted">{board.project.description}</p> : null}
            <p className="mt-2 text-xs text-muted">
              Created <LocalTime iso={board.project.createdAt} />
              {board.role !== "owner" ? ` by ${board.project.ownerName}` : ""}
            </p>
          </div>
          {board.role === "owner" ? (
            <Link href={`/projects/${board.project.id}/settings`} className={quietButtonClass}>
              Settings
            </Link>
          ) : null}
        </div>
        <Board
          projectId={board.project.id}
          role={board.role}
          initialTasks={board.tasks}
          currentUserId={session.sub}
          generatedAt={requestNow()}
          people={directory.ok ? directory.people : []}
          peopleError={directory.ok ? null : directory.error}
        />
      </main>
    </>
  );
}
