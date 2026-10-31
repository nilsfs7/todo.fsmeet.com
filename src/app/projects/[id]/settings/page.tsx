import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RoleSelect } from "@/components/role-select";
import { SelectField } from "@/components/select-field";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { dangerButtonClass, fieldClass, quietButtonClass } from "@/components/ui";
import {
  deleteProjectAction,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  updateProjectAction,
} from "@/lib/actions";
import { getBoard, listMembers } from "@/lib/data";
import { getDb } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getSiteUrl } from "@/lib/site";

async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return getSiteUrl();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export const metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { error } = await searchParams;
  const board = await getBoard(getDb(), id, session.sub);
  if (!board) notFound();
  if (board.role !== "owner") redirect(`/projects/${id}`);
  const members = await listMembers(getDb(), id, session.sub);
  const shareUrl = `${await requestOrigin()}/projects/${id}`;

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/projects/${id}`} className="text-sm text-navy">
          Back to board
        </Link>
        <h1 className="mt-3 font-display text-4xl">Settings</h1>
        <p className="mt-2 text-muted">{board.project.title}</p>
        {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        <form action={updateProjectAction} className="mt-8 space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold">Project</h2>
          <input type="hidden" name="projectId" value={id} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input name="title" required maxLength={200} defaultValue={board.project.title} className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              defaultValue={board.project.description ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="publicRead" defaultChecked={board.project.publicRead} className="mt-1" />
            <span>
              Public to read
              <span className="mt-1 block text-muted">Every signed-in user can view this board. They cannot edit it unless you invite them.</span>
            </span>
          </label>
          <SubmitButton>Save project</SubmitButton>
        </form>

        <section className="mt-6 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold">Link</h2>
          <p className="mt-1 text-sm text-muted">People who can view the project can open this address.</p>
          <input readOnly value={shareUrl} className={`${fieldClass} mt-3`} />
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold">People</h2>
          <p className="mt-1 text-sm text-muted">Invite a FSMeet username. Read can view. Edit can change tasks.</p>
          <form action={inviteMemberAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="projectId" value={id} />
            <input name="username" required maxLength={80} placeholder="Username" className={fieldClass} />
            <SelectField
              name="role"
              defaultValue="read"
              ariaLabel="Access"
              className="sm:max-w-40"
              options={[
                { value: "read", label: "Read" },
                { value: "edit", label: "Edit" },
              ]}
            />
            <SubmitButton>Invite</SubmitButton>
          </form>
          <ul className="mt-4 divide-y divide-line">
            {members.ok && members.value.length === 0 ? <li className="py-3 text-sm text-muted">No invites yet.</li> : null}
            {members.ok
              ? members.value.map((member) => (
                  <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted">{member.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={updateMemberRoleAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="memberId" value={member.userId} />
                        <RoleSelect role={member.role} />
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="memberId" value={member.userId} />
                        <button type="submit" className={quietButtonClass}>
                          Remove
                        </button>
                      </form>
                    </div>
                  </li>
                ))
              : null}
          </ul>
        </section>

        <form action={deleteProjectAction} className="mt-6 rounded-2xl border border-danger/30 bg-card p-4">
          <h2 className="font-semibold text-danger">Delete project</h2>
          <p className="mt-1 text-sm text-muted">Deletes the board, its tasks, and its comments.</p>
          <input type="hidden" name="projectId" value={id} />
          <div className="mt-4">
            <ConfirmSubmit message="Delete this project?" className={dangerButtonClass}>
              Delete project
            </ConfirmSubmit>
          </div>
        </form>
      </main>
    </>
  );
}
