import { TaskListItem } from "./task-model.js";

const MAX_VISIBLE_TASKS = 5;

function getStatusSymbol(task: TaskListItem): string {
  if (task.status === "completed") {
    return "✓";
  }

  if (task.status === "in_progress") {
    return "■";
  }

  return task.isBlocked ? "⚠" : "□";
}

function formatBlockedBy(task: TaskListItem): string {
  if (!task.isBlocked || task.blockedBy.length === 0) {
    return "";
  }

  const blockedByLabel = task.blockedBy
    .map((dependencyId) => `#${dependencyId}`)
    .join(", ");
  return ` > blocked by ${blockedByLabel}`;
}

function formatOwner(task: TaskListItem): string {
  return task.owner ? ` (${task.owner})` : "";
}

function formatTaskLine(task: TaskListItem): string {
  const symbol = getStatusSymbol(task);
  return `${symbol} #${task.id} ${task.subject}${formatOwner(task)}${formatBlockedBy(task)}`;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Done",
  in_progress: "In Progress",
  pending: "Pending",
};

/**
 * Render all tasks as a human-readable markdown string for the /list-tasks command.
 *
 * :param taskItems: All task list items to display
 * :type taskItems: TaskListItem[]
 * :return: Formatted markdown string
 * :rtype: string
 */
export function renderTaskList(taskItems: TaskListItem[]): string {
  const completedCount = taskItems.filter(
    (t) => t.status === "completed",
  ).length;
  const inProgressCount = taskItems.filter(
    (t) => t.status === "in_progress",
  ).length;
  const openCount = taskItems.filter((t) => t.status === "pending").length;

  const header = `## Tasks (${completedCount} done, ${inProgressCount} in progress, ${openCount} open)`;

  if (taskItems.length === 0) {
    return `${header}\n\nNo tasks yet.`;
  }

  const sortedTasks = [...taskItems].sort(
    (a, b) => Number(a.id) - Number(b.id),
  );

  const rows = sortedTasks.map((task) => {
    const symbol = getStatusSymbol(task);
    const status = STATUS_LABELS[task.status] ?? task.status;
    const blocked = task.isBlocked
      ? ` ⚠ blocked by ${task.blockedBy.map((id) => `#${id}`).join(", ")}`
      : "";
    const owner = task.owner ? ` (${task.owner})` : "";
    return `- ${symbol} **#${task.id}** ${task.subject}${owner} — ${status}${blocked}`;
  });

  return `${header}\n\n${rows.join("\n")}`;
}

export function renderTaskWidget(taskItems: TaskListItem[]): string[] {
  if (taskItems.length === 0) {
    return [];
  }

  const completedCount = taskItems.filter(
    (task) => task.status === "completed",
  ).length;
  const inProgressCount = taskItems.filter(
    (task) => task.status === "in_progress",
  ).length;
  const openCount = taskItems.filter(
    (task) => task.status === "pending",
  ).length;

  const header = `Tasks (${completedCount} done, ${inProgressCount} in progress, ${openCount} open)`;

  const sortedTasks = [...taskItems].sort(
    (a, b) => Number(a.id) - Number(b.id),
  );
  const incompleteTasks = sortedTasks.filter(
    (task) => task.status !== "completed",
  );
  const visibleTasks = incompleteTasks
    .slice(0, MAX_VISIBLE_TASKS)
    .map(formatTaskLine);
  const hiddenCount = incompleteTasks.length - visibleTasks.length;

  if (hiddenCount > 0) {
    visibleTasks.push(`... +${hiddenCount} more (run /list-tasks to show all)`);
  }

  return [header, ...visibleTasks];
}
