import type { Plugin } from "@opencode-ai/plugin";
import {
  getPendingApprovals,
  requestApproval,
  requiresApproval,
} from "./approvals.js";
import {
  createTask,
  getCurrentStep,
  markStepComplete,
  markStepFailed,
  markStepInProgress,
} from "./task-engine.js";
import type { Task } from "./task-engine.js";

let currentTask: Task | null = null;
let screenshotCount = 0;
let errorsFound: string[] = [];
let actionCount = 0;

export const PilotPlugin: Plugin = async (_ctx) => {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      const guidance = [
        "",
        "## Pilot Browser Automation",
        "- When testing or verifying code changes, use the /pilot command to run the workflow in a real browser.",
        "- Pilot can navigate, click, type, take screenshots, and inspect console errors.",
        "- High-risk actions (form submission, data deletion, credential use) require user approval.",
      ].join("\n");

      (output as unknown as { system: string[] }).system.push(guidance);
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

    tool: {
      pilot: {
        description:
          "Execute a multi-step browser workflow. Parses a goal and creates a task plan with sequential steps.",
        args: {
          goal: {
            type: "string",
            description:
              "The goal or task description for the browser workflow",
          },
        },
        execute: (
          args: Record<string, unknown>,
          _context: { directory: string; worktree: string },
        ): string => {
          const goal = typeof args.goal === "string" ? args.goal.trim() : "";

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
            const warning = step.requiresApproval ? " [APPROVAL REQUIRED]" : "";
            planLines.push(
              `  ${i + 1}. ${step.description} (${step.tool})${warning}`,
            );
          }

          planLines.push(
            "",
            "The AI will execute each step in sequence. Progress will be reported after each step.",
          );

          return planLines.join("\n");
        },
      },
    },

    "experimental.session.compacting": async (_input, output) => {
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
            `- Current step: ${pending.description} (${pending.tool})`,
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
  };
};
