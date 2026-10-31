import { createHash } from "node:crypto";

const DEV_SECRET = createHash("sha256").update("todo.fsmeet.com-dev-session").digest("hex");

export function getAuthSecret(): string {
  const fromEnv = process.env.AUTH_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production.");
  }
  return DEV_SECRET;
}
