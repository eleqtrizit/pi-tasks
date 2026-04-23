import { describe, expect, it } from "vitest";
import { withIsolatedTaskStoreContext } from "../src/test-helpers/task-test-fixtures.js";
import { createPiRuntimeHarness } from "./test-helpers/pi-runtime-harness.js";

async function loadExtensionWithHarness(entries: unknown[] = []) {
  const extensionModule = await import("./index.js");
  const { pi, harness } = createPiRuntimeHarness(entries);
  const extensionFactory = (
    extensionModule as unknown as { default: (pi: any) => void }
  ).default;
  extensionFactory(pi);
  await harness.triggerSessionStart();
  return harness;
}

describe.sequential("pi taskgraph extension tools", () => {
  it("registers all task tools", async () => {
    await withIsolatedTaskStoreContext(async () => {
      const harness = await loadExtensionWithHarness();
      const toolNames = [...harness.tools.keys()].sort();
      expect(toolNames).toEqual([
        "clear_tasks",
        "get_batch_of_tasks",
        "task_create",
        "task_get",
        "task_list",
        "task_update",
      ]);
    });
  });

  it("persists list id on session start and renders widget", async () => {
    await withIsolatedTaskStoreContext(async () => {
      const harness = await loadExtensionWithHarness();

      expect(harness.appendEntryMock).toHaveBeenCalledTimes(1);
      expect(harness.appendEntryMock).toHaveBeenCalledWith(
        "pi-taskgraph-state",
        expect.objectContaining({ listId: expect.any(String) }),
      );
      expect(harness.setWidgetMock).toHaveBeenCalledWith(
        "pi-taskgraph-widget",
        expect.any(Array),
      );
    });
  });

  it("creates, updates, gets, and lists tasks successfully", async () => {
    await withIsolatedTaskStoreContext(async () => {
      const harness = await loadExtensionWithHarness();
      const createTool = harness.tools.get("task_create");
      const updateTool = harness.tools.get("task_update");
      const getTool = harness.tools.get("task_get");
      const listTool = harness.tools.get("task_list");
      const clearTool = harness.tools.get("clear_tasks");

      expect(
        createTool && updateTool && getTool && listTool && clearTool,
      ).toBeTruthy();

      const createDependencyResult = await createTool!.execute(
        "call-1",
        { subject: "Dependency", addBlockedBy: [] },
        undefined,
        undefined,
        harness.ctx,
      );
      const createBlockedResult = await createTool!.execute(
        "call-2",
        { subject: "Blocked task", addBlockedBy: [] },
        undefined,
        undefined,
        harness.ctx,
      );

      const dependencyTask = createDependencyResult.details as { id: string };
      const blockedTask = createBlockedResult.details as { id: string };

      await updateTool!.execute(
        "call-3",
        { taskId: blockedTask.id, addBlockedBy: [dependencyTask.id] },
        undefined,
        undefined,
        harness.ctx,
      );
      await updateTool!.execute(
        "call-4",
        { taskId: dependencyTask.id, status: "completed" },
        undefined,
        undefined,
        harness.ctx,
      );

      const updateBlockedResult = await updateTool!.execute(
        "call-5",
        { taskId: blockedTask.id, status: "in_progress", owner: "backend-dev" },
        undefined,
        undefined,
        harness.ctx,
      );
      const getResult = await getTool!.execute(
        "call-6",
        { taskId: blockedTask.id },
        undefined,
        undefined,
        harness.ctx,
      );
      const listResult = await listTool!.execute(
        "call-7",
        {},
        undefined,
        undefined,
        harness.ctx,
      );
      const clearResult = await clearTool!.execute(
        "call-8",
        {},
        undefined,
        undefined,
        harness.ctx,
      );
      const listAfterClearResult = await listTool!.execute(
        "call-9",
        {},
        undefined,
        undefined,
        harness.ctx,
      );

      expect(updateBlockedResult.content[0]?.text).toContain(
        `Updated task #${blockedTask.id}`,
      );
      expect((getResult.details as { owner?: string }).owner).toBe(
        "backend-dev",
      );
      expect((listResult.details as { tasks: unknown[] }).tasks).toHaveLength(
        2,
      );
      expect(
        (clearResult.details as { clearedCount: number }).clearedCount,
      ).toBe(2);
      expect(
        (listAfterClearResult.details as { tasks: unknown[] }).tasks,
      ).toHaveLength(0);
    });
  });

  it("returns a targeted error when task_create omits addBlockedBy", async () => {
    await withIsolatedTaskStoreContext(async () => {
      const harness = await loadExtensionWithHarness();
      const createTool = harness.tools.get("task_create")!;

      const createResult = await createTool.execute(
        "call-missing-addBlockedBy",
        { subject: "Whitespace cleanup" },
        undefined,
        undefined,
        harness.ctx,
      );

      expect(createResult.content[0]?.text).toContain("task_create failed");
      expect((createResult.details as { error?: string }).error).toContain(
        "Missing required field `addBlockedBy`",
      );
      expect((createResult.details as { error?: string }).error).toContain(
        "addBlockedBy: []",
      );
    });
  });

  it("returns predictable errors for missing and blocked tasks", async () => {
    await withIsolatedTaskStoreContext(async () => {
      const harness = await loadExtensionWithHarness();
      const createTool = harness.tools.get("task_create")!;
      const updateTool = harness.tools.get("task_update")!;
      const getTool = harness.tools.get("task_get")!;

      const dependencyResult = await createTool.execute(
        "call-1",
        { subject: "Dependency", addBlockedBy: [] },
        undefined,
        undefined,
        harness.ctx,
      );
      const blockedResult = await createTool.execute(
        "call-2",
        { subject: "Blocked task", addBlockedBy: [] },
        undefined,
        undefined,
        harness.ctx,
      );

      const dependencyTask = dependencyResult.details as { id: string };
      const blockedTask = blockedResult.details as { id: string };

      await updateTool.execute(
        "call-3",
        { taskId: blockedTask.id, addBlockedBy: [dependencyTask.id] },
        undefined,
        undefined,
        harness.ctx,
      );

      const blockedUpdateResult = await updateTool.execute(
        "call-4",
        { taskId: blockedTask.id, status: "in_progress" },
        undefined,
        undefined,
        harness.ctx,
      );
      const missingGetResult = await getTool.execute(
        "call-5",
        { taskId: "9999" },
        undefined,
        undefined,
        harness.ctx,
      );

      expect(blockedUpdateResult.content[0]?.text).toContain(
        "task_update failed",
      );
      expect(
        (blockedUpdateResult.details as { error?: string }).error,
      ).toContain("blocked");
      expect(missingGetResult.content[0]?.text).toContain("task_get failed");
      expect((missingGetResult.details as { error?: string }).error).toContain(
        "does not exist",
      );
    });
  });
});
