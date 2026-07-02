import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE_DIR = join(homedir(), ".opencode-pilot");
const ACTIONS_DIR = join(BASE_DIR, "actions");
const SESSIONS_DIR = join(BASE_DIR, "sessions");
const SESSION_FILE = join(SESSIONS_DIR, "current.json");

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function logAction(action: string, data: Record<string, unknown>): Promise<void> {
  await ensureDir(ACTIONS_DIR);
  const timestamp = new Date().toISOString();
  const entry = JSON.stringify({ timestamp, action, data }) + "\n";
  const filename = `${new Date().toISOString().slice(0, 10)}.jsonl`;
  await appendFile(join(ACTIONS_DIR, filename), entry, "utf-8");
}

export interface SessionState {
  cookies: unknown[];
  currentUrl: string;
  title: string;
  updatedAt: string;
}

export async function saveSession(state: SessionState): Promise<void> {
  await ensureDir(SESSIONS_DIR);
  await writeFile(SESSION_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export async function loadSession(): Promise<SessionState | null> {
  try {
    const data = await readFile(SESSION_FILE, "utf-8");
    return JSON.parse(data) as SessionState;
  } catch {
    return null;
  }
}
