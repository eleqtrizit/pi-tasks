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

  it("renders counts and only in-progress tasks in the widget body", () => {
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
    expect(lines).not.toContain("⚠ #3 Blocked");
    expect(lines).not.toContain("□ #4 Open");
  });

  it("renders blocked dependencies with comma-separated ids for in-progress tasks", () => {
    const lines = renderTaskWidget([
      makeTask({
        id: "7",
        subject: "Needs deps",
        status: "in_progress",
        isBlocked: true,
        blockedBy: ["1", "2", "5"],
      }),
    ]);

    expect(lines).toContain("⚠ #7 Needs deps > blocked by #1, #2, #5");
  });

  it("shows only header when no in-progress tasks exist", () => {
    const lines = renderTaskWidget([
      makeTask({ id: "1", subject: "Done", status: "completed" }),
      makeTask({ id: "2", subject: "Pending", status: "pending" }),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("Tasks (1 done, 0 in progress, 1 open)");
  });

  it("truncates after 5 in-progress tasks and points to /list-tasks", () => {
    const tasks = Array.from({ length: 12 }, (_, index) =>
      makeTask({
        id: String(index + 1),
        subject: `Task ${index + 1}`,
        status: "in_progress",
      }),
    );

    const lines = renderTaskWidget(tasks);
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe("■ #1 Task 1");
    expect(lines[5]).toBe("■ #5 Task 5");
    expect(lines[6]).toBe("... +7 more in progress (run /list-tasks to show all)");
  });
});
