import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LocalTime } from "@/components/local-time";
import { primaryButtonClass } from "@/components/ui";
import { listVisibleProjects } from "@/lib/data";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/domain";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { ProjectListItem } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  edit: "Can edit",
  read: "Can view",
};

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const lists = await listVisibleProjects(getDb(), session.sub);

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Projects</h1>
            <p className="mt-1 text-muted">Boards you own, boards shared with you, and boards open to every signed-in user.</p>
          </div>
          <Link href="/projects/new" className={primaryButtonClass}>
            New project
          </Link>
        </div>
        <ProjectSection title="Your projects" projects={lists.owned} empty="You have not created a project yet." />
        <ProjectSection title="Shared with you" projects={lists.shared} empty="Nobody has invited you yet." />
        <ProjectSection title="Public boards" projects={lists.publicBoards} empty="No other public boards yet." />
      </main>
    </>
  );
}

function ProjectSection({
  title,
  projects,
  empty,
}: {
  title: string;
  projects: ProjectListItem[];
  empty: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {projects.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className="block h-full rounded-2xl border border-line bg-card p-4 shadow-sm hover:border-navy/40"
            >
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-navy/10 px-2 py-0.5 font-medium text-navy">{ROLE_LABEL[project.role]}</span>
                {project.publicRead ? (
                  <span className="rounded-full bg-paper px-2 py-0.5 text-muted">Public to read</span>
                ) : null}
              </div>
              <h3 className="font-display text-2xl leading-tight">{project.title}</h3>
              {project.description ? <p className="mt-2 line-clamp-3 text-sm text-muted">{project.description}</p> : null}
              <p className="mt-4 text-xs text-muted">
                Created <LocalTime iso={project.createdAt} />
                {project.role !== "owner" ? ` · ${project.ownerName}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
