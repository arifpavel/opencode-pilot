# OpenCode Pilot

**The coding agent that can run the workflow too.**

OpenCode Pilot is an OpenCode-native browser execution layer for coding agents. Reproduce bugs, inspect dashboards, validate flows, and complete real workflows instead of stopping at code generation.

## Quick Start

### Prerequisites

- [OpenCode](https://opencode.ai) installed
- Node.js 18+
- Playwright Chromium (`npx playwright install chromium`)

### Install

```bash
# Clone the repo
git clone https://github.com/arifpavel/opencode-pilot.git
cd opencode-pilot

# Install dependencies
cd packages/mcp-server && npm install && cd ../..
cd packages/opencode-plugin && npm install && cd ../..

# Build the MCP server
cd packages/mcp-server && npm run build && cd ../..

# Install Playwright browser
npx playwright install chromium
```

### Configure OpenCode

Add to your `opencode.json` (global: `~/.config/opencode/opencode.json` or local `./opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./packages/opencode-plugin/src/index.ts"],
  "mcp": {
    "opencode-pilot": {
      "type": "local",
      "command": ["node", "./packages/mcp-server/dist/index.js"],
      "enabled": true
    }
  }
}
```

> Adjust paths relative to your `opencode-pilot` checkout location, or use absolute paths.

### Verify

Run OpenCode and try:

```
/pilot navigate to https://example.com and take a screenshot
```

If the browser opens and a screenshot is captured, Pilot is working.

## Usage

### Basic Commands

| Command | Description |
|---------|-------------|
| `/pilot <goal>` | Execute a browser task with planning and verification |
| `/pilot start` | Start (or ensure) the browser session |
| `/pilot stop` | Close the browser session |
| `/pilot status` | Show current session and task state |

### Example Workflows

**Bug reproduction:**
```
/pilot open staging, log in, navigate to billing, reproduce the invoice bug, inspect console errors, capture screenshots, and summarize the failure
```

**Frontend validation:**
```
/pilot navigate to the app, fill the contact form, submit it, and verify the success message appears
```

**Regression check:**
```
/pilot open the app, run through the checkout flow end-to-end, capture screenshots at each step, and report any errors
```

**The Pilot Loop (code → test → fix):**
```
/pilot open the app, test the new feature, capture any console errors and screenshots
```

After reviewing the results, fix the code and re-run:
```
/pilot re-run the same flow and verify —verify
```

### MCP Tools

The MCP server exposes these tools (usable directly by the agent without `/pilot`):

| Tool | Description |
|------|-------------|
| `pilot_navigate` | Navigate to a URL |
| `pilot_click` | Click an element by CSS or text |
| `pilot_type` | Type text into a field |
| `pilot_screenshot` | Capture a screenshot |
| `pilot_extract` | Extract text from the page |
| `pilot_inspect` | Get console errors and network info |
| `pilot_evaluate` | Run JavaScript in the page |

### Approval Gates

High-risk actions require explicit approval:
- Form submissions (`submit`, `save`, `update`)
- Data deletion (`delete`, `remove`, `destroy`)
- Production changes (`production`, `prod`)
- Credential use (login with credentials)

The agent will pause and ask for your confirmation before proceeding.

### Session Continuity

The browser session persists across tasks. Cookies, login state, and localStorage are saved to `~/.opencode-pilot/sessions/`. You can log in once and reuse the session across multiple `/pilot` runs.

## Architecture

```
OpenCode CLI → Pilot Plugin → MCP Server (Playwright) → Browser Session
                                    ↓
                          State & Evidence Store
                              ~/.opencode-pilot/
```

## Project Structure

```
opencode-pilot/
├── packages/
│   ├── mcp-server/          # Playwright-based browser control MCP server
│   │   ├── src/
│   │   │   ├── index.ts     # MCP server entry, tool registration
│   │   │   ├── browser.ts   # Playwright session manager
│   │   │   └── store.ts     # File-based evidence store
│   │   └── dist/            # Compiled output
│   └── opencode-plugin/     # Pilot Console plugin for OpenCode
│       └── src/
│           ├── index.ts     # Plugin entry, hooks, /pilot command
│           ├── task-engine.ts  # Goal decomposition and execution
│           └── approvals.ts    # Approval gate system
├── docs/
│   ├── technical-prd.md     # Full technical specification
│   └── founder-onepager.md  # Product and business brief
├── COMPARISON.md            # Comparison with existing browser plugins
└── README.md
```

## Comparison

See [COMPARISON.md](./COMPARISON.md) for a detailed breakdown against existing OpenCode browser plugins.

## Development

```bash
# Watch mode for MCP server
cd packages/mcp-server && npm run dev

# Typecheck both packages
cd packages/mcp-server && npx tsc --noEmit
cd packages/opencode-plugin && npx tsc --noEmit
```

## License

MIT
