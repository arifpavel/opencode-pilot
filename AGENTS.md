# OpenCode Pilot — Agent Guide

## Project
- Name: OpenCode Pilot
- Repo: https://github.com/arifpavel/opencode-pilot
- Stack: TypeScript, Node.js, Playwright, MCP

## Architecture
```
OpenCode CLI → Pilot Plugin → MCP Server (Playwright) → Browser Session
                                    ↓
                          State & Evidence Store
```

## Key Constraints
- Pilot is a plugin + MCP server, NOT an OpenCode fork. No core changes.
- All integration via existing MCP tool config in opencode.json.
- Browser automation via Playwright. No CDP directly.
- MVP is browser-only. No desktop/OS automation.
- Landing page is a separate marketing artifact, not product code.

## Convention
- Conventional commits (feat:, fix:, chore:, docs:, refactor:)
- Run linter before considering work done: npx biome check
- TypeScript, strict mode
