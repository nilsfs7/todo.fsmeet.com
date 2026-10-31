import Link from "next/link";
import type { Session } from "@/lib/session-token";

export function AppHeader({ session }: { session: Session }) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <Link href="/projects" className="font-display text-2xl leading-none tracking-tight text-navy">
          Todo
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted">
            <Avatar name={session.displayName} picture={session.picture} />
            <span className="max-w-40 truncate text-ink">{session.displayName}</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="rounded-lg px-2 py-1 text-muted hover:bg-paper hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function Avatar({ name, picture }: { name: string; picture: string | null }) {
  if (picture) {
    return (
      // Profile photos are hosted by FSMeet and are not limited to one image domain.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={picture} alt="" className="h-8 w-8 rounded-full object-cover" />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
      {initial}
    </span>
  );
}
