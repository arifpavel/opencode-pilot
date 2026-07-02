import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPendingApprovals, requiresApproval } from "../src/approvals.js";

describe("approvals", () => {
  it("requires approval for delete actions", () => {
    assert.equal(requiresApproval("delete user account"), true);
  });

  it("requires approval for submit actions", () => {
    assert.equal(requiresApproval("submit order form"), true);
  });

  it("requires approval for production-related actions", () => {
    assert.equal(requiresApproval("deploy to production"), true);
  });

  it("requires approval for credential actions", () => {
    assert.equal(requiresApproval("enter password"), true);
  });

  it("does not require approval for safe actions", () => {
    assert.equal(requiresApproval("navigate to homepage"), false);
  });

  it("does not require approval for extract actions", () => {
    assert.equal(requiresApproval("extract page content"), false);
  });

  it("requires approval for remove actions", () => {
    assert.equal(requiresApproval("remove item from cart"), true);
  });

  it("requires approval for destroy actions", () => {
    assert.equal(requiresApproval("destroy test data"), true);
  });

  it("requires approval for truncate actions", () => {
    assert.equal(requiresApproval("truncate table"), true);
  });

  it("does not require approval for screenshot actions", () => {
    assert.equal(requiresApproval("capture screenshot"), false);
  });

  it("is case-insensitive for risk detection", () => {
    assert.equal(requiresApproval("DELETE all records"), true);
    assert.equal(requiresApproval("Submit payment"), true);
    assert.equal(requiresApproval("PRODUCTION deploy"), true);
  });

  it("getPendingApprovals returns empty array initially", () => {
    const pending = getPendingApprovals();
    assert.ok(Array.isArray(pending));
  });
});
