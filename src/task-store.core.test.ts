import { describe, expect, it } from 'vitest';
import { withIsolatedTaskStoreContext } from './test-helpers/task-test-fixtures.js';

describe.sequential('task-store core behavior', () => {
    it('resolves list id from env var, existing id, or generated value', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            process.env.PI_TASK_LIST_ID = 'persisted-list';
            expect(taskStoreModule.resolveTaskListId('session-list')).toBe('persisted-list');

            delete process.env.PI_TASK_LIST_ID;
            expect(taskStoreModule.resolveTaskListId('session-list')).toBe('session-list');

            const generatedListId = taskStoreModule.resolveTaskListId(undefined);
            expect(generatedListId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });
    });

    it('creates tasks with defaults and auto-incrementing ids', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('core-create');

            const firstTask = await store.createTask({ subject: 'First task' });
            const secondTask = await store.createTask({ subject: 'Second task', description: 'details' });

            expect(firstTask.id).toBe('1');
            expect(firstTask.status).toBe('pending');
            expect(firstTask.activeForm).toBe('First task');
            expect(firstTask.description).toBe('');
            expect(firstTask.blocks).toEqual([]);
            expect(firstTask.blockedBy).toEqual([]);
            expect(firstTask.metadata).toEqual({});

            expect(secondTask.id).toBe('2');
            expect(secondTask.description).toBe('details');
        });
    });

    it('gets, lists, and persists tasks across store instances', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const listId = 'core-persistence';

            const store = new TaskStore(listId);
            await store.createTask({ subject: 'Task A' });
            await store.createTask({ subject: 'Task B' });

            const fromFirstStore = await store.listTasks();
            expect(fromFirstStore.map((task) => task.id)).toEqual(['1', '2']);

            const newStoreInstance = new TaskStore(listId);
            const secondTask = await newStoreInstance.getTask('2');
            const fromSecondStore = await newStoreInstance.listTasks();

            expect(secondTask.subject).toBe('Task B');
            expect(fromSecondStore.map((task) => task.id)).toEqual(['1', '2']);
        });
    });

    it('clears all tasks and returns number of deleted tasks', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('core-clear');

            await store.createTask({ subject: 'Task A' });
            await store.createTask({ subject: 'Task B' });

            const clearedCount = await store.clearTasks();
            const remainingTasks = await store.listTasks();

            expect(clearedCount).toBe(2);
            expect(remainingTasks).toEqual([]);
        });
    });

    it('throws when getting a missing task', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('core-missing');

            await expect(store.getTask('999')).rejects.toThrow('Task #999 does not exist.');
        });
    });

    it('blocks status transitions until dependencies are completed', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('core-blocking');

            const dependency = await store.createTask({ subject: 'Dependency' });
            const blockedTask = await store.createTask({ subject: 'Blocked task' });

            await store.updateTask({
                taskId: blockedTask.id,
                addBlockedBy: [dependency.id]
            });

            await expect(
                store.updateTask({ taskId: blockedTask.id, status: 'in_progress' })
            ).rejects.toThrow(`Task #${blockedTask.id} is blocked by unfinished dependencies.`);

            await store.updateTask({
                taskId: dependency.id,
                status: 'completed'
            });

            const updatedBlockedTask = await store.updateTask({
                taskId: blockedTask.id,
                status: 'in_progress'
            });
            expect(updatedBlockedTask.status).toBe('in_progress');
        });
    });
});
