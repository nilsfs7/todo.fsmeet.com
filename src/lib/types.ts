import type { ColumnId, Effort, Role } from "./domain";

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
  authorId: string;
  authorName: string;
};

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  effort: Effort | null;
  category: string | null;
  column: ColumnId;
  position: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  creatorId: string;
  creatorName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  comments: CommentView[];
};

export type AssigneeInput = {
  id: string;
  username: string;
  displayName: string | null;
  picture: string | null;
};

export type ProjectView = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  publicRead: boolean;
  ownerId: string;
  ownerName: string;
};

export type ProjectListItem = ProjectView & {
  role: Role;
};

export type MemberView = {
  userId: string;
  username: string;
  displayName: string;
  role: "read" | "edit";
};

export type TaskInput = {
  title: string;
  description?: string | null;
  effort?: string | null;
  category?: string | null;
  assignee?: AssigneeInput | null;
};

export type CommentInput = {
  body: string;
};
