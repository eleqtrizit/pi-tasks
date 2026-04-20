---
name: task-management
description: Provides guidance on creating and managing dependency-aware tasks. Use when creating tasks with task_create, updating dependencies, or troubleshooting task ID errors.
---

# Task Management Skill

This skill provides guidance on creating and managing tasks with the `task_create`, `task_update`, `task_list`, and related tools.

## Overview

The task management system supports dependency-aware task tracking. Tasks can block other tasks, creating a dependency graph that determines execution order.

## Key Concepts

### Task IDs Are Runtime-Assigned

**Critical:** Task IDs are auto-incremented strings (`"1"`, `"2"`, `"3"`...) assigned **at creation time**. You cannot reference tasks that haven't been created yet.

- First task created → `"1"`
- Second task created → `"2"`
- And so on...

### Dependencies Work One Way

When task A depends on task B:
- Task B must exist **before** task A references it
- Task A's `addBlockedBy` array contains task B's ID
- Task B's `blocks` array is automatically updated to include task A's ID

## Correct Workflow

### Pattern 1: Sequential Creation (Recommended for Small Batches)

Create tasks one at a time, waiting for each ID assignment:

```
1. task_create({ subject: "Setup project", addBlockedBy: [] })
   → Returns: "Created task #1: Setup project"

2. task_create({ subject: "Create config", addBlockedBy: ["1"] })
   → Returns: "Created task #2: Create config"

3. task_create({ subject: "Build feature", addBlockedBy: ["2"] })
   → Returns: "Created task #3: Build feature"
```

### Pattern 2: Parallel Foundation + Sequential Dependencies

For larger task lists:

**Step 1:** Create all foundation tasks (no dependencies) in parallel:
```
task_create({ subject: "Setup project", addBlockedBy: [] })
task_create({ subject: "Write tests", addBlockedBy: [] })
task_create({ subject: "Create docs", addBlockedBy: [] })
→ Tasks #1, #2, #3 created
```

**Step 2:** Use `task_list` to discover the assigned IDs:
```
task_list({})
→ Returns all tasks with their IDs
```

**Step 3:** Create dependent tasks using the known IDs:
```
task_create({ subject: "Deploy app", addBlockedBy: ["1", "2"] })
```

### Pattern 3: Create Then Update

Create all tasks without dependencies, then add dependencies:

```
1. Create all tasks with addBlockedBy: []
2. Use task_update to add dependencies:
   task_update({ taskId: "3", addBlockedBy: ["1", "2"] })
```

## Common Mistakes

### ❌ Mistake: Referencing Non-Existent Tasks

```javascript
// WRONG: Task #2 doesn't exist yet
task_create({ subject: "Task A", addBlockedBy: ["2"] })
task_create({ subject: "Task B", addBlockedBy: [] })
```

**Error:** `Task #2 does not exist.`

### ❌ Mistake: Self-Reference

```javascript
// WRONG: Task cannot depend on itself
task_create({ subject: "Task A", addBlockedBy: ["1"] })
```

**Error:** `Task #1 cannot depend on itself.`

### ❌ Mistake: Batch Creation with Cross-References

```javascript
// WRONG: All these fail because IDs don't exist yet
task_create({ subject: "A", addBlockedBy: ["2"] })
task_create({ subject: "B", addBlockedBy: ["3"] })
task_create({ subject: "C", addBlockedBy: ["1"] })
```

### ✅ Correct: Create in Dependency Order

```javascript
// RIGHT: Foundation tasks first
task_create({ subject: "C", addBlockedBy: [] })  // → Task #1
task_create({ subject: "B", addBlockedBy: [] })  // → Task #2
task_create({ subject: "A", addBlockedBy: ["1", "2"] })  // → Task #3
```

## Tool Reference

### task_create

```javascript
task_create({
    subject: "Task name",           // Required, non-empty string
    description: "Details",         // Optional
    activeForm: "Active form",      // Optional, defaults to subject
    addBlockedBy: [],               // Required - use [] for no dependencies
    metadata: {}                    // Optional key-value store
})
```

**Returns:** `Created task #<id>: <subject>`

### task_update

```javascript
task_update({
    taskId: "1",                    // Required - existing task ID
    status: "pending",              // Optional: "pending" | "in_progress" | "completed"
    owner: "Alice",                 // Optional
    subject: "New name",            // Optional
    description: "New details",     // Optional
    addBlockedBy: ["2", "3"],       // Optional - adds to existing dependencies
    addBlocks: ["4"]                // Optional - tasks this task blocks
})
```

**Note:** Status changes to `in_progress` or `completed` will fail if dependencies are not completed.

### task_list

```javascript
task_list({})
```

**Returns:** All tasks with IDs, status, dependencies, and blocked state.

**Use this to discover task IDs before creating dependencies.**

### task_get

```javascript
task_get({ taskId: "1" })
```

**Returns:** Full details for a specific task.

### get_batch_of_tasks

```javascript
get_batch_of_tasks({})
```

**Returns:** All pending, unblocked tasks ready for parallel execution.

## Example: Building a Feature

```
Phase 1 - Foundation (no dependencies):
├─ task_create({ subject: "Setup repo", addBlockedBy: [] })      → #1
├─ task_create({ subject: "Define API spec", addBlockedBy: [] }) → #2
└─ task_create({ subject: "Create tests", addBlockedBy: [] })    → #3

Phase 2 - Implementation (depends on foundation):
├─ task_create({ subject: "Implement endpoints", addBlockedBy: ["1", "2"] }) → #4
└─ task_create({ subject: "Add validation", addBlockedBy: ["2"] })           → #5

Phase 3 - Integration (depends on implementation):
└─ task_create({ subject: "Integration tests", addBlockedBy: ["3", "4", "5"] }) → #6

Phase 4 - Completion:
└─ task_create({ subject: "Deploy to staging", addBlockedBy: ["6"] }) → #7
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `Task #X does not exist` | Referencing a task that hasn't been created yet | Use `task_list` to see existing IDs, create tasks in order |
| `Task #X cannot depend on itself` | Task references its own ID | Remove self-reference from `addBlockedBy` |
| `Task #X is blocked by unfinished dependencies` | Trying to complete a task before its dependencies | Complete dependency tasks first, or use `task_update` to remove dependency |

## Best Practices

1. **Start with `addBlockedBy: []`** - Create foundation tasks first
2. **Use `task_list` frequently** - Discover IDs before referencing them
3. **Name tasks clearly** - The subject should be actionable and specific
4. **Keep dependencies minimal** - Only add true dependencies, not nice-to-haves
5. **Update status as you work** - Mark tasks `in_progress` when started, `completed` when done
6. **Use `get_batch_of_tasks`** - Find all tasks ready for parallel work
