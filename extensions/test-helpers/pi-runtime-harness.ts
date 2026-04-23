import { vi } from "vitest";

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  details: unknown;
};

type RegisteredTool = {
  name: string;
  execute: (
    toolCallId: string,
    params: any,
    signal: AbortSignal | undefined,
    onUpdate: ((update: unknown) => void) | undefined,
    ctx: any,
  ) => Promise<ToolResult>;
};

type SessionStartHandler = (_event: unknown, ctx: any) => Promise<void>;

export interface PiRuntimeHarness {
  tools: Map<string, RegisteredTool>;
  appendEntryMock: ReturnType<typeof vi.fn>;
  setWidgetMock: ReturnType<typeof vi.fn>;
  ctx: any;
  triggerSessionStart: () => Promise<void>;
}

export function createPiRuntimeHarness(entries: unknown[] = []): {
  pi: any;
  harness: PiRuntimeHarness;
} {
  const tools = new Map<string, RegisteredTool>();
  let sessionStartHandler: SessionStartHandler | undefined;

  const appendEntryMock = vi.fn();
  const setWidgetMock = vi.fn();

  const ctx = {
    ui: {
      setWidget: setWidgetMock,
    },
    sessionManager: {
      getEntries: () => entries,
    },
  };

  const pi = {
    on: (eventName: string, handler: SessionStartHandler) => {
      if (eventName === "session_start") {
        sessionStartHandler = handler;
      }
    },
    registerTool: (tool: RegisteredTool) => {
      tools.set(tool.name, tool);
    },
    registerCommand: vi.fn(),
    sendMessage: vi.fn(),
    appendEntry: appendEntryMock,
  };

  const harness: PiRuntimeHarness = {
    tools,
    appendEntryMock,
    setWidgetMock,
    ctx,
    triggerSessionStart: async () => {
      if (!sessionStartHandler) {
        throw new Error("session_start handler is not registered.");
      }
      await sessionStartHandler({}, ctx);
    },
  };

  return { pi, harness };
}
