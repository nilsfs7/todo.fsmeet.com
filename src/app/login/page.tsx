import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { sanitizeReturnTo } from "@/lib/site";
import { primaryButtonClass } from "@/components/ui";

const ERRORS: Record<string, string> = {
  config: "FSMeet login is not configured yet. Set FSMEET_OAUTH_CLIENT_ID and register the redirect URL.",
  denied: "FSMeet did not grant access.",
  state: "That login attempt expired. Try again.",
  exchange: "FSMeet login could not be completed.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const session = await readSession();
  const returnTo = sanitizeReturnTo(params.returnTo);
  if (session) redirect(returnTo);

  const error = params.error ? (ERRORS[params.error] ?? params.error) : null;
  const start = `/api/auth/fsmeet/start?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium tracking-wide text-navy">FSMeet</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Todo</h1>
      <p className="mt-3 text-muted">A board for the work you share with other FSMeet users. Sign in to continue.</p>
      {error ? <p className="mt-6 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <Link href={start} className={`${primaryButtonClass} mt-8`}>
        Sign in with FSMeet
      </Link>
    </main>
  );
}
