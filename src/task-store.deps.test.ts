import { describe, expect, it } from 'vitest';
import { withIsolatedTaskStoreContext } from './test-helpers/task-test-fixtures.js';

describe.sequential('task-store dependency semantics', () => {
    it('applies addBlockedBy during create and maintains reciprocal links', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('deps-create-blocked-by');

            const dependency = await store.createTask({ subject: 'Dependency' });
            const blockedTask = await store.createTask({
                subject: 'Blocked',
                addBlockedBy: [dependency.id, dependency.id]
            });

            const refreshedDependency = await store.getTask(dependency.id);
            const refreshedBlockedTask = await store.getTask(blockedTask.id);

            expect(refreshedBlockedTask.blockedBy).toEqual([dependency.id]);
            expect(refreshedDependency.blocks).toEqual([blockedTask.id]);
        });
    });

    it('throws when create addBlockedBy references a missing task', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('deps-create-missing');

            await expect(
                store.createTask({
                    subject: 'Blocked',
                    addBlockedBy: ['999']
                })
            ).rejects.toThrow('Task #999 does not exist.');
        });
    });

    it('appends addBlockedBy without replacing and deduplicates values', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('deps-blocked-by');

            const taskOne = await store.createTask({ subject: 'Task 1' });
            const taskTwo = await store.createTask({ subject: 'Task 2' });
            const taskThree = await store.createTask({ subject: 'Task 3' });

            await store.updateTask({ taskId: taskThree.id, addBlockedBy: [taskOne.id] });
            await store.updateTask({
                taskId: taskThree.id,
                addBlockedBy: [taskTwo.id, taskOne.id]
            });

            const updatedTaskThree = await store.getTask(taskThree.id);
            expect(updatedTaskThree.blockedBy).toEqual([taskOne.id, taskTwo.id]);
        });
    });

    it('appends addBlocks without replacing and deduplicates values', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('deps-blocks');

            const parentTask = await store.createTask({ subject: 'Parent' });
            const childOne = await store.createTask({ subject: 'Child 1' });
            const childTwo = await store.createTask({ subject: 'Child 2' });

            await store.updateTask({ taskId: parentTask.id, addBlocks: [childOne.id] });
            await store.updateTask({
                taskId: parentTask.id,
                addBlocks: [childTwo.id, childOne.id]
            });

            const updatedParent = await store.getTask(parentTask.id);
            expect(updatedParent.blocks).toEqual([childOne.id, childTwo.id]);
        });
    });

    it('maintains reciprocal links when addBlockedBy is used', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('deps-reciprocal-blocked-by');

            const dependency = await store.createTask({ subject: 'Dependency' });
            const blockedTask = await store.createTask({ subject: 'Blocked' });

            await store.updateTask({
                taskId: blockedTask.id,
                addBlockedBy: [dependency.id]
            });

            const refreshedDependency = await store.getTask(dependency.id);
            const refreshedBlockedTask = await store.getTask(blockedTask.id);

            expect(refreshedBlockedTask.blockedBy).toEqual([dependency.id]);
            expect(refreshedDependency.blocks).toEqual([blockedTask.id]);
        });
    });

    it('maintains reciprocal links when addBlocks is used', async () => {
        await withIsolatedTaskStoreContext(async ({ taskStoreModule }) => {
            const { TaskStore } = taskStoreModule;
            const store = new TaskStore('deps-reciprocal-blocks');

            const blockerTask = await store.createTask({ subject: 'Blocker' });
            const blockedTask = await store.createTask({ subject: 'Blocked' });

            await store.updateTask({
                taskId: blockerTask.id,
                addBlocks: [blockedTask.id]
            });

            const refreshedBlockerTask = await store.getTask(blockerTask.id);
            const refreshedBlockedTask = await store.getTask(blockedTask.id);

            expect(refreshedBlockerTask.blocks).toEqual([blockedTask.id]);
            expect(refreshedBlockedTask.blockedBy).toEqual([blockerTask.id]);
        });
    });
});
