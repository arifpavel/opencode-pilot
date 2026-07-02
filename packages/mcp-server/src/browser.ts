import { Browser, BrowserContext, Page, chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logAction, saveSession, loadSession } from "./store.js";

const SCREENSHOTS_DIR = join(homedir(), ".opencode-pilot", "screenshots");
const HEADLESS = process.env.PILOT_HEADLESS === "true";

interface ConsoleEntry {
  type: string;
  text: string;
}

interface NetworkEntry {
  url: string;
  method: string;
  status: number;
}

class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleEntries: ConsoleEntry[] = [];
  private networkEntries: NetworkEntry[] = [];

  async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;

    if (!this.browser) {
      this.browser = await chromium.launch({ headless: HEADLESS });
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
    }

    const stored = await loadSession();
    if (stored && stored.cookies.length > 0) {
      await this.context.addCookies(
        stored.cookies as unknown as Parameters<BrowserContext["addCookies"]>[0]
      );
    }

    this.page = await this.context.newPage();
    this.consoleEntries = [];
    this.networkEntries = [];

    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.consoleEntries.push({ type: msg.type(), text: msg.text() });
      }
    });

    this.page.on("request", (req) => {
      this.networkEntries.push({
        url: req.url(),
        method: req.method(),
        status: 0,
      });
    });

    this.page.on("response", (res) => {
      const existing = this.networkEntries.find((e) => e.url === res.url());
      if (existing) existing.status = res.status();
    });

    return this.page;
  }

  async navigate(url: string): Promise<{ success: boolean; url: string; title: string }> {
    try {
      const page = await this.ensurePage();
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const title = await page.title();
      const finalUrl = page.url();

      const cookies = await this.context!.cookies();
      await saveSession({
        cookies: cookies as unknown as Record<string, unknown>[],
        currentUrl: finalUrl,
        title,
        updatedAt: new Date().toISOString(),
      });

      await logAction("navigate", { url: finalUrl, title, status: response?.status() });

      return { success: true, url: finalUrl, title };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await logAction("navigate_error", { url, error: msg });
      return { success: false, url, title: "" };
    }
  }

  async click(selector: string): Promise<{ success: boolean; action: string }> {
    try {
      const page = await this.ensurePage();
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      await logAction("click", { selector });
      return { success: true, action: `Clicked element: ${selector}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      try {
        const page = await this.ensurePage();
        const link = page.getByText(selector, { exact: true }).first();
        await link.click({ timeout: 5000 });
        await logAction("click", { selector: `text="${selector}"` });
        return { success: true, action: `Clicked element: ${selector}` };
      } catch {
        await logAction("click_error", { selector, error: msg });
        return { success: false, action: `Failed to click: ${msg}` };
      }
    }
  }

  async type(selector: string, text: string): Promise<{ success: boolean; action: string }> {
    try {
      const page = await this.ensurePage();
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.fill(selector, text);
      await logAction("type", { selector, text });
      return { success: true, action: `Typed "${text}" into ${selector}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await logAction("type_error", { selector, text, error: msg });
      return { success: false, action: `Failed to type: ${msg}` };
    }
  }

  async screenshot(name?: string): Promise<{ success: boolean; path: string }> {
    try {
      const page = await this.ensurePage();
      if (!existsSync(SCREENSHOTS_DIR)) {
        await mkdir(SCREENSHOTS_DIR, { recursive: true });
      }
      const filename = name
        ? `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`
        : `screenshot_${Date.now()}.png`;
      const filepath = join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      await logAction("screenshot", { path: filepath });
      return { success: true, path: filepath };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await logAction("screenshot_error", { error: msg });
      return { success: false, path: msg };
    }
  }

  async extract(selector?: string): Promise<{ success: boolean; content: string }> {
    try {
      const page = await this.ensurePage();
      let content: string;
      if (selector) {
        const el = await page.$(selector);
        if (!el) {
          return { success: false, content: `Element not found: ${selector}` };
        }
        content = (await el.textContent()) || "";
      } else {
        content = await page.content();
      }
      await logAction("extract", { selector: selector || "full_page" });
      return { success: true, content };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await logAction("extract_error", { selector, error: msg });
      return { success: false, content: msg };
    }
  }

  async inspect(): Promise<{
    success: boolean;
    consoleErrors: string[];
    networkRequests: number;
  }> {
    try {
      const errors = this.consoleEntries.map((e) => e.text);
      const count = this.networkEntries.length;
      await logAction("inspect", { consoleErrors: errors.length, networkRequests: count });
      return { success: true, consoleErrors: errors, networkRequests: count };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, consoleErrors: [msg], networkRequests: 0 };
    }
  }

  async evaluate(script: string): Promise<{ success: boolean; result: string }> {
    try {
      const page = await this.ensurePage();
      const result = await page.evaluate(script);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      await logAction("evaluate", { script });
      return { success: true, result: resultStr };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await logAction("evaluate_error", { script, error: msg });
      return { success: false, result: msg };
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch {
      // ignore close errors
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

export const browser = new BrowserSession();
