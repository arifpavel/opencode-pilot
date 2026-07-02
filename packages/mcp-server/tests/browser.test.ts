import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";

const mockPage = {
  goto: mock.fn(() => Promise.resolve({ status: () => 200 })),
  title: mock.fn(() => Promise.resolve("Test Page")),
  url: mock.fn(() => Promise.resolve("https://example.com")),
  waitForSelector: mock.fn(() => Promise.resolve(true)),
  click: mock.fn(() => Promise.resolve()),
  fill: mock.fn(() => Promise.resolve()),
  content: mock.fn(() => Promise.resolve("<html><body>Hello</body></html>")),
  $: mock.fn(() =>
    Promise.resolve({ textContent: () => Promise.resolve("Hello") }),
  ),
  evaluate: mock.fn(() => Promise.resolve("evaluated")),
  screenshot: mock.fn(() => Promise.resolve()),
  close: mock.fn(() => Promise.resolve()),
  isClosed: mock.fn(() => false),
  on: mock.fn(),
  waitForLoadState: mock.fn(() => Promise.resolve()),
  waitForTimeout: mock.fn(() => Promise.resolve()),
  getByText: mock.fn(() => ({
    first: () => ({ click: mock.fn(() => Promise.resolve()) }),
  })),
};

const mockContext = {
  newPage: mock.fn(() => Promise.resolve(mockPage)),
  addCookies: mock.fn(() => Promise.resolve()),
  cookies: mock.fn(() => Promise.resolve([])),
  close: mock.fn(() => Promise.resolve()),
};

const mockBrowser = {
  newContext: mock.fn(() => Promise.resolve(mockContext)),
  close: mock.fn(() => Promise.resolve()),
};

const { browser } = await import("../src/browser.js");

describe("BrowserSession", () => {
  before(() => {
    process.env.PILOT_HEADLESS = "true";
    browser.setBrowserLauncher(() =>
      Promise.resolve(mockBrowser as unknown as import("playwright").Browser),
    );
  });

  after(async () => {
    await browser.close();
  });

  it("navigates to a URL and returns title", async () => {
    const result = await browser.navigate("https://example.com");
    assert.equal(result.success, true);
    assert.equal(result.title, "Test Page");
  });

  it("clicks an element by CSS selector", async () => {
    const result = await browser.click("#submit-btn");
    assert.equal(result.success, true);
  });

  it("types text into an input", async () => {
    const result = await browser.type("#email", "test@example.com");
    assert.equal(result.success, true);
  });

  it("captures a screenshot", async () => {
    const result = await browser.screenshot("test-shot");
    assert.equal(result.success, true);
    assert.ok(result.path.includes("test-shot"));
  });

  it("extracts text from the full page", async () => {
    const result = await browser.extract();
    assert.equal(result.success, true);
    assert.equal(typeof result.content, "string");
  });

  it("extracts text from a specific selector", async () => {
    const result = await browser.extract("h1");
    assert.equal(result.success, true);
    assert.equal(result.content, "Hello");
  });

  it("inspects console and network logs", async () => {
    const result = await browser.inspect();
    assert.equal(result.success, true);
    assert.ok(Array.isArray(result.consoleErrors));
    assert.equal(typeof result.networkRequests, "number");
  });

  it("evaluates JavaScript in page context", async () => {
    const result = await browser.evaluate("document.title");
    assert.equal(result.success, true);
    assert.equal(result.result, "evaluated");
  });

  it("handles navigation to invalid URL gracefully", async () => {
    mockPage.goto.mock.mockImplementation(() =>
      Promise.reject(new Error("Timeout")),
    );
    const result = await browser.navigate("https://invalid.example");
    assert.equal(result.success, false);
    mockPage.goto.mock.mockImplementation(() =>
      Promise.resolve({ status: () => 200 }),
    );
  });

  it("falls back to text locator when CSS selector fails", async () => {
    mockPage.waitForSelector.mock.mockImplementation(() =>
      Promise.reject(new Error("Element not found")),
    );
    const result = await browser.click("#nonexistent");
    assert.equal(result.success, true);
    mockPage.waitForSelector.mock.mockImplementation(() =>
      Promise.resolve(true),
    );
  });
});
