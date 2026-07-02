import type { Plugin, PluginContext } from "@opencode-ai/plugin";
import {
  createTask,
  getCurrentStep,
  markStepInProgress,
  markStepComplete,
  markStepFailed,
} from "./task-engine.js";
import type { Task } from "./task-engine.js";
import {
  requiresApproval,
  requestApproval,
  getPendingApprovals,
} from "./approvals.js";

interface SystemTransformInput {
  system: string;
}
interface SystemTransformOutput {
  system: string;
}
interface ToolDefinitionEntry {
  name: string;
  description: string;
}
interface ToolDefinitionInput {
  tools: ToolDefinitionEntry[];
}
interface ToolDefinitionOutput {
  tools: ToolDefinitionEntry[];
}
interface ToolExecuteAfterInput {
  tool: string;
  args: Record<string, unknown>;
}
interface ToolExecuteAfterOutput {
  result?: Record<string, unknown>;
}
interface SessionCompactingOutput {
  context: string[];
}

interface PilotHooks {
  "experimental.chat.system.transform": (
    input: SystemTransformInput,
    output: SystemTransformOutput
  ) => void;
  "tool.definition": (
    input: ToolDefinitionInput,
    output: ToolDefinitionOutput
  ) => void;
  "tool.execute.after": (
    input: ToolExecuteAfterInput,
    output: ToolExecuteAfterOutput
  ) => void | Promise<void>;
  "experimental.session.compacting": (
    _input: unknown,
    output: SessionCompactingOutput
  ) => void;
  tool: Record<string, unknown>;
}

function createPlugin(hooks: PilotHooks): Plugin {
  return async (_ctx: PluginContext) => hooks as unknown as Record<string, unknown>;
}

let currentTask: Task | null = null;
let screenshotCount = 0;
let errorsFound: string[] = [];
let actionCount = 0;

export default createPlugin({
  "experimental.chat.system.transform": (input, output) => {
    const guidance = [
      "",
      "## Pilot Browser Automation",
      "- When testing or verifying code changes, use the /pilot command to run the workflow in a real browser.",
      "- Pilot can navigate, click, type, take screenshots, and inspect console errors.",
      "- High-risk actions (form submission, data deletion, credential use) require user approval.",
    ].join("\n");

    output.system = input.system + guidance;
  },

  "tool.definition": (input, output) => {
    for (const toolDef of output.tools) {
      switch (toolDef.name) {
        case "pilot_screenshot":
          toolDef.description +=
            " Slow operation -- use sparingly, only when visual verification is needed";
          break;
        case "pilot_extract":
          toolDef.description +=
            " Fast operation -- preferred over screenshot for text content";
          break;
        case "pilot_navigate":
          toolDef.description +=
            " Fast operation -- use direct URL navigation instead of clicking through multiple pages";
          break;
      }
    }
  },

  "tool.execute.after": async (input, output) => {
    actionCount++;

    switch (input.tool) {
      case "pilot_screenshot": {
        const path = output.result?.path;
        if (typeof path === "string") {
          screenshotCount++;
        }
        break;
      }

      case "pilot_inspect": {
        const errors = output.result?.consoleErrors;
        if (Array.isArray(errors) && errors.length > 0) {
          errorsFound.push(...errors);
        }
        break;
      }

      case "pilot_navigate":
      case "pilot_click":
      case "pilot_type":
      case "pilot_evaluate":
      case "pilot_extract": {
        if (!currentTask) break;

        const step = getCurrentStep(currentTask);
        if (!step) break;

        markStepInProgress(currentTask, step.id);

        const success = output.result?.success !== false;
        if (success) {
          markStepComplete(currentTask, step.id);
        } else {
          markStepFailed(currentTask, step.id);
        }
        break;
      }
    }
  },

  "experimental.session.compacting": (_input, output) => {
    const lines: string[] = [];
    lines.push("## Pilot Plugin State");

    if (currentTask) {
      const t = currentTask;
      const remaining = t.steps.length - t.completed - t.failed;
      lines.push(`- Current task: ${t.goal}`);
      lines.push(`- Steps completed: ${t.completed}`);
      lines.push(`- Steps remaining: ${remaining}`);
      lines.push(`- Steps failed: ${t.failed}`);

      const pending = getCurrentStep(t);
      if (pending) {
        lines.push(
          `- Current step: ${pending.description} (${pending.tool})`
        );
      }
    }

    lines.push(`- Screenshots taken: ${screenshotCount}`);
    lines.push(`- Total actions: ${actionCount}`);

    if (errorsFound.length > 0) {
      lines.push(`- Console errors found: ${errorsFound.length}`);
    }

    const pendingApprovals = getPendingApprovals();
    if (pendingApprovals.length > 0) {
      lines.push(`- Pending approvals: ${pendingApprovals.length}`);
      for (const a of pendingApprovals) {
        lines.push(`  - ${a.action}: ${a.details}`);
      }
    }

    output.context.push(lines.join("\n"));
  },

  tool: {
    pilot: {
      description:
        "Execute a multi-step browser workflow. Parses a goal and creates a task plan with sequential steps.",
      args: {
        goal: "string",
      },
      execute: (
        args: Record<string, unknown>,
        _context: { directory: string; worktree: string }
      ): string => {
        const goal =
          typeof args.goal === "string" ? args.goal.trim() : "";

        if (!goal) {
          return [
            "Usage: /pilot <goal description>",
            "",
            "Examples:",
            "  /pilot navigate to the invoice page and take a screenshot",
            "  /pilot log in to staging and verify the dashboard loads",
            "  /pilot reproduce the payment error on the checkout page",
          ].join("\n");
        }

        screenshotCount = 0;
        errorsFound = [];
        actionCount = 0;

        const task = createTask(goal);
        currentTask = task;

        const planLines: string[] = [
          "=== Pilot Task Plan ===",
          `Goal: ${task.goal}`,
          `Steps: ${task.steps.length}`,
          "",
          "Execution plan:",
        ];

        for (let i = 0; i < task.steps.length; i++) {
          const step = task.steps[i];
          const warning = step.requiresApproval
            ? " [APPROVAL REQUIRED]"
            : "";
          planLines.push(
            `  ${i + 1}. ${step.description} (${step.tool})${warning}`
          );
        }

        planLines.push(
          "",
          "The AI will execute each step in sequence. Progress will be reported after each step."
        );

        return planLines.join("\n");
      },
    },
  },
});
