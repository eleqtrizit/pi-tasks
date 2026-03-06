# ExtensionContext

Every handler receives `ctx: ExtensionContext`:

## ctx.ui

UI methods for user interaction. See [Custom UI](#custom-ui) for full details.

## ctx.hasUI

`false` in print mode (`-p`) and JSON mode. `true` in interactive and RPC mode. In RPC mode, dialog methods (`select`, `confirm`, `input`, `editor`) work via the extension UI sub-protocol, and fire-and-forget methods (`notify`, `setStatus`, `setWidget`, `setTitle`, `setEditorText`) emit requests to the client. Some TUI-specific methods are no-ops or return defaults (see [rpc.md](rpc.md#extension-ui-protocol)).

## ctx.cwd

Current working directory.

## ctx.sessionManager

Read-only access to session state. See [session.md](session.md) for the full SessionManager API and entry types.

```typescript
ctx.sessionManager.getEntries()       // All entries
ctx.sessionManager.getBranch()        // Current branch
ctx.sessionManager.getLeafId()        // Current leaf entry ID
```

## ctx.modelRegistry / ctx.model

Access to models and API keys.

## ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

Control flow helpers.

## ctx.shutdown()

Request a graceful shutdown of pi.

- **Interactive mode:** Deferred until the agent becomes idle (after processing all queued steering and follow-up messages).
- **RPC mode:** Deferred until the next idle state (after completing the current command response, when waiting for the next command).
- **Print mode:** No-op. The process exits automatically when all prompts are processed.

Emits `session_shutdown` event to all extensions before exiting. Available in all contexts (event handlers, tools, commands, shortcuts).

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

## ctx.getContextUsage()

Returns current context usage for the active model. Uses last assistant usage when available, then estimates tokens for trailing messages.

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

## ctx.compact()

Trigger compaction without awaiting completion. Use `onComplete` and `onError` for follow-up actions.

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
  },
});
```

## ctx.getSystemPrompt()

Returns the current effective system prompt. This includes any modifications made by `before_agent_start` handlers for the current turn.

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```
