import { LIMITS } from "./domain";
import { getFsmeetApiBase } from "./site";

export type DirectoryPerson = {
  id: string;
  username: string;
  name: string;
  picture: string | null;
};

export function personLabel(user: {
  username: string;
  nickName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}): string {
  const nick = text(user.nickName);
  if (nick) return nick;
  const full = [text(user.firstName), text(user.lastName)].filter(Boolean).join(" ");
  return full || user.username;
}

export function isAssignableUserType(type: unknown): boolean {
  if (typeof type !== "string") return true;
  const value = type.trim().toLowerCase();
  return value !== "administrative" && value !== "fan";
}

export async function listDirectoryUsers(): Promise<
  { ok: true; people: DirectoryPerson[] } | { ok: false; error: string }
> {
  try {
    const response = await fetch(`${getFsmeetApiBase()}/users`, { cache: "no-store" });
    if (!response.ok) return { ok: false, error: "The people list is unavailable." };
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return { ok: false, error: "The people list is unavailable." };
    const people = body
      .map(parsePerson)
      .filter((person): person is DirectoryPerson => person !== null)
      .sort((a, b) => a.name.localeCompare(b.name) || a.username.localeCompare(b.username));
    return { ok: true, people };
  } catch {
    return { ok: false, error: "The people list is unavailable." };
  }
}

export async function lookupDirectoryUser(
  username: string,
): Promise<{ ok: true; person: DirectoryPerson } | { ok: false; error: string }> {
  const name = username.trim();
  if (!name || name.length > LIMITS.username) return { ok: false, error: "Choose a person." };
  try {
    const response = await fetch(`${getFsmeetApiBase()}/users/${encodeURIComponent(name)}`, {
      cache: "no-store",
    });
    if (response.status === 404) return { ok: false, error: "That person is not an FSMeet user." };
    if (!response.ok) return { ok: false, error: "The people list is unavailable." };
    const body: unknown = await response.json();
    if (!isAssignableRecord(body)) return { ok: false, error: "That person cannot be assigned." };
    const person = parsePerson(body);
    if (!person) return { ok: false, error: "That person is not an FSMeet user." };
    return { ok: true, person };
  } catch {
    return { ok: false, error: "The people list is unavailable." };
  }
}

function parsePerson(value: unknown): DirectoryPerson | null {
  if (!isAssignableRecord(value)) return null;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const username = text(record.username);
  if (!username || username.length > LIMITS.username) return null;
  return {
    id: username,
    username,
    name: personLabel({
      username,
      nickName: record.nickName,
      firstName: record.firstName,
      lastName: record.lastName,
    }),
    picture: text(record.imageUrl),
  };
}

function isAssignableRecord(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  return isAssignableUserType((value as Record<string, unknown>).type);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
