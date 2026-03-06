import { Static, Type } from '@sinclair/typebox';

export const TaskStatusSchema = Type.Union([
    Type.Literal('pending'),
    Type.Literal('in_progress'),
    Type.Literal('completed')
]);

export type TaskStatus = Static<typeof TaskStatusSchema>;

export const TaskSchema = Type.Object(
    {
        id: Type.String(),
        subject: Type.String(),
        description: Type.String(),
        activeForm: Type.String(),
        owner: Type.Optional(Type.String()),
        status: TaskStatusSchema,
        blocks: Type.Array(Type.String()),
        blockedBy: Type.Array(Type.String()),
        metadata: Type.Record(Type.String(), Type.Unknown())
    },
    { additionalProperties: false }
);

export type Task = Static<typeof TaskSchema>;

export const TaskListItemSchema = Type.Composite([
    TaskSchema,
    Type.Object({
        isBlocked: Type.Boolean()
    })
]);

export type TaskListItem = Static<typeof TaskListItemSchema>;

export const TaskCreateParamsSchema = Type.Object(
    {
        subject: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
        activeForm: Type.Optional(Type.String()),
        addBlockedBy: Type.Array(Type.String({ minLength: 1 })),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
    },
    { additionalProperties: false }
);

export type TaskCreateParams = Static<typeof TaskCreateParamsSchema>;

export const TaskUpdateParamsSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 }),
        status: Type.Optional(TaskStatusSchema),
        owner: Type.Optional(Type.String()),
        subject: Type.Optional(Type.String({ minLength: 1 })),
        description: Type.Optional(Type.String()),
        activeForm: Type.Optional(Type.String()),
        addBlockedBy: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
        addBlocks: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
    },
    { additionalProperties: false }
);

export type TaskUpdateParams = Static<typeof TaskUpdateParamsSchema>;

export const TaskGetParamsSchema = Type.Object(
    {
        taskId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

export type TaskGetParams = Static<typeof TaskGetParamsSchema>;

export const TaskListParamsSchema = Type.Object({}, { additionalProperties: false });
