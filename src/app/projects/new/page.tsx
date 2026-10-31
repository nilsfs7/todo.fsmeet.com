import { AppHeader } from "@/components/app-header";
import { SubmitButton } from "@/components/submit-button";
import { fieldClass } from "@/components/ui";
import { createProjectAction } from "@/lib/actions";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "New project" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { error } = await searchParams;

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="font-display text-4xl">New project</h1>
        <p className="mt-2 text-muted">A project is one board with Backlog, In Progress, and Done.</p>
        {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <form action={createProjectAction} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input name="title" required maxLength={200} className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea name="description" rows={4} maxLength={5000} className={fieldClass} placeholder="Optional" />
          </label>
          <SubmitButton>Create project</SubmitButton>
        </form>
      </main>
    </>
  );
}
