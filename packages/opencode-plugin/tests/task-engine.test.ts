import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTask,
  getCurrentStep,
  getSummary,
  markStepComplete,
  markStepFailed,
  markStepInProgress,
} from "../src/task-engine.js";

describe("task-engine", () => {
  it("creates a task with decomposed steps", () => {
    const task = createTask("navigate to example.com and take a screenshot");
    assert.ok(task.id.startsWith("task_"));
    assert.equal(task.goal, "navigate to example.com and take a screenshot");
    assert.ok(task.steps.length >= 3);
    assert.equal(task.completed, 0);
    assert.equal(task.failed, 0);
  });

  it("includes navigate step for any goal", () => {
    const task = createTask("check the page");
    const firstStep = task.steps[0];
    assert.equal(firstStep.tool, "pilot_navigate");
    assert.equal(firstStep.status, "pending");
  });

  it("detects screenshot intent in goal", () => {
    const task = createTask("take a screenshot of the dashboard");
    const hasScreenshot = task.steps.some((s) => s.action === "screenshot");
    assert.equal(hasScreenshot, true);
  });

  it("detects extract intent in goal", () => {
    const task = createTask("extract the main content from the page");
    const hasExtract = task.steps.some((s) => s.action === "extract");
    assert.equal(hasExtract, true);
  });

  it("detects login keywords and adds login steps", () => {
    const task = createTask("log in to the admin panel");
    const typeSteps = task.steps.filter((s) => s.action === "type");
    assert.ok(typeSteps.length >= 2);
    const clickSteps = task.steps.filter((s) => s.action === "click");
    assert.ok(clickSteps.length >= 1);
  });

  it("marks approval-required on credential steps", () => {
    const task = createTask("log in to the admin panel");
    const passwordStep = task.steps.find(
      (s) => s.description === "Enter password",
    );
    assert.ok(passwordStep?.requiresApproval === true);
  });

  it("always includes inspect step", () => {
    const task = createTask("do anything");
    const hasInspect = task.steps.some((s) => s.action === "inspect");
    assert.equal(hasInspect, true);
  });

  it("getCurrentStep returns first pending step", () => {
    const task = createTask("test step progression");
    const step = getCurrentStep(task);
    assert.equal(step?.status, "pending");
  });

  it("getCurrentStep returns undefined when all steps completed", () => {
    const task = createTask("test full completion");
    for (const s of task.steps) {
      s.status = "completed";
      task.completed++;
    }
    const step = getCurrentStep(task);
    assert.equal(step, undefined);
  });

  it("markStepInProgress transitions step from pending to in_progress", () => {
    const task = createTask("test progress");
    const step = task.steps[0];
    markStepInProgress(task, step.id);
    assert.equal(step.status, "in_progress");
  });

  it("markStepComplete increments completed count", () => {
    const task = createTask("test completion");
    const step = task.steps[0];
    markStepComplete(task, step.id, "done");
    assert.equal(step.status, "completed");
    assert.equal(task.completed, 1);
    assert.equal(step.result, "done");
  });

  it("markStepFailed increments failed count", () => {
    const task = createTask("test failure");
    const step = task.steps[0];
    markStepFailed(task, step.id, "error occurred");
    assert.equal(step.status, "failed");
    assert.equal(task.failed, 1);
    assert.equal(step.result, "error occurred");
  });

  it("getSummary returns formatted task summary", () => {
    const task = createTask("test summary");
    markStepComplete(task, task.steps[0].id, "navigated OK");
    const summary = getSummary(task);
    assert.ok(summary.includes("=== Pilot Task Summary ==="));
    assert.ok(summary.includes("test summary"));
    assert.ok(summary.includes("[OK]"));
  });

  it("createTask returns unique IDs", () => {
    const task1 = createTask("task a");
    const task2 = createTask("task b");
    assert.notEqual(task1.id, task2.id);
  });
});
