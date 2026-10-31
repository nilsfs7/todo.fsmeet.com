# AGENTS.md

This is a new project: a task-manager board in the style of the boards GitHub provides. The tables below are the product requirements. Build the app to match them.

Domain: `todo.fsmeet.com`.

## Access

Only signed-in users can use the app. There is no anonymous access, including for projects that are public to read.

| ID    | Requirement    | Rule                                                           |
| ----- | -------------- | -------------------------------------------------------------- |
| ACC-1 | Sign-in        | Users sign in with FSMeet Login via OAuth.                     |
| ACC-2 | Signed-in only | Only signed-in users can read projects or manage them.         |
| ACC-3 | Read vs edit   | Access is either read or edit. Read can view. Edit can change. |

## Projects

A user can create projects and manage the ones they own. Each project is one board.

| ID    | Requirement       | Rule                                                                                                   |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| PRJ-1 | Create and manage | A user can create projects and manage projects they own.                                               |
| PRJ-2 | Overview          | Each user has an overview of their projects: projects they own and projects they were invited to.      |
| PRJ-3 | Owner             | The project owner can invite other users.                                                              |
| PRJ-4 | Invite permission | An invite grants either read or edit.                                                                  |
| PRJ-5 | Public to read    | The owner can make a project public to read. Every signed-in user can then view it and cannot edit it. |
| PRJ-6 | Title             | A project has a title.                                                                                 |
| PRJ-7 | Created at        | A project has a creation date, set when the project is created.                                        |
| PRJ-8 | Description       | A description is optional.                                                                             |

## Board

| ID    | Requirement         | Rule                                                                                 |
| ----- | ------------------- | ------------------------------------------------------------------------------------ |
| BRD-1 | One board           | A project is a board on which tasks are created and managed.                         |
| BRD-2 | Columns             | The board has three columns: Backlog, In Progress, and Done.                         |
| BRD-3 | New tasks           | A new task is always created in Backlog.                                             |
| BRD-4 | Move across columns | Tasks can be dragged between columns.                                                |
| BRD-5 | Reorder in a column | Tasks can be dragged up and down inside a column so they can be ordered by priority. |

## Tasks

| ID    | Field        | Rule                                                                                                                                                                                 |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TSK-1 | Creator      | The user who created the task.                                                                                                                                                       |
| TSK-2 | Title        | Required.                                                                                                                                                                            |
| TSK-3 | Description  | Optional.                                                                                                                                                                            |
| TSK-4 | Effort       | Estimate as a t-shirt size.                                                                                                                                                          |
| TSK-5 | Created at   | Set automatically when the task is created.                                                                                                                                          |
| TSK-6 | Started at   | Set automatically the first time the task is moved into In Progress. Later moves do not set it again.                                                                                |
| TSK-7 | Completed at | Set automatically when the task is moved into Done. Cleared when the task is moved into Backlog or In Progress.                                                                      |
| TSK-8 | Category     | Optional. See Categories.                                                                                                                                                            |
| TSK-9 | Assignee     | Optional. A task can be assigned to one person. The people to choose from come from the public FSMeet endpoint `GET /v1/users`. Users of type administrative and fan are not listed. |

## Categories

Category names are free text. They belong to one project. Other projects do not see them.

The suggestion list for a project is the set of category names currently used by at least one task in that project.

| ID    | Requirement          | Rule                                                                                                                     |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| CAT-1 | Free name            | A category name can be any text the user chooses.                                                                        |
| CAT-2 | Suggest              | After a category is used once, it is offered when choosing a category on other tasks in the same project.                |
| CAT-3 | Rename a unique name | If a category name is used on only one task and that name is renamed, only the new name remains available.               |
| CAT-4 | Remove               | If a category is removed from a task and no other task in the project uses it, it is deleted and is no longer suggested. |
| CAT-5 | Project scope        | Categories are reusable inside one project only.                                                                         |

## Comments

Users can discuss a task in comments.

| ID    | Requirement | Rule                                                    |
| ----- | ----------- | ------------------------------------------------------- |
| CMT-1 | Add         | Users can add comments on a task.                       |
| CMT-2 | Timestamp   | Each comment stores a timestamp of when it was written. |
| CMT-3 | Edit        | Comments can be edited.                                 |
| CMT-4 | Delete      | Comments can be deleted.                                |

## Filters

Tasks can be filtered. Several filters can be active at the same time; a task must match every active filter.

| ID    | Filter   | Rule                                          |
| ----- | -------- | --------------------------------------------- |
| FLT-1 | Category | Filter by category.                           |
| FLT-2 | Creator  | Filter by the user who created the task.      |
| FLT-3 | Age      | Filter to tasks younger than X days.          |
| FLT-4 | Assignee | Filter by the person the task is assigned to. |
| FLT-5 | Combine  | More than one filter can be applied together. |

## Appearance

| ID    | Requirement | Rule                                                                    |
| ----- | ----------- | ----------------------------------------------------------------------- |
| APP-1 | Combo menus | Menu items in combo boxes follow the board's colors, type, and corners. |

## Technical

| ID    | Requirement | Rule                                                                      |
| ----- | ----------- | ------------------------------------------------------------------------- |
| TEC-1 | Framework   | Use Next.js.                                                              |
| TEC-2 | OAuth       | Use the FSMeet backend for OAuth: https://api.fsmeet.dffb.org/api/#/OAuth |
| TEC-3 | Domain      | The app is served at `todo.fsmeet.com`.                                   |
