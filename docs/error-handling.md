# Error Handling

- Extension errors are logged, agent continues
- `tool_call` errors block the tool (fail-safe)
- Tool `execute` errors are reported to the LLM with `isError: true`
