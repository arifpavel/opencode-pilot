export interface Step {
  id: string;
  action: string;
  description: string;
  tool: string;
  toolArgs: Record<string, string>;
  requiresApproval: boolean;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: string;
}

export interface Task {
  id: string;
  goal: string;
  steps: Step[];
  completed: number;
  failed: number;
  startTime: number;
  endTime?: number;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output: string;
}

let taskCounter = 0;

function decomposeGoal(goal: string): Step[] {
  const lower = goal.toLowerCase();
  const steps: Step[] = [];

  steps.push({
    id: `step_${++taskCounter}`,
    action: "navigate",
    description: "Navigate to the target page",
    tool: "pilot_navigate",
    toolArgs: { url: "" },
    requiresApproval: false,
    status: "pending",
  });

  if (
    lower.includes("login") ||
    lower.includes("sign in") ||
    lower.includes("log in")
  ) {
    steps.push({
      id: `step_${++taskCounter}`,
      action: "type",
      description: "Enter username or email",
      tool: "pilot_type",
      toolArgs: { selector: "", text: "" },
      requiresApproval: false,
      status: "pending",
    });
    steps.push({
      id: `step_${++taskCounter}`,
      action: "type",
      description: "Enter password",
      tool: "pilot_type",
      toolArgs: { selector: "", text: "" },
      requiresApproval: true,
      status: "pending",
    });
    steps.push({
      id: `step_${++taskCounter}`,
      action: "click",
      description: "Click submit/login button",
      tool: "pilot_click",
      toolArgs: { selector: "" },
      requiresApproval: true,
      status: "pending",
    });
  }

  if (
    lower.includes("click") ||
    lower.includes("press") ||
    lower.includes("select")
  ) {
    steps.push({
      id: `step_${++taskCounter}`,
      action: "click",
      description: "Click target element",
      tool: "pilot_click",
      toolArgs: { selector: "" },
      requiresApproval: false,
      status: "pending",
    });
  }

  if (
    lower.includes("type") ||
    lower.includes("fill") ||
    lower.includes("enter") ||
    lower.includes("input")
  ) {
    steps.push({
      id: `step_${++taskCounter}`,
      action: "type",
      description: "Type text into input field",
      tool: "pilot_type",
      toolArgs: { selector: "", text: "" },
      requiresApproval: false,
      status: "pending",
    });
  }

  if (
    lower.includes("screenshot") ||
    lower.includes("capture") ||
    lower.includes("verify visually")
  ) {
    steps.push({
      id: `step_${++taskCounter}`,
      action: "screenshot",
      description: "Capture screenshot for verification",
      tool: "pilot_screenshot",
      toolArgs: { name: "" },
      requiresApproval: false,
      status: "pending",
    });
  }

  if (
    lower.includes("extract") ||
    lower.includes("read") ||
    lower.includes("get text") ||
    lower.includes("content")
  ) {
    steps.push({
      id: `step_${++taskCounter}`,
      action: "extract",
      description: "Extract text content from page",
      tool: "pilot_extract",
      toolArgs: { selector: "" },
      requiresApproval: false,
      status: "pending",
    });
  }

  steps.push({
    id: `step_${++taskCounter}`,
    action: "inspect",
    description: "Inspect console errors and network logs",
    tool: "pilot_inspect",
    toolArgs: {},
    requiresApproval: false,
    status: "pending",
  });

  return steps;
}

export function createTask(goal: string): Task {
  const steps = decomposeGoal(goal);

  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    goal,
    steps,
    completed: 0,
    failed: 0,
    startTime: Date.now(),
  };
}

export function getCurrentStep(task: Task): Step | undefined {
  return task.steps.find((s) => s.status === "pending");
}

export function markStepInProgress(task: Task, stepId: string): void {
  const step = task.steps.find((s) => s.id === stepId);
  if (step && step.status === "pending") {
    step.status = "in_progress";
  }
}

export function markStepComplete(
  task: Task,
  stepId: string,
  result?: string,
): void {
  const step = task.steps.find((s) => s.id === stepId);
  if (step) {
    step.status = "completed";
    step.result = result;
    task.completed++;
  }

  if (task.completed + task.failed >= task.steps.length) {
    task.endTime = Date.now();
  }
}

export function markStepFailed(
  task: Task,
  stepId: string,
  error?: string,
): void {
  const step = task.steps.find((s) => s.id === stepId);
  if (step) {
    step.status = "failed";
    step.result = error;
    task.failed++;
  }

  if (task.completed + task.failed >= task.steps.length) {
    task.endTime = Date.now();
  }
}

export function getSummary(task: Task): string {
  const elapsed = task.endTime
    ? `${((task.endTime - task.startTime) / 1000).toFixed(1)}s`
    : "in progress";

  const lines: string[] = [
    "=== Pilot Task Summary ===",
    `Goal: ${task.goal}`,
    `Duration: ${elapsed}`,
    `Steps: ${task.completed + task.failed} total, ${task.completed} completed, ${task.failed} failed`,
    "",
    "Steps:",
  ];

  for (const step of task.steps) {
    const icon =
      step.status === "completed"
        ? "[OK]"
        : step.status === "failed"
          ? "[FAIL]"
          : step.status === "in_progress"
            ? "[...]"
            : "[   ]";
    lines.push(`  ${icon} ${step.description}`);
    if (step.result) {
      lines.push(`       ${step.result.slice(0, 200)}`);
    }
  }

  lines.push("========================");
  return lines.join("\n");
}
