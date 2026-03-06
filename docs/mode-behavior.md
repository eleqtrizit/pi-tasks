# Mode Behavior

| Mode | UI Methods | Notes |
|------|-----------|-------|
| Interactive | Full TUI | Normal operation |
| RPC (`--mode rpc`) | JSON protocol | Host handles UI, see [rpc.md](rpc.md) |
| JSON (`--mode json`) | No-op | Event stream to stdout, see [json.md](json.md) |
| Print (`-p`) | No-op | Extensions run but can't prompt |

In non-interactive modes, check `ctx.hasUI` before using UI methods.
