# OpenCode Pilot — Technical PRD

> A controlled browser layer for coding agents, built as an OpenCode plugin and MCP runtime.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [MCP Tool Schemas](#2-mcp-tool-schemas)
3. [Plugin API Surface](#3-plugin-api-surface)
4. [Data Model](#4-data-model)
5. [Store Schema (File-Based)](#5-store-schema-file-based)
6. [Risk Table](#6-risk-table)
7. [Open Questions](#7-open-questions)
8. [Implementation Milestones](#8-implementation-milestones)

---

## 1. Architecture

The system is composed of four layers that communicate exclusively through well-defined interfaces.

```
+-------------------+       MCP transport        +---------------------+
|   OpenCode CLI    | <---- JSON-RPC (stdio) ---> |   Pilot Plugin      |
|                   |                             |  (opencode.json     |
|                   |                             |   tools config)     |
+-------------------+                             +---------+-----------+
                                                            |
                                              MCP transport |
                                              JSON-RPC stdio|
                                                            v
+-------------------+       Playwright API     +---------------------+
|  Browser Session  | <---- websocket/http ---> |   MCP Server        |
|  (Chromium)       |                           |  (Playwright host)  |
|                   |                           |                     |
+-------------------+                           +---------+-----------+
                                                            |
                                                    file I/O |
                                                            v
                                                  +---------------------+
                                                  |  State & Evidence   |
                                                  |  Store (JSON/FS)    |
                                                  |                     |
                                                  +---------------------+
```

**Component responsibilities:**

| Layer | Role | Technology |
|-------|------|------------|
| OpenCode CLI | User-facing terminal; provides `/pilot` commands and renders console output | OpenCode (unmodified) |
| Pilot Plugin | Registers MCP tools, formats console output, intercepts approval gates | TypeScript, opencode.json |
| MCP Server | Owns the Playwright browser instance, executes all browser actions | TypeScript, @playwright/browser |
| State & Evidence Store | Persists sessions, actions, tasks, and screenshots to disk | File system (JSON + PNG) |

**Integration contract** — The plugin registers MCP tools in `opencode.json` under `mcpServers`:

```jsonc
// opencode.json
{
  "mcpServers": {
    "pilot": {
      "command": "node",
      "args": ["path/to/pilot-server/index.js"],
      "env": {
        "PILOT_STORE_DIR": "~/.opencode-pilot"
      }
    }
  }
}
```

No changes to OpenCode core. All integration is via the existing MCP tool configuration mechanism.

---

## 2. MCP Tool Schemas

Each tool is surfaced to the LLM through the MCP protocol. The MCP server exposes a `tools/list` endpoint returning these definitions.

### 2.1 `pilot_navigate`

| Field | Value |
|-------|-------|
| Description | Navigate the browser to a given URL. Waits for `load` event. |
| Input | `{ url: string }` |
| Output | `{ success: boolean, url: string, title: string, status: number }` |
| Errors | Invalid URL, timeout (30s), DNS failure |

```
Request:
  { "tool": "pilot_navigate", "args": { "url": "https://example.com" } }

Response:
  { "success": true, "url": "https://example.com", "title": "Example Domain", "status": 200 }
```

### 2.2 `pilot_click`

| Field | Value |
|-------|-------|
| Description | Click an element identified by CSS selector or visible text. Uses Playwright `locator`. |
| Input | `{ selector: string }` |
| Output | `{ success: boolean, selector: string, tag: string, text?: string }` |
| Errors | Element not found, element detached, timeout (10s) |
| Risky | Yes — configurable in approval gates |

```
Request:
  { "tool": "pilot_click", "args": { "selector": "#submit-btn" } }

Response:
  { "success": true, "selector": "#submit-btn", "tag": "button", "text": "Submit" }
```

### 2.3 `pilot_type`

| Field | Value |
|-------|-------|
| Description | Type text into a focused or specified input field. Clears field first. |
| Input | `{ selector: string, text: string }` |
| Output | `{ success: boolean, selector: string, charCount: number }` |
| Errors | Element not found, element not editable, timeout (10s) |
| Risky | Yes — if text contains credential-like patterns |

```
Request:
  { "tool": "pilot_type", "args": { "selector": "#email", "text": "user@example.com" } }

Response:
  { "success": true, "selector": "#email", "charCount": 17 }
```

### 2.4 `pilot_screenshot`

| Field | Value |
|-------|-------|
| Description | Capture a screenshot of the current viewport. Optionally name the capture for later reference. |
| Input | `{ name?: string }` |
| Output | `{ success: boolean, path: string, width: number, height: number, name: string }` |
| Errors | Browser context closed, viewport not available |

```
Request:
  { "tool": "pilot_screenshot", "args": { "name": "login-state" } }

Response:
  { "success": true, "path": "~/.opencode-pilot/screenshots/login-state-1710000000.png",
    "width": 1280, "height": 720, "name": "login-state" }
```

### 2.5 `pilot_extract`

| Field | Value |
|-------|-------|
| Description | Extract text content from the page. If selector is provided, returns text of matching elements. Otherwise returns full `document.body.innerText`. |
| Input | `{ selector?: string }` |
| Output | `{ success: boolean, content: string, elements: number }` |
| Errors | Invalid selector |

```
Request:
  { "tool": "pilot_extract", "args": { "selector": "h1" } }

Response:
  { "success": true, "content": "Welcome to Example", "elements": 1 }
```

### 2.6 `pilot_inspect`

| Field | Value |
|-------|-------|
| Description | Collect browser console logs, network request/response logs, and uncaught errors since last call. Clearing the buffer after read. |
| Input | `{}` |
| Output | `{ success: boolean, console: LogEntry[], network: NetworkEntry[], errors: ErrorEntry[] }` |

```
Request:
  { "tool": "pilot_inspect", "args": {} }

Response:
  { "success": true,
    "console": [{ "level": "warn", "text": "Resource loaded over HTTP", "timestamp": 1710000000000 }],
    "network": [{ "url": "https://example.com/api", "status": 200, "method": "GET", "duration": 340 }],
    "errors": [] }
```

### 2.7 `pilot_evaluate`

| Field | Value |
|-------|-------|
| Description | Execute arbitrary JavaScript in the browser page context and return the result. |
| Input | `{ script: string }` |
| Output | `{ success: boolean, result: any, duration: number }` |
| Errors | Script syntax error, runtime error, browser context closed |
| Risky | Yes — arbitrary code execution |

```
Request:
  { "tool": "pilot_evaluate", "args": { "script": "document.title" } }

Response:
  { "success": true, "result": "Example Domain", "duration": 12 }
```

### 2.8 Tool Interaction Matrix

| Tool | Requires Page | Risky | Idempotent | Screenshot Auto-Capture |
|------|:---:|:---:|:---:|:---:|
| `pilot_navigate` | No | No | No | No |
| `pilot_click` | Yes | Yes | No | Yes (configurable) |
| `pilot_type` | Yes | Conditional | No | Yes (configurable) |
| `pilot_screenshot` | Yes | No | Yes | N/A |
| `pilot_extract` | Yes | No | Yes | No |
| `pilot_inspect` | Yes | No | No (clears buffer) | No |
| `pilot_evaluate` | Yes | Yes | Depends | No |

---

## 3. Plugin API Surface

### 3.1 Slash Commands

All commands are registered under the `/pilot` namespace in the OpenCode plugin system.

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/pilot` | Show status summary of active session | None |
| `/pilot start` | Launch browser session and start MCP server | `--url <url>` (optional initial URL) |
| `/pilot stop` | Close browser, save session, stop MCP server | `--force` (skip unsaved action prompt) |
| `/pilot status` | Display session ID, uptime, action count, current URL | None |
| `/pilot approve` | Manually approve pending risky action | `<actionId>` or `--all` |
| `/pilot reject` | Manually reject pending risky action | `<actionId>` or `--all` |
| `/pilot history` | Show recent actions in current session | `--limit 10` |

### 3.2 Console Output Formatting

The plugin intercepts MCP tool responses and formats them for the terminal.

**Task progress format:**
```
[pilot] Session: abc123 | Actions: 12 | URL: https://example.com
[pilot] Navigating to https://example.com...
[pilot]   -> 200 OK | title: Example Domain
[pilot] Clicking #submit-btn...
[pilot]   -> Success | <button>Submit</button>
[pilot] 3 actions completed | 0 errors | duration: 12.4s
```

**Approval prompt format:**
```
[pilot] Approval required: pilot_click
[pilot]   Session: abc123
[pilot]   Action:  click #delete-account-btn
[pilot]   Page:    https://example.com/settings
[pilot]
[pilot]   Approve? (y/N) [--auto-timeout: 120s]
```

**Error format:**
```
[pilot] ERROR: pilot_navigate failed
[pilot]   url: https://example.com
[pilot]   error: Navigation timeout of 30000ms exceeded
[pilot]   suggestion: Check URL is reachable, or increase timeout in config
```

### 3.3 Approval Hooks

The trust layer intercepts tool execution before it reaches Playwright.

**Architecture:**
```
LLM calls tool
  -> Plugin receives tool call
  -> Check if tool is in "risky" list
  -> If risky:
       -> Log action to pending file
       -> Print approval prompt to console
       -> Wait for user input (stdin via OpenCode)
       -> If approved: forward to MCP server
       -> If rejected: return error response to LLM
  -> If safe: forward directly to MCP server
```

**Configurable risk list** (in opencode.json plugin config):

```jsonc
{
  "pilot": {
    "approvalRequired": ["pilot_click", "pilot_type", "pilot_evaluate"],
    "autoApproveDomains": ["localhost", "127.0.0.1"],
    "approvalTimeout": 120000,
    "screenshotOnRisky": true
  }
}
```

The approval is blocking — the LLM agent's tool call hangs until the user responds or the timeout fires.

---

## 4. Data Model

### 4.1 Session

```typescript
interface Session {
  id: string;                    // uuid v4
  created: number;               // unix ms
  updated: number;               // unix ms
  status: "active" | "closed" | "crashed";
  browserState: {
    url: string | null;
    title: string | null;
    viewport: { width: number; height: number };
    cookies: number;             // count of stored cookies
  };
  metadata: {
    taskId?: string;             // link to Task if started from a task
    agentId?: string;            // which OpenCode agent owns the session
    command: string;             // the /pilot command that created it
  };
  actionCount: number;
  errorCount: number;
  duration: number;              // ms between first and last action
}
```

### 4.2 Action

```typescript
interface Action {
  id: string;                    // uuid v4
  sessionId: string;             // FK to Session
  tool: string;                  // e.g. "pilot_navigate"
  params: Record<string, any>;   // tool input parameters
  result: Record<string, any>;   // tool output result
  status: "pending" | "approved" | "rejected" | "completed" | "error";
  timestamp: number;             // unix ms
  duration: number;              // ms
  screenshot?: string;           // path to screenshot file if captured
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
}
```

### 4.3 Approval

```typescript
interface Approval {
  id: string;                    // uuid v4
  actionId: string;              // FK to Action
  status: "pending" | "approved" | "rejected" | "expired";
  reason?: string;               // user-provided reason for rejection
  timestamp: number;             // unix ms
  respondedAt?: number;          // unix ms
  autoApproved: boolean;         // true if bypassed by domain whitelist
}
```

### 4.4 Task

```typescript
interface Task {
  id: string;                    // uuid v4
  goal: string;                  // natural language goal
  plan: string[];                // ordered list of steps
  status: "planned" | "in_progress" | "completed" | "failed" | "cancelled";
  actions: string[];             // ordered list of Action IDs
  summary?: string;              // LLM-generated summary on completion
  created: number;               // unix ms
  completed?: number;            // unix ms
  metadata: {
    sessionId: string;
    agentId?: string;
    tokenEstimate: number;       // estimated total tokens consumed
  };
}
```

### 4.5 Entity Relationship

```
Task 1 --- * Session 1 --- * Action 1 --- 0..1 Approval
       owns          owns          may have
```

---

## 5. Store Schema (File-Based)

### 5.1 Directory Layout

```
~/.opencode-pilot/
  |- sessions/
  |    |- abc123.json              # Session record
  |    |- def456.json
  |- actions/
  |    |- act-001.json             # Action record
  |    |- act-002.json
  |- screenshots/
  |    |- abc123-1710000000.png    # Screenshot file
  |    |- abc123-1710000012.png
  |- tasks/
  |    |- task-001.json            # Task record
  |- indexes/
  |    |- sessions.json            # Ordered list of session IDs (newest first)
  |    |- pending-approvals.json   # List of outstanding approval action IDs
  |- config.json                   # Runtime config (overrides plugin defaults)
```

### 5.2 File Formats

**Session file** (`~/.opencode-pilot/sessions/<id>.json`):
```json
{
  "id": "abc123",
  "created": 1710000000000,
  "updated": 1710000120000,
  "status": "active",
  "browserState": {
    "url": "https://example.com",
    "title": "Example Domain",
    "viewport": { "width": 1280, "height": 720 },
    "cookies": 3
  },
  "metadata": {
    "command": "/pilot start --url https://example.com"
  },
  "actionCount": 12,
  "errorCount": 0,
  "duration": 120000
}
```

**Action file** (`~/.opencode-pilot/actions/<id>.json`):
```json
{
  "id": "act-001",
  "sessionId": "abc123",
  "tool": "pilot_navigate",
  "params": { "url": "https://example.com" },
  "result": { "success": true, "url": "https://example.com", "title": "Example Domain", "status": 200 },
  "status": "completed",
  "timestamp": 1710000000000,
  "duration": 3400,
  "screenshot": null,
  "error": null
}
```

**Approval that was required for an action** — stored inline in action file as an optional `approval` field, and also mirrored in the pending-approvals index:
```json
{
  "id": "act-002",
  "sessionId": "abc123",
  "tool": "pilot_click",
  "params": { "selector": "#delete-btn" },
  "result": {},
  "status": "pending",
  "timestamp": 1710000050000,
  "duration": 0,
  "approval": {
    "id": "apr-001",
    "status": "pending",
    "timestamp": 1710000050000
  }
}
```

**Task file** (`~/.opencode-pilot/tasks/<id>.json`):
```json
{
  "id": "task-001",
  "goal": "Log in to the admin panel and verify the user list renders",
  "plan": [
    "Navigate to https://admin.example.com/login",
    "Type email into #email",
    "Type password into #password",
    "Click #login-btn",
    "Wait for dashboard to load",
    "Navigate to /users",
    "Extract table rows",
    "Take screenshot"
  ],
  "status": "in_progress",
  "actions": ["act-001", "act-002", "act-003"],
  "summary": null,
  "created": 1710000000000,
  "completed": null,
  "metadata": {
    "sessionId": "abc123",
    "agentId": "default",
    "tokenEstimate": 4500
  }
}
```

**Index files** — small JSON arrays for fast lookups without scanning the entire store:

`sessions.json`:
```json
["abc123", "def456"]
```

`pending-approvals.json`:
```json
["act-002"]
```

### 5.3 Read/Write Strategy

| Operation | Strategy |
|-----------|----------|
| Write session | Atomic write to `sessions/<id>.json`, update index |
| Write action | Atomic write to `actions/<id>.json`, update parent session's `actionCount` |
| Write screenshot | Write PNG to `screenshots/<id>-<ts>.png` |
| Read session by ID | Direct file read from `sessions/<id>.json` |
| List sessions | Read `indexes/sessions.json`, order by array position |
| List actions for session | Glob `actions/*.json` filtered by `sessionId` field |
| Pending approvals | Read `indexes/pending-approvals.json`, resolve each action file |
| Cleanup old sessions | Read index, check `updated` timestamp, archive/delete files |

**Atomic write pattern:**
```
1. Write to <path>.tmp
2. fsync
3. Rename <path>.tmp -> <path>
```

### 5.4 Storage Budget (Estimated)

| Artifact | Size per Unit | 1000 Actions / 50 Sessions |
|----------|--------------|---------------------------|
| Session record | ~600 bytes | ~30 KB |
| Action record | ~1 KB | ~1 MB |
| Screenshot (PNG, 1280x720) | ~200 KB avg | ~20 MB (assumes 100 captures) |
| Task record | ~1 KB | ~5 KB (assumes 5 tasks) |
| Index files | ~1 KB total | ~1 KB |
| **Total** | | **~21 MB** |

Well within filesystem constraints for an MVP. No external database needed.

---

## 6. Risk Table

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Browser flakiness** — Playwright timeouts, network failures, element not found | High — broken session, wasted tokens, user frustration | Medium | Retry logic (2x with exponential backoff), configurable timeouts, Playwright auto-waiting, explicit `waitForSelector` before interactions, per-action error classification |
| **Security / credential exposure** — LLM types credentials into a page, or `pilot_evaluate` exfiltrates data | High — credential leak, privacy violation | Medium | Approval gates for `pilot_type` and `pilot_evaluate`, local-only storage (no cloud sync in MVP), credential pattern detection in `text` params, user confirmation before navigation to unknown domains, all data stays on filesystem |
| **Token / context cost** — Full page text in `pilot_extract`, long console logs, repeated screenshots | Medium — slow responses, cost bloat | High | Truncate extracted text to 10k chars by default (configurable), deduplicate consecutive screenshot calls, limit `pilot_inspect` log buffer to 50 entries, provide LLM with structural hints (e.g., "use specific selectors over full page extract") |
| **UX polish** — Approval prompts are annoying, commands are non-obvious, error messages are cryptic | Medium — user adoption risk, friction | Low | Iterative design with Lavish prototyping, default to permissive mode (no approvals) in initial releases, add `/pilot help` with examples, collect feedback via GitHub issues |
| **MCP server crash** — Node process dies, browser orphaned | High — lost session state | Low | Signal handling (SIGTERM, SIGINT) to gracefully close browser, session auto-save every 10 actions, heartbeat healthcheck in plugin |
| **State inconsistency** — File write interrupted, index out of sync with data files | Medium — lost actions, wrong state | Low | Atomic writes via tmp+rename, validation on startup (reconcile indexes against actual files), single-writer pattern (MCP server is sole writer) |
| **Playwright version drift** — System Chromium vs bundled Chromium mismatch | Medium — browser launch failure | Low | Use `@playwright/browser-chromium` (bundled), pin Playwright version in `package.json`, CI test with locked version, document manual install fallback |

---

## 7. Open Questions

These decisions are deferred to implementation phase, pending user research and technical spikes.

### 7.1 Remote Browser Connections

**Question:** Should the MCP server support remote browser connections (e.g., Browserless.io, Playwright Cloud, or self-hosted browser farms)?

**Context:**
- Enables running the browser on a remote server while the plugin runs locally
- Useful for CI/CD pipelines, headless environments, or teams sharing a browser instance
- Adds complexity: authentication, TLS, browser version matching, latency

**Options:**
| Option | Pros | Cons |
|--------|------|------|
| Local-only (MVP) | Simple, secure, no network dependency | Cannot run in CI or remote dev environments |
| Remote via `PLAYWRIGHT_WS_ENDPOINT` env var | Flexible, Playwright-native, zero config code change | User must provision their own browser instance |
| Built-in Browserless support | Turnkey for popular service | Dependency on third-party service, vendor lock-in |

**Proposal (MVP):** Local-only. Add `PLAYWRIGHT_WS_ENDPOINT` env var support as a fast-follow without code changes (Playwright natively supports this).

### 7.2 Time-Based Approval Expiration

**Question:** Should the approval gate support time-based expiration (auto-reject after N seconds)?

**Context:**
- Prevents pending approvals from blocking the agent indefinitely
- User may walk away from terminal
- Agent may have its own timeout context window to manage

**Options:**
| Option | Pros | Cons |
|--------|------|------|
| No expiration (MVP) | Simplest implementation, user has full control | Agent can hang forever if user is AFK |
| Hard timeout (configurable) | Prevents indefinite blocks, matches LLM context limits | User may miss the window; agent proceeds without approval |
| Hard timeout + auto-deny | Safe default (deny if no response) | May interrupt workflow if user is briefly distracted (mitigated by generous default: 120s) |
| Soft timeout + escalate | Wait N seconds, then re-prompt once, then deny | More complex implementation |

**Proposal (MVP):** Hard timeout of 120s with auto-deny. Configurable in `opencode.json`. This prevents infinite hangs while being generous enough for typical terminal use.

### 7.3 Evidence Store Cloud Sync

**Question:** Should the evidence store support cloud sync (S3, GCS, etc.) or stay local-only?

**Context:**
- Useful for sharing sessions across team members, CI review, or audit trails
- Adds security surface area (credential management for cloud providers)
- Screenshots may contain sensitive data

**Options:**
| Option | Pros | Cons |
|--------|------|------|
| Local-only (MVP) | Simple, secure, no credentials | No sharing, no backup, machine-local |
| Cloud sync opt-in | User-controlled, encrypted at rest | Operational complexity, credential management, compliance risk |
| Cloud sync + encryption | Secure sharing, team collaboration | Significant implementation effort, key management |

**Proposal (MVP):** Local-only. If cloud sync is needed, implement as a separate export command (`/pilot export --s3-bucket ...`) that reads local store and uploads; do not build background sync. Revisit post-MVP based on user demand.

### 7.4 Additional Open Questions

| Question | Decision Target | Notes |
|----------|----------------|-------|
| Should the browser session persist across `/pilot stop` / `/pilot start`? | MVP | Stateless per session for simplicity; session restore via cookies JSON on start |
| Should multiple OpenCode agents share one browser session? | Post-MVP | Requires session locking, action ordering, and more complex state model |
| Should `pilot_extract` support structured output (JSON from page data)? | MVP | Format with `type` param: `"text"`, `"html"`, `"json"` (evaluate JSON.parse of <script> data) |
| Should screenshots embed metadata (session ID, tool, timestamp) in EXIF/png-chunk? | Low priority | Useful for audit, but not critical for MVP |
| What Node.js version is the minimum? | Now | >= 18 (Playwright requirement) |

---

## 8. Implementation Milestones

### Milestone 1: MCP Server Core (Week 1)
- [ ] Playwright browser launch and context management
- [ ] Implement all 7 MCP tools with basic error handling
- [ ] MCP protocol (stdio transport): `tools/list`, `tools/call`
- [ ] Config loading (env vars, command-line args)
- [ ] File-based store: write session, action, screenshot; maintain index
- [ ] Test: manual E2E via MCP inspector tool

### Milestone 2: Plugin Integration (Week 2)
- [ ] Register `/pilot` slash commands in OpenCode plugin
- [ ] Wire MCP server as `mcpServers` entry in `opencode.json`
- [ ] Console output formatting pipeline
- [ ] Approval gate: intercept risky tools, prompt user, forward/reject
- [ ] Session lifecycle: start, stop, status, history
- [ ] Test: end-to-end flow from `/pilot start` through navigate + click + screenshot + stop

### Milestone 3: Task Orchestration (Week 3)
- [ ] Task CRUD: create, append action, update status, generate summary
- [ ] `/pilot task` subcommands: `new <goal>`, `list`, `show <id>`
- [ ] Plan generation from goal (LLM-based, via OpenCode agent)
- [ ] Auto-save every N actions
- [ ] Graceful shutdown and browser cleanup
- [ ] Test: full task with 10+ actions, verify store files

### Milestone 4: Polish & Hardening (Week 4)
- [ ] Retry logic with exponential backoff for flaky tools
- [ ] Credential pattern detection (`password`, `secret`, `token` in `pilot_type`)
- [ ] Configurable approval rules (domain whitelist, tool allowlist)
- [ ] Error classification and actionable error messages
- [ ] Comprehensive README with examples, troubleshooting, config reference
- [ ] Performance benchmarks: tool latency, memory usage, store read/write speed

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol — JSON-RPC based protocol for tool integration with LLMs |
| **Plugin** | OpenCode extension that registers commands, formatters, and interceptors |
| **Session** | A single browser lifecycle from launch to close |
| **Action** | A single browser tool invocation (navigate, click, type, etc.) |
| **Approval Gate** | A security checkpoint that requires user confirmation before executing a risky action |
| **Evidence Store** | The file system directory where sessions, actions, screenshots, and tasks are persisted |

## Appendix B: File Paths Reference

| Artifact | Default Path |
|----------|-------------|
| Store root | `~/.opencode-pilot/` |
| Config | `~/.opencode-pilot/config.json` |
| Session files | `~/.opencode-pilot/sessions/<id>.json` |
| Action files | `~/.opencode-pilot/actions/<id>.json` |
| Screenshots | `~/.opencode-pilot/screenshots/<sessionId>-<timestamp>.png` |
| Task files | `~/.opencode-pilot/tasks/<id>.json` |
| Session index | `~/.opencode-pilot/indexes/sessions.json` |
| Pending approvals index | `~/.opencode-pilot/indexes/pending-approvals.json` |
| MCP server log | `~/.opencode-pilot/pilot-server.log` |
