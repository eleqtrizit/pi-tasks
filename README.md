# Pi TaskGraph

Dependency-aware task management extension for Pi Coding Agent.

This extension provides:

- A persistent task store under `~/.pi/tasks/<list-id>/`
- Bidirectional dependency links (`blockedBy` and `blocks`)
- Dependency-aware status transitions (blocked tasks cannot move to `in_progress` or `completed`)
- A live task widget in the Pi UI
- A `/list-tasks` command for markdown task overviews
- A `/clear-tasks` command to remove all tasks in the active list

## Tools

### `task_create`

Create a task.

Required fields:

- `subject` (string, non-empty)
- `addBlockedBy` (string array, can be `[]`)

Optional fields:

- `description` (string, defaults to `""`)
- `activeForm` (string, defaults to `subject`)
- `metadata` (object, defaults to `{}`)

Example:

```json
{
  "subject": "Implement auth middleware",
  "description": "Add JWT verification and role checks",
  "activeForm": "Implementing auth middleware",
  "addBlockedBy": ["2"],
  "metadata": { "priority": "high", "component": "api" }
}
```

### `task_update`

Update task status, assignment, text fields, and dependencies.

Required field:

- `taskId` (string, non-empty)

Optional fields:

- `status` (`pending` | `in_progress` | `completed`)
- `owner` (string; empty string clears owner)
- `subject` (string, non-empty)
- `description` (string)
- `activeForm` (string)
- `addBlockedBy` (string array; appended and deduplicated)
- `addBlocks` (string array; appended and deduplicated)

Notes:

- Dependencies are validated; missing task IDs cause errors.
- Reciprocal links are maintained automatically.

### `task_get`

Get one task with formatted details.

Input:

```json
{
  "taskId": "3"
}
```

### `task_list`

Return all tasks as structured data (in `details.tasks`) with computed `isBlocked`.

Input:

```json
{}
```

### `get_batch_of_tasks`

Return tasks that are ready to execute in parallel now.

Inclusion rule:

- `status` is `pending`
- `isBlocked` is `false` (all dependencies completed)

Input:

```json
{}
```

### `clear_tasks`

Delete all tasks in the current list.

Input:

```json
{}
```

## Command

### `/list-tasks`

Displays a markdown summary of all tasks, including:

- Status symbol (`✓`, `■`, `□`, `⚠`)
- Owner (if present)
- Blocked-by dependency labels
- Aggregated counts for done / in-progress / open

### `/clear-tasks`

Deletes all tasks in the active list and refreshes the widget immediately.

## Persistence and Session Behavior

- On session start, the extension resolves the active list ID from:
  1. `PI_TASK_LIST_ID` environment variable (if set)
  2. Previously persisted session entry
  3. A generated UUID
- The resolved list ID is persisted in session state (`pi-taskgraph-state`) and used for subsequent tool calls.
- Task JSON files are stored at `~/.pi/tasks/<list-id>/<task-id>.json`.

## Install

From local dev:

```bash
pi install ./
pi remove ./
```

## Run in Pi Without Installing

Use this repo directly as an extension entrypoint:

```bash
pi --extension "$(pwd)/extensions/index.ts"
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Type-check

```bash
npx tsc --noEmit
```

### Tests

Run all tests:

```bash
npm test
```

Run in watch mode:

```bash
npx vitest
```

Run one test file:

```bash
npx vitest src/task-store.core.test.ts
```

## Quick Manual Validation Flow

1. Create a dependency task with `task_create`.
2. Create a second task with `task_create`.
3. Add dependency with `task_update` + `addBlockedBy`.
4. Try setting blocked task to `in_progress` (should fail).
5. Mark dependency task `completed`.
6. Set blocked task to `in_progress` (should succeed).
7. Call `task_list` and `get_batch_of_tasks` to verify `isBlocked` and parallel-ready results.
8. Run `/list-tasks` to verify markdown output and counts.
