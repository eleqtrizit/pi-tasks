import { describe, expect, it } from "vitest";
import { TaskListItem } from "./task-model.js";
import { renderTaskWidget } from "./task-widget.js";

function makeTask(overrides: Partial<TaskListItem>): TaskListItem {
  return {
    id: "1",
    subject: "Task",
    description: "",
    activeForm: "Task",
    status: "pending",
    blocks: [],
    blockedBy: [],
    metadata: {},
    isBlocked: false,
    ...overrides,
  };
}

describe("task-widget rendering", () => {
  it("renders empty state", () => {
    const lines = renderTaskWidget([]);
    expect(lines).toEqual([]);
  });

  it("renders counts and symbols for mixed statuses while hiding completed tasks from the widget body", () => {
    const lines = renderTaskWidget([
      makeTask({ id: "1", subject: "Done", status: "completed" }),
      makeTask({
        id: "2",
        subject: "Working",
        status: "in_progress",
        owner: "agent-a",
      }),
      makeTask({
        id: "3",
        subject: "Blocked",
        status: "pending",
        isBlocked: true,
        blockedBy: ["2"],
      }),
      makeTask({ id: "4", subject: "Open", status: "pending" }),
    ]);

    expect(lines[0]).toBe("Tasks (1 done, 1 in progress, 2 open)");
    expect(lines).not.toContain("✓ #1 Done");
    expect(lines).toContain("■ #2 Working (agent-a)");
    expect(lines).toContain("⚠ #3 Blocked > blocked by #2");
    expect(lines).toContain("□ #4 Open");
  });

  it("renders blocked dependencies with comma-separated ids", () => {
    const lines = renderTaskWidget([
      makeTask({
        id: "7",
        subject: "Needs deps",
        status: "pending",
        isBlocked: true,
        blockedBy: ["1", "2", "5"],
      }),
    ]);

    expect(lines).toContain("⚠ #7 Needs deps > blocked by #1, #2, #5");
  });

  it("truncates after 5 tasks and points to /list-tasks", () => {
    const tasks = Array.from({ length: 12 }, (_, index) =>
      makeTask({
        id: String(index + 1),
        subject: `Task ${index + 1}`,
      }),
    );

    const lines = renderTaskWidget(tasks);
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe("□ #1 Task 1");
    expect(lines[5]).toBe("□ #5 Task 5");
    expect(lines[6]).toBe("... +7 more (run /list-tasks to show all)");
  });
});
