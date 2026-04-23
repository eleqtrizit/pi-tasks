import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  Task,
  TaskCreateParams,
  TaskListItem,
  TaskStatus,
  TaskUpdateParams,
} from "./task-model.js";

const TASKS_ROOT_DIR = join(homedir(), ".pi", "tasks");
export const TASK_LIST_ID_ENV = "PI_TASK_LIST_ID";

export class TaskStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskStoreError";
  }
}

type TaskFileInput = Pick<TaskCreateParams, "subject"> &
  Partial<
    Pick<
      TaskCreateParams,
      "description" | "activeForm" | "metadata" | "addBlockedBy"
    >
  >;

function getTaskFilePath(listDirectory: string, taskId: string): string {
  return join(listDirectory, `${taskId}.json`);
}

function getUniqueTaskIds(taskIds: string[] | undefined): string[] {
  return [...new Set((taskIds ?? []).filter((taskId) => taskId.length > 0))];
}

function isDependencyBlocked(
  tasksById: Map<string, Task>,
  task: Task,
): boolean {
  return task.blockedBy.some(
    (dependencyId) => tasksById.get(dependencyId)?.status !== "completed",
  );
}

export function resolveTaskListId(
  existingSessionListId: string | undefined,
): string {
  const persistentListId = process.env[TASK_LIST_ID_ENV]?.trim();
  return persistentListId || existingSessionListId || randomUUID();
}

export class TaskStore {
  private readonly listId: string;
  private readonly listDirectory: string;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(listId: string) {
    this.listId = listId;
    this.listDirectory = join(TASKS_ROOT_DIR, listId);
  }

  /**
   * Execute an operation with exclusive access to prevent race conditions.
   * All file read/write operations go through this queue.
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    let resolve: () => void;
    const waitPromise = new Promise<void>((r) => {
      resolve = r;
    });

    const currentQueue = this.operationQueue;
    this.operationQueue = currentQueue.then(() => waitPromise);

    await currentQueue;
    try {
      return await operation();
    } finally {
      resolve!();
    }
  }

  public getListId(): string {
    return this.listId;
  }

  public async createTask(params: TaskFileInput): Promise<Task> {
    return this.withLock(async () => {
      await this.ensureListDirectory();
      const tasks = await this.listTasks();
      const tasksById = new Map(
        tasks.map((existingTask) => [existingTask.id, existingTask]),
      );

      const task: Task = {
        id: await this.getNextTaskId(),
        subject: params.subject,
        description: params.description ?? "",
        activeForm: params.activeForm ?? params.subject,
        owner: undefined,
        status: "pending",
        blocks: [],
        blockedBy: [],
        metadata: params.metadata ?? {},
      };

      const addedBlockedBy = getUniqueTaskIds(params.addBlockedBy);
      if (addedBlockedBy.length > 0) {
        if (addedBlockedBy.includes(task.id)) {
          throw new TaskStoreError(`Task #${task.id} cannot depend on itself.`);
        }

        for (const dependencyId of addedBlockedBy) {
          if (!tasksById.has(dependencyId)) {
            throw new TaskStoreError(`Task #${dependencyId} does not exist.`);
          }
        }

        task.blockedBy = addedBlockedBy;
      }

      await this.writeTask(task);

      for (const dependencyId of addedBlockedBy) {
        const dependencyTask = tasksById.get(dependencyId);
        if (dependencyTask) {
          dependencyTask.blocks = [
            ...new Set([...dependencyTask.blocks, task.id]),
          ];
          await this.writeTask(dependencyTask);
        }
      }

      return task;
    });
  }

  public async getTask(taskId: string): Promise<Task> {
    const task = await this.getTaskOrNull(taskId);
    if (!task) {
      throw new TaskStoreError(`Task #${taskId} does not exist.`);
    }
    return task;
  }

  public async listTasks(): Promise<Task[]> {
    await this.ensureListDirectory();
    const entries = await readdir(this.listDirectory, { withFileTypes: true });
    const taskFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);

    const tasks = await Promise.all(
      taskFiles.map(async (taskFileName) => {
        const taskContent = await readFile(
          join(this.listDirectory, taskFileName),
          "utf-8",
        );
        return JSON.parse(taskContent) as Task;
      }),
    );

    return tasks.sort((a, b) => Number(a.id) - Number(b.id));
  }

  public async listTaskItems(): Promise<TaskListItem[]> {
    const tasks = await this.listTasks();
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    return tasks.map((task) => ({
      ...task,
      isBlocked: isDependencyBlocked(tasksById, task),
    }));
  }

  public async clearTasks(): Promise<number> {
    return this.withLock(async () => {
      await this.ensureListDirectory();
      const entries = await readdir(this.listDirectory, {
        withFileTypes: true,
      });
      const taskFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => join(this.listDirectory, entry.name));

      await Promise.all(
        taskFiles.map(async (taskFilePath) => unlink(taskFilePath)),
      );
      return taskFiles.length;
    });
  }

  public async updateTask(params: TaskUpdateParams): Promise<Task> {
    return this.withLock(async () => {
      await this.ensureListDirectory();

      const task = await this.getTask(params.taskId);
      const tasks = await this.listTasks();
      const tasksById = new Map(
        tasks.map((existingTask) => [existingTask.id, existingTask]),
      );

      if (params.subject !== undefined) task.subject = params.subject;
      if (params.description !== undefined)
        task.description = params.description;
      if (params.activeForm !== undefined) task.activeForm = params.activeForm;
      if (params.owner !== undefined)
        task.owner = params.owner.trim() || undefined;
      if (params.status !== undefined) {
        this.assertAllowedStatusChange(tasksById, task, params.status);
        task.status = params.status;
      }

      const addedBlockedBy = getUniqueTaskIds(params.addBlockedBy);
      if (addedBlockedBy.length > 0) {
        for (const dependencyId of addedBlockedBy) {
          await this.assertTaskExists(dependencyId);
        }

        task.blockedBy = [...new Set([...task.blockedBy, ...addedBlockedBy])];

        for (const dependencyId of addedBlockedBy) {
          const dependencyTask = tasksById.get(dependencyId);
          if (dependencyTask) {
            dependencyTask.blocks = [
              ...new Set([...dependencyTask.blocks, task.id]),
            ];
            await this.writeTask(dependencyTask);
          }
        }
      }

      const addedBlocks = getUniqueTaskIds(params.addBlocks);
      if (addedBlocks.length > 0) {
        for (const blockedTaskId of addedBlocks) {
          await this.assertTaskExists(blockedTaskId);
        }

        task.blocks = [...new Set([...task.blocks, ...addedBlocks])];

        for (const blockedTaskId of addedBlocks) {
          const blockedTask = tasksById.get(blockedTaskId);
          if (blockedTask) {
            blockedTask.blockedBy = [
              ...new Set([...blockedTask.blockedBy, task.id]),
            ];
            await this.writeTask(blockedTask);
          }
        }
      }

      await this.writeTask(task);
      return task;
    });
  }

  private async assertTaskExists(taskId: string): Promise<void> {
    const task = await this.getTaskOrNull(taskId);
    if (!task) {
      throw new TaskStoreError(`Task #${taskId} does not exist.`);
    }
  }

  private async ensureListDirectory(): Promise<void> {
    await mkdir(this.listDirectory, { recursive: true });
  }

  private async getTaskOrNull(taskId: string): Promise<Task | null> {
    await this.ensureListDirectory();

    try {
      const taskContent = await readFile(
        getTaskFilePath(this.listDirectory, taskId),
        "utf-8",
      );
      return JSON.parse(taskContent) as Task;
    } catch {
      return null;
    }
  }

  private async getNextTaskId(): Promise<string> {
    const tasks = await this.listTasks();
    if (tasks.length === 0) {
      return "1";
    }

    const maxTaskId = tasks.reduce(
      (maxId, task) => Math.max(maxId, Number(task.id)),
      0,
    );
    return String(maxTaskId + 1);
  }

  private assertAllowedStatusChange(
    tasksById: Map<string, Task>,
    task: Task,
    nextStatus: TaskStatus,
  ): void {
    if (nextStatus === "pending") {
      return;
    }

    if (isDependencyBlocked(tasksById, task)) {
      throw new TaskStoreError(
        `Task #${task.id} is blocked by unfinished dependencies.`,
      );
    }
  }

  private async writeTask(task: Task): Promise<void> {
    await this.ensureListDirectory();
    const taskFilePath = getTaskFilePath(this.listDirectory, task.id);
    await writeFile(
      taskFilePath,
      `${JSON.stringify(task, null, 2)}\n`,
      "utf-8",
    );
  }
}
