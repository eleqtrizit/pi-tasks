import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  TaskCreateParamsSchema,
  TaskGetParamsSchema,
  TaskListParamsSchema,
  TaskUpdateParamsSchema,
} from "./task-model.js";

describe("task-model schemas", () => {
  it("validates TaskCreate payloads", () => {
    expect(
      Value.Check(TaskCreateParamsSchema, {
        subject: "Set up database",
        description: "Create connection pool",
        activeForm: "Setting up database",
        addBlockedBy: ["1", "2"],
        metadata: { priority: "high" },
      }),
    ).toBe(true);

    expect(
      Value.Check(TaskCreateParamsSchema, {
        subject: "No dependencies yet",
        addBlockedBy: [],
      }),
    ).toBe(true);

    expect(
      Value.Check(TaskCreateParamsSchema, {
        subject: "",
      }),
    ).toBe(false);

    expect(
      Value.Check(TaskCreateParamsSchema, {
        subject: "ok",
      }),
    ).toBe(false);

    expect(
      Value.Check(TaskCreateParamsSchema, {
        subject: "ok",
        addBlockedBy: [],
        unknown: true,
      }),
    ).toBe(false);

    expect(
      Value.Check(TaskCreateParamsSchema, {
        subject: "ok",
        addBlockedBy: [""],
      }),
    ).toBe(false);
  });

  it("validates TaskUpdate payloads", () => {
    expect(
      Value.Check(TaskUpdateParamsSchema, {
        taskId: "3",
        status: "in_progress",
        owner: "backend-dev",
        addBlockedBy: ["1", "2"],
        addBlocks: ["4"],
      }),
    ).toBe(true);

    expect(
      Value.Check(TaskUpdateParamsSchema, {
        taskId: "3",
        status: "invalid-status",
      }),
    ).toBe(false);

    expect(
      Value.Check(TaskUpdateParamsSchema, {
        taskId: "",
        owner: "backend-dev",
      }),
    ).toBe(false);
  });

  it("validates TaskGet and TaskList payloads", () => {
    expect(Value.Check(TaskGetParamsSchema, { taskId: "12" })).toBe(true);
    expect(Value.Check(TaskGetParamsSchema, {})).toBe(false);

    expect(Value.Check(TaskListParamsSchema, {})).toBe(true);
    expect(Value.Check(TaskListParamsSchema, { extra: true })).toBe(false);
  });
});
