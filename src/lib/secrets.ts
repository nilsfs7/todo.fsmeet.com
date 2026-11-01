export function getAuthSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SESSION_SECRET must be set.");
  return secret;
}
