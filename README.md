# Pi TaskGraph

Dependency-aware task management extension for Pi Coding Agent.

This extension provides a comprehensive task management system with dependency tracking, status management, and real-time UI updates for organizing complex development workflows.

## Features

- **Persistent Task Store**: Tasks are stored under `~/.pi/tasks/<list-id>/` as individual JSON files
- **Bidirectional Dependency Links**: Automatic maintenance of `blockedBy` and `blocks` relationships
- **Dependency-Aware Status Transitions**: Blocked tasks cannot move to `in_progress` or `completed` status
- **Live Task Widget**: Real-time task overview in the Pi UI footer
- **Multi-List Support**: Isolated task lists via UUID or environment variable
- **Parallel Task Execution**: Identify tasks ready for parallel execution with `get_batch_of_tasks`
- **Owner Assignment**: Track who is responsible for each task
- **Rich Metadata**: Attach custom metadata to tasks for categorization and filtering

## Tools

### `task_create`

Create a new dependency-aware task.

**Required fields:**

- `subject` (string, non-empty): Task title
- `addBlockedBy` (string array): Task IDs this task depends on (can be `[]`)

**Optional fields:**

- `description` (string): Detailed task description (defaults to `""`)
- `activeForm` (string): Present continuous form for display (defaults to `subject`)
- `metadata` (object): Custom key-value pairs for categorization (defaults to `{}`)

**Example:**

```json
{
  "subject": "Implement auth middleware",
  "description": "Add JWT verification and role checks",
  "activeForm": "Implementing auth middleware",
  "addBlockedBy": ["2"],
  "metadata": { "priority": "high", "component": "api" }
}
```

**Returns:** Created task with generated ID and all fields.

---

### `task_update`

Update task status, assignment, text fields, and dependencies.

**Required field:**

- `taskId` (string, non-empty): ID of task to update

**Optional fields:**

- `status` (`"pending"` | `"in_progress"` | `"completed"`): Task status
- `owner` (string): Assign task to owner (empty string clears owner)
- `subject` (string, non-empty): Update task title
- `description` (string): Update task description
- `activeForm` (string): Update active form text
- `addBlockedBy` (string array): Add new dependency IDs (appended and deduplicated)
- `addBlocks` (string array): Add tasks that depend on this task (appended and deduplicated)

**Behavior:**

- Dependencies are validated; missing task IDs cause errors
- Blocked tasks cannot transition to `in_progress` or `completed`
- Reciprocal dependency links are maintained automatically
- Owner is trimmed and cleared if empty

**Example:**

```json
{
  "taskId": "3",
  "status": "in_progress",
  "owner": "frontend-team",
  "addBlockedBy": ["1", "2"]
}
```

---

### `task_get`

Retrieve full details for a specific task with formatted output.

**Input:**

```json
{
  "taskId": "3"
}
```

**Returns:** Formatted text summary and structured task details including:
- Task ID and subject
- Status (with blocked indicator)
- Owner assignment
- Blocked-by dependencies
- Tasks this task blocks
- Description

---

### `task_list`

List all tasks with dependency-aware blocked state.

**Input:**

```json
{}
```

**Returns:** Structured data with all tasks and computed `isBlocked` field.

**Example Response:**

```json
{
  "content": [{ "type": "text", "text": "Listed 5 task(s)." }],
  "details": {
    "tasks": [
      {
        "id": "1",
        "subject": "Setup project",
        "status": "completed",
        "isBlocked": false,
        "blockedBy": [],
        "blocks": ["2", "3"],
        ...
      }
    ]
  }
}
```

---

### `get_batch_of_tasks`

Return all pending, unblocked tasks that can be executed in parallel.

**Use case:** Ideal for distributing work across multiple agents or workers.

**Inclusion criteria:**

- `status` is `"pending"`
- `isBlocked` is `false` (all dependencies completed)

**Input:**

```json
{}
```

**Returns:** Text summary and array of ready tasks.

**Example Response:**

```json
{
  "content": [{ "type": "text", "text": "3 task(s) ready to run in parallel:\n#2: Implement API endpoints\n#3: Setup database schema\n#5: Write unit tests" }],
  "details": {
    "tasks": [
      { "id": "2", "subject": "Implement API endpoints", ... },
      { "id": "3", "subject": "Setup database schema", ... },
      { "id": "5", "subject": "Write unit tests", ... }
    ]
  }
}
```

---

### `clear_tasks`

Delete all tasks in the current task list.

**Input:**

```json
{}
```

**Returns:** Number of cleared tasks.

**Note:** This action is irreversible. Use with caution.

---

## Commands

### `/list-tasks`

Display all tasks in markdown format with:

- Status symbols: `✓` (done), `■` (in progress), `□` (pending), `⚠` (blocked)
- Owner assignment (if present)
- Blocked-by dependency labels
- Aggregated counts (done / in progress / open)

**Example Output:**

```
## Tasks (2 done, 1 in progress, 3 open)

- ✓ **#1** Setup project — Done
- ■ **#2** Implement API endpoints (backend-team) — In Progress
- □ **#3** Setup database schema — Pending
- ⚠ **#4** Write integration tests — Pending ⚠ blocked by #2, #3
- □ **#5** Deploy to staging — Pending
- □ **#6** Update documentation — Pending
```

---

### `/clear-tasks`

Delete all tasks from the current task list and refresh the widget immediately.

**Output:** Confirmation message with count of cleared tasks.

---

## Task Status Flow

```
pending ──→ in_progress ──→ completed
   ↑                              │
   └──────────────────────────────┘
```

**Rules:**

- Tasks start in `pending` status
- Blocked tasks (with unfinished dependencies) cannot transition to `in_progress` or `completed`
- Tasks can move from `in_progress` back to `pending`
- Completed tasks cannot be reverted

---

## Persistence and Session Behavior

### Task List ID Resolution

The extension resolves the active list ID in priority order:

1. `PI_TASK_LIST_ID` environment variable (if set)
2. Previously persisted session entry (`pi-taskgraph-state`)
3. Generated UUID (new list)

### Storage Structure

```
~/.pi/tasks/
└── <list-id>/
    ├── 1.json
    ├── 2.json
    ├── 3.json
    └── ...
```

Each task is stored as an individual JSON file with the task ID as the filename.

### Session State

The resolved list ID is persisted in session state (`pi-taskgraph-state`) and automatically restored on session restart, maintaining continuity across Pi sessions.

---

## Task JSON Structure

```json
{
  "id": "3",
  "subject": "Implement auth middleware",
  "description": "Add JWT verification and role checks",
  "activeForm": "Implementing auth middleware",
  "owner": "backend-team",
  "status": "in_progress",
  "blocks": ["5"],
  "blockedBy": ["1", "2"],
  "metadata": {
    "priority": "high",
    "component": "api"
  }
}
```

**Fields:**

- `id`: Auto-incremented string ID
- `subject`: Task title (required, non-empty)
- `description`: Detailed description
- `activeForm`: Present continuous form for display
- `owner`: Assigned owner (optional)
- `status`: One of `pending`, `in_progress`, `completed`
- `blocks`: Task IDs that depend on this task
- `blockedBy`: Task IDs this task depends on
- `metadata`: Custom key-value pairs

---

## Installation

### From Local Development

```bash
pi install ./
pi remove ./
```

### Run in Pi Without Installing

Use this repo directly as an extension entrypoint:

```bash
pi --extension "$(pwd)/extensions/index.ts"
```

### From Published Package

```bash
pi install pi-taskgraph
```

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Type Check

```bash
npx tsc --noEmit
```

### Tests

**Run all tests:**

```bash
npm test
```

**Run in watch mode:**

```bash
npx vitest
```

**Run specific test file:**

```bash
npx vitest src/task-store.core.test.ts
```

---

## Quick Start

### Manual Validation Flow

1. **Create a dependency task:**
   ```
   task_create({ subject: "Setup database" })
   ```

2. **Create a dependent task:**
   ```
   task_create({ subject: "Implement models" })
   ```

3. **Add dependency:**
   ```
   task_update({ taskId: "2", addBlockedBy: ["1"] })
   ```

4. **Try to set blocked task to in_progress (should fail):**
   ```
   task_update({ taskId: "2", status: "in_progress" })
   # Error: Task #2 is blocked by unfinished dependencies.
   ```

5. **Mark dependency task completed:**
   ```
   task_update({ taskId: "1", status: "completed" })
   ```

6. **Set blocked task to in_progress (should succeed):**
   ```
   task_update({ taskId: "2", status: "in_progress" })
   ```

7. **Verify with task_list and get_batch_of_tasks:**
   ```
   task_list({})
   get_batch_of_tasks({})
   ```

8. **Check markdown output:**
   ```
   /list-tasks
   ```

### Parallel Execution Workflow

Ideal for multi-agent or team workflows:

1. **Create tasks with dependencies:**
   ```
   task_create({ subject: "Setup project", addBlockedBy: [] })
   task_create({ subject: "Implement API", addBlockedBy: ["1"] })
   task_create({ subject: "Setup tests", addBlockedBy: ["1"] })
   task_create({ subject: "Write docs", addBlockedBy: [] })
   ```

2. **Get tasks ready for parallel execution:**
   ```
   get_batch_of_tasks({})
   # Returns: #1 (Setup project), #4 (Write docs)
   ```

3. **Assign to different agents:**
   ```
   task_update({ taskId: "1", owner: "backend-agent" })
   task_update({ taskId: "4", owner: "docs-agent" })
   ```

4. **Mark completed and get next batch:**
   ```
   task_update({ taskId: "1", status: "completed" })
   task_update({ taskId: "4", status: "completed" })
   get_batch_of_tasks({})
   # Returns: #2 (Implement API), #3 (Setup tests)
   ```

---

## Error Handling

All tools return structured responses with:

- `content`: Human-readable message
- `details`: Structured data or error information

**Error examples:**

- `Task #X does not exist.`
- `Task #X cannot depend on itself.`
- `Task #X is blocked by unfinished dependencies.`
- `Task store is not initialized yet.`

---

## License

MIT
