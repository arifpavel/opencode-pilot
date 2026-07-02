# OpenCode Pilot vs. Existing Browser Plugins

## Why Another Browser Plugin?

Several OpenCode browser plugins already exist. Each proves browser control is technically viable, but **none** delivers a structured task execution product. They are tool primitives. OpenCode Pilot is the product layer on top.

---

## Comparison

| Capability | different-ai/ opencode-browser | michaljach/ opencode-browser | heimoshuiyu/ opencode-browser-plugin | OpenCode PR #7302 (unmerged) | **OpenCode Pilot** |
|---|---|---|---|---|---|
| **Engine** | CDP (manual Chrome) | Browser MCP extension | Playwright (auto) | Playwright (core) | **Playwright (auto)** |
| **Browser lifecycle** | Manual | Via extension | Auto-managed | Auto-managed | **Auto-managed** |
| **Structured task mode** | ❌ | ❌ | ❌ | ❌ | **✅ Goal → Plan → Actions → Summary** |
| **Approval gates** | ❌ | ❌ | ❌ | ❌ | **✅ For risky actions** |
| **Evidence store** | ❌ | ❌ | ❌ | ❌ | **✅ Screenshots + logs + replays** |
| **Execution report** | ❌ | ❌ | ❌ | ❌ | **✅ Per-task summary** |
| **Pilot Console** | ❌ | ❌ | ❌ | ❌ | **✅ Dedicated task UI** |
| **Session continuity** | Manual tab mgmt | Via extension | Basic profile | Basic | **✅ Cookies + state across tasks** |
| **Replay capability** | ❌ | ❌ | ❌ | ❌ | **✅ Action traces for replay** |
| **OpenCode integration** | Plugin | Plugin + MCP | Plugin | Built-in (unmerged) | **Plugin + MCP** |

---

## Product Gap

All existing solutions give the agent browser tools but **no structure** around how to use them safely and observably. The agent can click and type, but there's no:

- Task plan vs. ad-hoc actions
- Approval before destructive operations
- Persistent evidence you can review later
- Replayable execution trace
- Dedicated console UX for status and approvals

**OpenCode Pilot fills that gap** — it's the difference between giving someone a hammer (tool primitive) and giving them a workshop with safety gear, blueprints, and a review process (product).

## What We Learn From Each Project

### different-ai/opencode-browser (482 ⭐)
- CDP approach works well but requires manual Chrome launch
- Proves multi-tab and snapshot-based element targeting is viable
- **Take for Pilot:** Snapshot-based interaction model

### michaljach/opencode-browser (62 ⭐)
- Speed guidance injection is clever for reducing latency
- Context preservation across session compaction is important
- **Take for Pilot:** Performance hints + session context preservation

### heimoshuiyu/opencode-browser-plugin (0 ⭐)
- Playwright auto-management removes manual browser launch pain
- Ref-based element targeting (e1, e2) is cleaner than raw selectors
- **Take for Pilot:** Auto-managed browser lifecycle + ref-based targeting

### OpenCode PR #7302 (unmerged)
- 30+ browser tools show the full scope of what's possible
- Built-in means zero config — plugin approach should match ease of use
- **Take for Pilot:** Comprehensive tool surface as reference for MVP scope
