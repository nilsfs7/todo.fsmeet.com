import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-4xl text-navy">Not available</h1>
      <p className="mt-3 text-muted">This page does not exist, or you do not have access to it.</p>
      <Link href="/projects" className="mt-6 inline-block text-navy">
        Back to projects
      </Link>
    </main>
  );
}
