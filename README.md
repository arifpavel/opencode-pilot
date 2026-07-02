# OpenCode Pilot

**The coding agent that can run the workflow too.**

OpenCode Pilot is an OpenCode-native agent workspace that gives coding agents a controlled browser and optional computer-use layer. Reproduce bugs, inspect dashboards, validate flows, and complete real workflows instead of stopping at code generation.

## Problem

Today's coding agents can reason over repositories and use tools, but break once interaction moves into the browser or UI layer. Developers who want one agent that can both understand the codebase **and** act inside the product are forced to context-switch between agent and browser.

## Solution

OpenCode Pilot adds a structured browser execution layer to OpenCode:

- **Persistent browser workspace** — long-lived session, preserved state, cookies
- **Task execution engine** — high-level goal → plan → actions → verification → summary
- **Approval & safety controls** — gates for risky actions (forms, deletes, credentials)
- **Observability** — screenshots, action logs, failure points, final report
- **Session memory** — continuity across tasks

## Architecture

```
OpenCode CLI → Pilot Plugin → MCP Server (Playwright) → Browser Session
                                    ↓
                          State & Evidence Store
```

## MVP Scope

- One persistent browser workspace
- Structured task mode (goal → plan → execute → verify)
- Browser actions via MCP (navigate, click, type, screenshot, extract, inspect)
- Confirmation gates for high-risk actions
- Screenshots + action history per task
- Session reuse for login continuity
- Final execution report

## Comparison

See [COMPARISON.md](./COMPARISON.md) for a detailed breakdown against existing OpenCode browser plugins.

## License

MIT
