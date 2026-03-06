# Pi TaskGraph

Dependency-aware task management extension for Pi Coding Agent.

It provides four tools:

- `task_create`
- `task_update`
- `task_get`
- `task_list`

Tasks are persisted to `~/.pi/tasks/<list-id>/` as JSON files, support dependency blocking, and are shown in a live widget.

## Install

From local dev:
```bash
pi install ./
pi remove ./
```

## Development Setup

Fastest - tell your LLM:

```
Setup this repo, read @README.md
```

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

## Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npx vitest
```

Run a single test file:

```bash
npx vitest src/task-store.core.test.ts
```

## Testing with Pi (`pi --extension`)

Use this project directly as an extension entrypoint:

```bash
pi --extension "$(pwd)/extensions/index.ts"
```

### Quick manual checks in Pi

1. Call `task_create` twice to create two tasks.
2. Call `task_update` on task 2 with `addBlockedBy: ["1"]`.
3. Try setting task 2 to `in_progress` before task 1 is complete (should fail).
4. Set task 1 to `completed`.
5. Set task 2 to `in_progress` (should succeed).
6. Call `task_list` and verify `blockedBy`, status, and widget updates.

