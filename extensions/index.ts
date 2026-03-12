import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Static } from '@sinclair/typebox';
import {
    TaskCreateParamsSchema,
    TaskGetParamsSchema,
    TaskListParamsSchema,
    TaskUpdateParamsSchema
} from '../src/task-model.js';
import { resolveTaskListId, TASK_LIST_ID_ENV, TaskStore, TaskStoreError } from '../src/task-store.js';
import { renderTaskList, renderTaskWidget } from '../src/task-widget.js';

const TASK_STATE_ENTRY_TYPE = 'pi-taskgraph-state';
const TASK_WIDGET_ID = 'pi-taskgraph-widget';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getStore(store: TaskStore | undefined): TaskStore {
    if (!store) {
        throw new TaskStoreError('Task store is not initialized yet.');
    }
    return store;
}

function getListIdFromEntryData(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') {
        return undefined;
    }

    const { listId } = data as { listId?: unknown };
    return typeof listId === 'string' ? listId : undefined;
}

export default function (pi: ExtensionAPI) {
    let taskStore: TaskStore | undefined;

    async function refreshWidget(ctx: any): Promise<void> {
        const store = getStore(taskStore);
        const taskItems = await store.listTaskItems();
        const lines = renderTaskWidget(taskItems);
        ctx.ui.setWidget(TASK_WIDGET_ID, lines);
    }

    pi.on('session_start', async (_event, ctx) => {
        let restoredListId: string | undefined;

        for (const entry of ctx.sessionManager.getEntries()) {
            if (entry.type === 'custom' && entry.customType === TASK_STATE_ENTRY_TYPE) {
                restoredListId = getListIdFromEntryData(entry.data);
            }
        }

        const resolvedListId = resolveTaskListId(restoredListId);
        process.env[TASK_LIST_ID_ENV] = resolvedListId;
        taskStore = new TaskStore(resolvedListId);
        pi.appendEntry(TASK_STATE_ENTRY_TYPE, { listId: resolvedListId });

        await refreshWidget(ctx);
    });

    pi.registerCommand('list-tasks', {
        description: 'Display all tasks with status, owner, and dependency info',
        handler: async (_args, _ctx) => {
            try {
                const store = getStore(taskStore);
                const taskItems = await store.listTaskItems();
                const content = renderTaskList(taskItems);
                pi.sendMessage({ customType: 'list-tasks', content, display: true });
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                pi.sendMessage({ customType: 'list-tasks', content: `list-tasks failed: ${message}`, display: true });
            }
        }
    });

    pi.registerCommand('clear-tasks', {
        description: 'Delete all tasks from the current task list',
        handler: async (_args, ctx) => {
            try {
                const store = getStore(taskStore);
                const clearedCount = await store.clearTasks();
                await refreshWidget(ctx);
                pi.sendMessage({
                    customType: 'clear-tasks',
                    content: `Cleared ${clearedCount} task(s).`,
                    display: true
                });
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                pi.sendMessage({ customType: 'clear-tasks', content: `clear-tasks failed: ${message}`, display: true });
            }
        }
    });

    pi.registerTool({
        name: 'task_create',
        label: 'task_create',
        description:
            'Create a new dependency-aware task. Add dependencies by specifying the task IDs in the `addBlockedBy` array. E.g. `addBlockedBy: ["1", "2"]`',
        parameters: TaskCreateParamsSchema as any,
        async execute(_toolCallId, params: Static<typeof TaskCreateParamsSchema>, _signal, _onUpdate, ctx) {
            try {
                const store = getStore(taskStore);
                const task = await store.createTask(params);
                await refreshWidget(ctx);

                return {
                    content: [{ type: 'text', text: `Created task #${task.id}: ${task.subject}` }],
                    details: task
                };
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                return {
                    content: [{ type: 'text', text: `task_create failed: ${message}` }],
                    details: { error: message }
                };
            }
        }
    });

    pi.registerTool({
        name: 'task_update',
        label: 'task_update',
        description: 'Update task fields, status, owner, and dependencies.',
        parameters: TaskUpdateParamsSchema as any,
        async execute(_toolCallId, params: Static<typeof TaskUpdateParamsSchema>, _signal, _onUpdate, ctx) {
            try {
                const store = getStore(taskStore);
                const updatedTask = await store.updateTask(params);
                await refreshWidget(ctx);

                return {
                    content: [{ type: 'text', text: `Updated task #${updatedTask.id}: ${updatedTask.subject}` }],
                    details: updatedTask
                };
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                return {
                    content: [{ type: 'text', text: `task_update failed: ${message}` }],
                    details: { error: message }
                };
            }
        }
    });

    pi.registerTool({
        name: 'task_get',
        label: 'task_get',
        description: 'Retrieve full details for a specific task.',
        parameters: TaskGetParamsSchema as any,
        async execute(_toolCallId, params: Static<typeof TaskGetParamsSchema>, _signal, _onUpdate, _ctx) {
            try {
                const store = getStore(taskStore);
                const taskItems = await store.listTaskItems();
                const taskItem = taskItems.find((t) => t.id === params.taskId);
                if (!taskItem) {
                    throw new TaskStoreError(`Task #${params.taskId} does not exist.`);
                }

                const blockedByText = taskItem.blockedBy.length > 0 ? taskItem.blockedBy.join(', ') : 'none';
                const blocksText = taskItem.blocks.length > 0 ? taskItem.blocks.join(', ') : 'none';
                const text = [
                    `Task #${taskItem.id}: ${taskItem.subject}`,
                    `Status: ${taskItem.status}${taskItem.isBlocked ? ' (blocked)' : ''}`,
                    `Owner: ${taskItem.owner ?? 'unassigned'}`,
                    `Blocked by: ${blockedByText}`,
                    `Blocks: ${blocksText}`,
                    `Description: ${taskItem.description}`
                ].join('\n');

                return {
                    content: [{ type: 'text', text }],
                    details: taskItem
                };
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                return {
                    content: [{ type: 'text', text: `task_get failed: ${message}` }],
                    details: { error: message }
                };
            }
        }
    });

    pi.registerTool({
        name: 'task_list',
        label: 'task_list',
        description: 'List all tasks with dependency-aware blocked state.',
        parameters: TaskListParamsSchema as any,
        async execute(_toolCallId, _params: Static<typeof TaskListParamsSchema>, _signal, _onUpdate, _ctx) {
            try {
                const store = getStore(taskStore);
                const tasks = await store.listTaskItems();

                return {
                    content: [{ type: 'text', text: `Listed ${tasks.length} task(s).` }],
                    details: { tasks }
                };
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                return {
                    content: [{ type: 'text', text: `task_list failed: ${message}` }],
                    details: { error: message }
                };
            }
        }
    });

    pi.registerTool({
        name: 'clear_tasks',
        label: 'clear_tasks',
        description: 'Delete all tasks in the current task list.',
        parameters: TaskListParamsSchema as any,
        async execute(_toolCallId, _params: Static<typeof TaskListParamsSchema>, _signal, _onUpdate, ctx) {
            try {
                const store = getStore(taskStore);
                const clearedCount = await store.clearTasks();
                await refreshWidget(ctx);

                return {
                    content: [{ type: 'text', text: `Cleared ${clearedCount} task(s).` }],
                    details: { clearedCount }
                };
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                return {
                    content: [{ type: 'text', text: `clear_tasks failed: ${message}` }],
                    details: { error: message }
                };
            }
        }
    });

    pi.registerTool({
        name: 'get_batch_of_tasks',
        label: 'get_batch_of_tasks',
        description:
            'Return all pending, unblocked tasks that can be executed in parallel right now. A task is included if its status is "pending" and all its dependencies are completed.  USE THIS TOOL TO GET THE TASKS THAT CAN BE EXECUTED IN PARALLEL IF YOU HAVE A TEAM OF AGENTS / WORKERS.',
        parameters: TaskListParamsSchema as any,
        async execute(_toolCallId, _params: Static<typeof TaskListParamsSchema>, _signal, _onUpdate, _ctx) {
            try {
                const store = getStore(taskStore);
                const tasks = await store.listTaskItems();
                const batch = tasks.filter((t) => t.status === 'pending' && !t.isBlocked);

                const text =
                    batch.length > 0
                        ? `${batch.length} task(s) ready to run in parallel:\n${batch.map((t) => `#${t.id}: ${t.subject}`).join('\n')}`
                        : 'No tasks are currently available to run in parallel.';

                return {
                    content: [{ type: 'text', text }],
                    details: { tasks: batch }
                };
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                return {
                    content: [{ type: 'text', text: `get_batch_of_tasks failed: ${message}` }],
                    details: { error: message }
                };
            }
        }
    });
}
