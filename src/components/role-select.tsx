"use client";

import { SelectField } from "./select-field";

const ROLES = [
  { value: "read", label: "Read" },
  { value: "edit", label: "Edit" },
];

export function RoleSelect({ role }: { role: "read" | "edit" }) {
  return <SelectField name="role" defaultValue={role} ariaLabel="Access" submitOnChange options={ROLES} />;
}
