export interface ApprovalRequest {
  id: string;
  action: string;
  details: string;
  status: "pending" | "approved" | "denied";
  timestamp: number;
}

const highRiskPatterns = [
  /submit/i,
  /delete/i,
  /remove/i,
  /production/i,
  /credential/i,
  /password/i,
  /secret/i,
  /token/i,
  /drop/i,
  /truncate/i,
  /destroy/i,
];

const pendingRequests = new Map<string, ApprovalRequest>();

let requestCounter = 0;

export function requiresApproval(action: string): boolean {
  return highRiskPatterns.some((pattern) => pattern.test(action));
}

export function requestApproval(
  action: string,
  details: string
): Promise<boolean> {
  const id = `approval_${++requestCounter}`;
  const request: ApprovalRequest = {
    id,
    action,
    details,
    status: "pending",
    timestamp: Date.now(),
  };

  pendingRequests.set(id, request);

  return new Promise((resolve) => {
    const message = [
      "APPROVAL REQUIRED",
      `Action: ${action}`,
      `Details: ${details}`,
      "Approve? Respond with 'yes' to approve or 'no' to deny.",
    ].join("\n");

    process.stdout.write(`\n---\n${message}\n---\n`);

    const onData = (data: Buffer) => {
      const input = data.toString().trim().toLowerCase();
      if (input === "yes" || input === "y") {
        request.status = "approved";
        resolve(true);
        cleanup();
      } else if (input === "no" || input === "n") {
        request.status = "denied";
        resolve(false);
        cleanup();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      pendingRequests.delete(id);
    };

    process.stdin.on("data", onData);
  });
}

export function getPendingApprovals(): ApprovalRequest[] {
  return Array.from(pendingRequests.values()).filter(
    (r) => r.status === "pending"
  );
}
