import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';

type TaskStoreModule = typeof import('../task-store.js');

export interface IsolatedTaskStoreContext {
    tempHomeDir: string;
    taskStoreModule: TaskStoreModule;
}

export async function withIsolatedTaskStoreContext(
    runTest: (context: IsolatedTaskStoreContext) => Promise<void>
): Promise<void> {
    const originalHome = process.env.HOME;
    const originalTaskListId = process.env.PI_TASK_LIST_ID;
    const tempHomeDir = await mkdtemp(join(tmpdir(), 'pi-taskgraph-home-'));

    process.env.HOME = tempHomeDir;
    delete process.env.PI_TASK_LIST_ID;
    vi.resetModules();

    const taskStoreModule = await import('../task-store.js');

    try {
        await runTest({ tempHomeDir, taskStoreModule });
    } finally {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }

        if (originalTaskListId === undefined) {
            delete process.env.PI_TASK_LIST_ID;
        } else {
            process.env.PI_TASK_LIST_ID = originalTaskListId;
        }

        vi.resetModules();
        await rm(tempHomeDir, { recursive: true, force: true });
    }
}
