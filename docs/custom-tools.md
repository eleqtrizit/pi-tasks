# Custom Tools

Register tools the LLM can call via `pi.registerTool()`. Tools appear in the system prompt and can have custom rendering.

Use `promptSnippet` for a short one-line entry in the `Available tools` section in the default system prompt. If omitted, pi falls back to `description`.

Use `promptGuidelines` to add tool-specific bullets to the default system prompt `Guidelines` section. These bullets are included only while the tool is active (for example, after `pi.setActiveTools([...])`).

Note: Some models are idiots and include the @ prefix in tool path arguments. Built-in tools strip a leading @ before resolving paths. If your custom tool accepts a path, normalize a leading @ as well.

## Tool Definition

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  promptSnippet: "List or add items in the project todo list",
  promptGuidelines: [
    "Use this tool for todo planning instead of direct file edits when the user asks for a task list."
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // Use StringEnum for Google compatibility
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Check for cancellation
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }

    // Stream progress updates
    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });

    // Run commands via pi.exec (captured from extension closure)
    const result = await pi.exec("some-command", [], { signal });

    // Return result
    return {
      content: [{ type: "text", text: "Done" }],  // Sent to LLM
      details: { data: result },                   // For rendering & state
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme) { ... },
  renderResult(result, options, theme) { ... },
});
```

**Important:** Use `StringEnum` from `@mariozechner/pi-ai` for string enums. `Type.Union`/`Type.Literal` doesn't work with Google's API.

## Overriding Built-in Tools

Extensions can override built-in tools (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`) by registering a tool with the same name. Interactive mode displays a warning when this happens.

```bash
# Extension's read tool replaces built-in read
pi -e ./tool-override.ts
```

Alternatively, use `--no-tools` to start without any built-in tools:
```bash
# No built-in tools, only extension tools
pi --no-tools -e ./my-extension.ts
```

See [examples/extensions/tool-override.ts](../examples/extensions/tool-override.ts) for a complete example that overrides `read` with logging and access control.

**Rendering:** If your override doesn't provide custom `renderCall`/`renderResult` functions, the built-in renderer is used automatically (syntax highlighting, diffs, etc.). This lets you wrap built-in tools for logging or access control without reimplementing the UI.

**Your implementation must match the exact result shape**, including the `details` type. The UI and session logic depend on these shapes for rendering and state tracking.

Built-in tool implementations:
- [read.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/read.ts) - `ReadToolDetails`
- [bash.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/bash.ts) - `BashToolDetails`
- [edit.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/grep.ts) - `GrepToolDetails`
- [find.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/find.ts) - `FindToolDetails`
- [ls.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/ls.ts) - `LsToolDetails`

## Remote Execution

Built-in tools support pluggable operations for delegating to remote systems (SSH, containers, etc.):

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@mariozechner/pi-coding-agent";

// Create tool with custom operations
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// Register, checking flag at execution time
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**Operations interfaces:** `ReadOperations`, `WriteOperations`, `EditOperations`, `BashOperations`, `LsOperations`, `GrepOperations`, `FindOperations`

The bash tool also supports a spawn hook to adjust the command, cwd, or env before execution:

```typescript
import { createBashTool } from "@mariozechner/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

See [examples/extensions/ssh.ts](../examples/extensions/ssh.ts) for a complete SSH example with `--ssh` flag.

## Output Truncation

**Tools MUST truncate their output** to avoid overwhelming the LLM context. Large outputs can cause:
- Context overflow errors (prompt too long)
- Compaction failures
- Degraded model performance

The built-in limit is **50KB** (~10k tokens) and **2000 lines**, whichever is hit first. Use the exported truncation utilities:

```typescript
import {
  truncateHead,      // Keep first N lines/bytes (good for file reads, search results)
  truncateTail,      // Keep last N lines/bytes (good for logs, command output)
  truncateLine,      // Truncate a single line to maxBytes with ellipsis
  formatSize,        // Human-readable size (e.g., "50KB", "1.5MB")
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@mariozechner/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // Apply truncation
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // Write full output to temp file
    const tempFile = writeTempFile(output);

    // Inform the LLM where to find complete output
    result += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
    result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    result += ` Full output saved to: ${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**Key points:**
- Use `truncateHead` for content where the beginning matters (search results, file reads)
- Use `truncateTail` for content where the end matters (logs, command output)
- Always inform the LLM when output is truncated and where to find the full version
- Document the truncation limits in your tool's description

See [examples/extensions/truncated-tool.ts](../examples/extensions/truncated-tool.ts) for a complete example wrapping `rg` (ripgrep) with proper truncation.

## Multiple Tools

One extension can register multiple tools with shared state:

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close();
  });
}
```

## Custom Rendering

Tools can provide `renderCall` and `renderResult` for custom TUI display. See [tui.md](tui.md) for the full component API and [tool-execution.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts) for how built-in tools render.

Tool output is wrapped in a `Box` that handles padding and background. Your render methods return `Component` instances (typically `Text`).

### renderCall

Renders the tool call (before/during execution):

```typescript
import { Text } from "@mariozechner/pi-tui";

renderCall(args, theme) {
  let text = theme.fg("toolTitle", theme.bold("my_tool "));
  text += theme.fg("muted", args.action);
  if (args.text) {
    text += " " + theme.fg("dim", `"${args.text}"`);
  }
  return new Text(text, 0, 0);  // 0,0 padding - Box handles it
}
```

### renderResult

Renders the tool result:

```typescript
renderResult(result, { expanded, isPartial }, theme) {
  // Handle streaming
  if (isPartial) {
    return new Text(theme.fg("warning", "Processing..."), 0, 0);
  }

  // Handle errors
  if (result.details?.error) {
    return new Text(theme.fg("error", `Error: ${result.details.error}`), 0, 0);
  }

  // Normal result - support expanded view (Ctrl+O)
  let text = theme.fg("success", "✓ Done");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

### Keybinding Hints

Use `keyHint()` to display keybinding hints that respect user's keybinding configuration:

```typescript
import { keyHint } from "@mariozechner/pi-coding-agent";

renderResult(result, { expanded }, theme) {
  let text = theme.fg("success", "✓ Done");
  if (!expanded) {
    text += ` (${keyHint("expandTools", "to expand")})`;
  }
  return new Text(text, 0, 0);
}
```

Available functions:
- `keyHint(action, description)` - Editor actions (e.g., `"expandTools"`, `"selectConfirm"`)
- `appKeyHint(keybindings, action, description)` - App actions (requires `KeybindingsManager`)
- `editorKey(action)` - Get raw key string for editor action
- `rawKeyHint(key, description)` - Format a raw key string

### Best Practices

- Use `Text` with padding `(0, 0)` - the Box handles padding
- Use `\n` for multi-line content
- Handle `isPartial` for streaming progress
- Support `expanded` for detail on demand
- Keep default view compact

### Fallback

If `renderCall`/`renderResult` is not defined or throws:
- `renderCall`: Shows tool name
- `renderResult`: Shows raw text from `content`
