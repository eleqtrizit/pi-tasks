# ExtensionAPI Methods

## pi.on(event, handler)

Subscribe to events. See [Events](#events) for event types and return values.

## pi.registerTool(definition)

Register a custom tool callable by the LLM. See [Custom Tools](#custom-tools) for full details.

`pi.registerTool()` works both during extension load and after startup. You can call it inside `session_start`, command handlers, or other event handlers. New tools are refreshed immediately in the same session, so they appear in `pi.getAllTools()` and are callable by the LLM without `/reload`.

Use `pi.setActiveTools()` to enable or disable tools (including dynamically added tools) at runtime.

Use `promptSnippet` to customize that tool's one-line entry in `Available tools`, and `promptGuidelines` to append tool-specific bullets to the default `Guidelines` section when the tool is active.

See [dynamic-tools.ts](../examples/extensions/dynamic-tools.ts) for a full example.

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  promptSnippet: "Summarize or transform text according to action",
  promptGuidelines: ["Use this tool when the user asks to summarize previously generated text."],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme) { ... },
  renderResult(result, options, theme) { ... },
});
```

## pi.sendMessage(message, options?)

Inject a custom message into the session.

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

**Options:**
- `deliverAs` - Delivery mode:
  - `"steer"` (default) - Interrupts streaming. Delivered after current tool finishes, remaining tools skipped.
  - `"followUp"` - Waits for agent to finish. Delivered only when agent has no more tool calls.
  - `"nextTurn"` - Queued for next user prompt. Does not interrupt or trigger anything.
- `triggerTurn: true` - If agent is idle, trigger an LLM response immediately. Only applies to `"steer"` and `"followUp"` modes (ignored for `"nextTurn"`).

## pi.sendUserMessage(content, options?)

Send a user message to the agent. Unlike `sendMessage()` which sends custom messages, this sends an actual user message that appears as if typed by the user. Always triggers a turn.

```typescript
// Simple text message
pi.sendUserMessage("What is 2+2?");

// With content array (text + images)
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// During streaming - must specify delivery mode
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });
```

**Options:**
- `deliverAs` - Required when agent is streaming:
  - `"steer"` - Interrupts after current tool, remaining tools skipped
  - `"followUp"` - Waits for agent to finish all tools

When not streaming, the message is sent immediately and triggers a new turn. When streaming without `deliverAs`, throws an error.

See [send-user-message.ts](../examples/extensions/send-user-message.ts) for a complete example.

## pi.appendEntry(customType, data?)

Persist extension state (does NOT participate in LLM context).

```typescript
pi.appendEntry("my-state", { count: 42 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

## pi.setSessionName(name)

Set the session display name (shown in session selector instead of first message).

```typescript
pi.setSessionName("Refactor auth module");
```

## pi.getSessionName()

Get the current session name, if set.

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

## pi.setLabel(entryId, label)

Set or clear a label on an entry. Labels are user-defined markers for bookmarking and navigation (shown in `/tree` selector).

```typescript
// Set a label
pi.setLabel(entryId, "checkpoint-before-refactor");

// Clear a label
pi.setLabel(entryId, undefined);

// Read labels via sessionManager
const label = ctx.sessionManager.getLabel(entryId);
```

Labels persist in the session and survive restarts. Use them to mark important points (turns, checkpoints) in the conversation tree.

## pi.registerCommand(name, options)

Register a command.

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  }
});
```

Optional: add argument auto-completion for `/command ...`:

```typescript
import type { AutocompleteItem } from "@mariozechner/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying: ${args}`, "info");
  },
});
```

## pi.getCommands()

Get the slash commands available for invocation via `prompt` in the current session. Includes extension commands, prompt templates, and skill commands.
The list matches the RPC `get_commands` ordering: extensions first, then templates, then skills.

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
```

Each entry has this shape:

```typescript
{
  name: string; // Command name without the leading slash
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: "user" | "project" | "path"; // For templates and skills
  path?: string; // Files backing templates, skills, and extensions
}
```

Built-in interactive commands (like `/model` and `/settings`) are not included here. They are handled only in interactive
mode and would not execute if sent via `prompt`.

## pi.registerMessageRenderer(customType, renderer)

Register a custom TUI renderer for messages with your `customType`. See [Custom UI](#custom-ui).

## pi.registerShortcut(shortcut, options)

Register a keyboard shortcut. See [keybindings.md](keybindings.md) for the shortcut format and built-in keybindings.

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle plan mode",
  handler: async (ctx) => {
    ctx.ui.notify("Toggled!");
  },
});
```

## pi.registerFlag(name, options)

Register a CLI flag.

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

// Check value
if (pi.getFlag("--plan")) {
  // Plan mode enabled
}
```

## pi.exec(command, args, options?)

Execute a shell command.

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

## pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

Manage active tools. This works for both built-in tools and dynamically registered tools.

```typescript
const active = pi.getActiveTools();  // ["read", "bash", "edit", "write"]
const all = pi.getAllTools();        // [{ name: "read", description: "Read file contents..." }, ...]
const names = all.map(t => t.name);  // Just names if needed
pi.setActiveTools(["read", "bash"]); // Switch to read-only
```

## pi.setModel(model)

Set the current model. Returns `false` if no API key is available for the model. See [models.md](models.md) for configuring custom models.

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("No API key for this model", "error");
  }
}
```

## pi.getThinkingLevel() / pi.setThinkingLevel(level)

Get or set the thinking level. Level is clamped to model capabilities (non-reasoning models always use "off").

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
pi.setThinkingLevel("high");
```

## pi.events

Shared event bus for communication between extensions:

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

## pi.registerProvider(name, config)

Register or override a model provider dynamically. Useful for proxies, custom endpoints, or team-wide model configurations.

Calls made during the extension factory function are queued and applied once the runner initialises. Calls made after that — for example from a command handler following a user setup flow — take effect immediately without requiring a `/reload`.

```typescript
// Register a new provider with custom models
pi.registerProvider("my-proxy", {
  baseUrl: "https://proxy.example.com",
  apiKey: "PROXY_API_KEY",  // env var name or literal
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (proxy)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Override baseUrl for an existing provider (keeps all models)
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Register provider with OAuth support for /login
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // Custom OAuth flow
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials) {
      // Refresh logic
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    }
  }
});
```

**Config options:**
- `baseUrl` - API endpoint URL. Required when defining models.
- `apiKey` - API key or environment variable name. Required when defining models (unless `oauth` provided).
- `api` - API type: `"anthropic-messages"`, `"openai-completions"`, `"openai-responses"`, etc.
- `headers` - Custom headers to include in requests.
- `authHeader` - If true, adds `Authorization: Bearer` header automatically.
- `models` - Array of model definitions. If provided, replaces all existing models for this provider.
- `oauth` - OAuth provider config for `/login` support. When provided, the provider appears in the login menu.
- `streamSimple` - Custom streaming implementation for non-standard APIs.

See [custom-provider.md](custom-provider.md) for advanced topics: custom streaming APIs, OAuth details, model definition reference.

## pi.unregisterProvider(name)

Remove a previously registered provider and its models. Built-in models that were overridden by the provider are restored. Has no effect if the provider was not registered.

Like `registerProvider`, this takes effect immediately when called after the initial load phase, so a `/reload` is not required.

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "Remove the custom proxy provider",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```
