import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { browser } from "./browser.js";

const server = new Server(
  {
    name: "opencode-pilot-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "pilot_navigate",
      description: "Navigate the browser to a URL",
      inputSchema: {
        type: "object",
        required: ["url"],
        properties: {
          url: { type: "string", description: "The URL to navigate to" },
        },
      },
    },
    {
      name: "pilot_click",
      description: "Click an element identified by CSS selector or visible text",
      inputSchema: {
        type: "object",
        required: ["selector"],
        properties: {
          selector: {
            type: "string",
            description: "CSS selector or exact visible text to click",
          },
        },
      },
    },
    {
      name: "pilot_type",
      description: "Type text into an input field",
      inputSchema: {
        type: "object",
        required: ["selector", "text"],
        properties: {
          selector: { type: "string", description: "CSS selector of the input" },
          text: { type: "string", description: "Text to type" },
        },
      },
    },
    {
      name: "pilot_screenshot",
      description: "Capture a screenshot of the current page",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Optional filename (without extension)",
          },
        },
      },
    },
    {
      name: "pilot_extract",
      description: "Extract text content from the page or a specific element",
      inputSchema: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "Optional CSS selector to extract from a specific element",
          },
        },
      },
    },
    {
      name: "pilot_inspect",
      description: "Get console errors and network request logs from the page",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "pilot_evaluate",
      description: "Execute JavaScript in the browser page context",
      inputSchema: {
        type: "object",
        required: ["script"],
        properties: {
          script: {
            type: "string",
            description: "JavaScript code to execute",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "pilot_navigate": {
        const { url } = args as { url: string };
        const result = await browser.navigate(url);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "pilot_click": {
        const { selector } = args as { selector: string };
        const result = await browser.click(selector);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "pilot_type": {
        const { selector, text } = args as { selector: string; text: string };
        const result = await browser.type(selector, text);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "pilot_screenshot": {
        const { name: screenshotName } = (args || {}) as { name?: string };
        const result = await browser.screenshot(screenshotName);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "pilot_extract": {
        const { selector } = (args || {}) as { selector?: string };
        const result = await browser.extract(selector);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "pilot_inspect": {
        const result = await browser.inspect();
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "pilot_evaluate": {
        const { script } = args as { script: string };
        const result = await browser.evaluate(script);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ success: false, error: msg }) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("opencode-pilot-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
