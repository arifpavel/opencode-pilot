declare module "@opencode-ai/plugin" {
  export interface PluginContext {
    project: unknown;
    client: unknown;
    $: unknown;
    directory: string;
    worktree: string;
  }

  export interface SystemTransformInput {
    system: string;
  }

  export interface SystemTransformOutput {
    system: string;
  }

  export interface ToolDefinitionEntry {
    name: string;
    description: string;
  }

  export interface ToolDefinitionInput {
    tools: ToolDefinitionEntry[];
  }

  export interface ToolDefinitionOutput {
    tools: ToolDefinitionEntry[];
  }

  export interface ToolExecuteAfterInput {
    tool: string;
    args: Record<string, unknown>;
  }

  export interface ToolExecuteAfterOutput {
    result?: Record<string, unknown>;
  }

  export interface SessionCompactingInput {
    messages: unknown[];
  }

  export interface SessionCompactingOutput {
    context: string[];
    prompt?: string;
  }

  export interface ToolConfig {
    description: string;
    args: Record<string, unknown>;
    execute: (
      args: Record<string, unknown>,
      context: { directory: string; worktree: string }
    ) => string | Promise<string>;
  }

  export interface PluginHooks {
    "experimental.chat.system.transform"?: (
      input: SystemTransformInput,
      output: SystemTransformOutput
    ) => void | Promise<void>;
    "tool.definition"?: (
      input: ToolDefinitionInput,
      output: ToolDefinitionOutput
    ) => void | Promise<void>;
    "tool.execute.after"?: (
      input: ToolExecuteAfterInput,
      output: ToolExecuteAfterOutput
    ) => void | Promise<void>;
    "experimental.session.compacting"?: (
      input: SessionCompactingInput,
      output: SessionCompactingOutput
    ) => void | Promise<void>;
    tool?: Record<string, ToolConfig>;
    [key: string]: unknown;
  }

  export type Plugin = (
    ctx: PluginContext
  ) => PluginHooks | Promise<PluginHooks>;

  export function createPlugin(hooks: PluginHooks): Plugin;

  export function tool(config: ToolConfig): ToolConfig;

  export namespace tool {
    export const schema: {
      string: () => unknown;
    };
  }
}
