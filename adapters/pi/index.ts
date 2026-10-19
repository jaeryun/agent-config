import { spawn, type ChildProcess } from "node:child_process";
import { setMaxListeners } from "node:events";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

// Structural types deliberately avoid imports from either Pi npm package namespace.
type Model = {
  provider: string;
  id: string;
  reasoning: boolean;
  thinkingLevelMap?: Record<string, unknown>;
};
type Context = {
  cwd: string;
  model?: Model;
  signal?: AbortSignal;
  modelRegistry: { find(provider: string, id: string): Model | undefined };
};
type Result = {
  content: { type: "text"; text: string }[];
  details: { failed: boolean };
  isError: boolean;
};
type Pi = {
  getThinkingLevel(): string;
  registerTool(tool: {
    name: string;
    label: string;
    description: string;
    parameters: Record<string, unknown>;
    execute(id: string, input: unknown, signal: AbortSignal | undefined,
      onUpdate: unknown, ctx: Context): Promise<Result>;
  }): void;
  on(event: "session_shutdown", handler: () => void): void;
  on(event: "tool_result", handler: (event: {
    toolName: string;
    details?: unknown;
  }) => { isError: true } | undefined): void;
};
type Agent = {
  name: string;
  description: string;
  prompt: string;
  model: string | null;
  effort: string | null;
  tools: string[];
};
type Config = { version: 1; concurrency: number; agents: Agent[] };
type Task = { agent: string; task: string };
type Invocation = { command: string; prefix: string[]; supportsMax: boolean };
type Work = { agent: Agent; task: string; model: Model; effort: string };

const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const TOOLS: Record<string, true> = {
  read: true, bash: true, edit: true, write: true, grep: true, find: true, ls: true, powershell: true,
};
const PACKAGES: Record<string, true> = {
  "@mariozechner/pi-coding-agent": true,
  "@earendil-works/pi-coding-agent": true,
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`${label}: unknown field ${JSON.stringify(key)}`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be nonempty text`);
  return value;
}

function loadConfig(): Config {
  const value = object(JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8")), "config");
  keys(value, ["version", "concurrency", "agents"], "config");
  if (value.version !== 1) throw new Error("config.version must be 1");
  if (!Number.isSafeInteger(value.concurrency) || (value.concurrency as number) < 1) {
    throw new Error("config.concurrency must be a positive safe integer");
  }
  if (!Array.isArray(value.agents) || value.agents.length === 0) throw new Error("config.agents must be a nonempty array");
  const names = new Set<string>();
  const agents = value.agents.map((entry, index): Agent => {
    const label = `config.agents[${index}]`;
    const agent = object(entry, label);
    keys(agent, ["name", "description", "prompt", "model", "effort", "tools"], label);
    const name = text(agent.name, `${label}.name`);
    if (!/^[a-z][a-z0-9-]*$/.test(name) || name === "orchestrator" || names.has(name)) {
      throw new Error(`${label}.name must be a unique worker name (not orchestrator)`);
    }
    names.add(name);
    if (agent.model !== null && (typeof agent.model !== "string" || !/^[^\s/:]+\/\S+$/.test(agent.model))) {
      throw new Error(`${label}.model must be null or an exact provider/model-id`);
    }
    if (agent.effort !== null && !LEVELS.includes(agent.effort as string)) {
      throw new Error(`${label}.effort must be null or one of ${LEVELS.join(", ")}`);
    }
    if (!Array.isArray(agent.tools) || agent.tools.some((tool) => typeof tool !== "string" || !Object.hasOwn(TOOLS, tool)) ||
      new Set(agent.tools).size !== agent.tools.length) {
      throw new Error(`${label}.tools must contain unique built-in Pi tool names`);
    }
    return {
      name, description: text(agent.description, `${label}.description`),
      prompt: text(agent.prompt, `${label}.prompt`), model: agent.model as string | null,
      effort: agent.effort as string | null, tools: agent.tools as string[],
    };
  });
  return { version: 1, concurrency: value.concurrency as number, agents };
}

function parseInput(input: unknown): { context: string; tasks: Task[] } {
  const value = object(input, "arguments");
  keys(value, ["context", "tasks"], "arguments");
  if (typeof value.context !== "string") throw new Error("context must be a string (empty is allowed)");
  if (!Array.isArray(value.tasks) || value.tasks.length === 0) throw new Error("tasks must be a nonempty array");
  return {
    context: value.context,
    tasks: value.tasks.map((entry, index) => {
      const task = object(entry, `tasks[${index}]`);
      keys(task, ["agent", "task"], `tasks[${index}]`);
      return { agent: text(task.agent, `tasks[${index}].agent`), task: text(task.task, `tasks[${index}].task`) };
    }),
  };
}

// No PATH lookup: a Node SDK host must identify its actual Pi CLI explicitly.
function invocation(): Invocation {
  const explicit = process.env.AGENT_CONFIG_PI_CLI;
  const candidate = explicit ?? process.argv[1];
  if (explicit && !isAbsolute(explicit)) throw new Error("AGENT_CONFIG_PI_CLI must be an absolute Pi CLI entrypoint");
  if (candidate && existsSync(candidate)) {
    const script = realpathSync(candidate);
    let dir = dirname(script);
    while (true) {
      const manifest = join(dir, "package.json");
      if (existsSync(manifest)) {
        const pkg = JSON.parse(readFileSync(manifest, "utf8"));
        if (Object.hasOwn(PACKAGES, pkg.name) && typeof pkg.bin?.pi === "string" &&
          realpathSync(resolve(dir, pkg.bin.pi)) === script) {
          const major = Number(String(pkg.version).split(".")[0]);
          return { command: process.execPath, prefix: [script], supportsMax: major >= 1 };
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  if (!explicit && /^pi(?:\.exe)?$/.test(basename(process.execPath))) {
    // Official compiled Pi runs itself, not Node with its virtual bundled script.
    return { command: process.execPath, prefix: [], supportsMax: false };
  }
  throw new Error("Cannot verify the active Pi executable. SDK hosts must set AGENT_CONFIG_PI_CLI to the official package's absolute bin.pi entrypoint; PATH fallback is disabled.");
}

function selectWork(tasks: Task[], config: Config, ctx: Context, parentEffort: string, cli: Invocation): Work[] {
  // Validate the whole batch before starting any child, including inherited values.
  return tasks.map(({ agent: name, task }) => {
    const agent = config.agents.find((entry) => entry.name === name);
    if (!agent) throw new Error(`Unknown agent ${JSON.stringify(name)}. Available: ${config.agents.map((entry) => entry.name).join(", ")}`);
    let provider: string;
    let id: string;
    if (agent.model === null) {
      if (!ctx.model) throw new Error(`${name}: no active parent model to inherit`);
      ({ provider, id } = ctx.model);
    } else {
      const slash = agent.model.indexOf("/");
      provider = agent.model.slice(0, slash);
      id = agent.model.slice(slash + 1);
    }
    const model = ctx.modelRegistry.find(provider, id);
    if (!model || model.provider !== provider || model.id !== id) {
      throw new Error(`${name}: exact model ${provider}/${id} is not registered in the active parent runtime`);
    }
    const effort = agent.effort ?? parentEffort;
    // Matches Pi's native getSupportedThinkingLevels metadata contract (0.73.1+).
    const supported = LEVELS.filter((level) => {
      if (!model.reasoning) return level === "off";
      const mapped = model.thinkingLevelMap?.[level];
      return mapped !== null && ((level !== "xhigh" && level !== "max") || mapped !== undefined);
    });
    if (!supported.includes(effort) || (effort === "max" && !cli.supportsMax)) {
      throw new Error(`${name}: ${provider}/${id} cannot honor exact thinking level ${JSON.stringify(effort)} in this Pi CLI; supported model levels: ${supported.join(", ")}. Set an explicit supported effort instead of relying on clamping.`);
    }
    if (agent.tools.includes("powershell") && !cli.supportsMax) {
      throw new Error(`${name}: powershell requires current Pi; it is not a built-in tool in legacy Pi`);
    }
    return { agent, task, model, effort };
  });
}

// One FIFO semaphore per extension runtime, not one per tool call.
function limiter(capacity: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async (signal: AbortSignal): Promise<() => void> => {
    signal.throwIfAborted();
    await new Promise<void>((accept, reject) => {
      const start = () => {
        signal.removeEventListener("abort", cancel);
        running++;
        accept();
      };
      const cancel = () => {
        const index = queue.indexOf(start);
        if (index !== -1) queue.splice(index, 1);
        reject(new Error("Cancelled while waiting for a worker slot"));
      };
      if (running < capacity) start();
      else {
        queue.push(start);
        signal.addEventListener("abort", cancel, { once: true });
      }
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      running--;
      queue.shift()?.();
    };
  };
}

function terminate(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function runChild(work: Work, context: string, cwd: string, cli: Invocation,
  signal: AbortSignal, children: Set<ChildProcess>, agentDir: string): Promise<string> {
  signal.throwIfAborted();
  const dir = await mkdtemp(join(tmpdir(), "agent-config-pi-"));
  try {
    const promptFile = join(dir, "role.md");
    await writeFile(promptFile, `${work.agent.prompt}\n\n# Worker invocation boundary\nYou are the ${work.agent.name} worker, not the parent orchestrator. Any AGENTS.md instructions describing parent orchestration or role delegation apply to the parent, not to this worker. Follow this role and the assigned task yourself; do not invoke or recreate subagents. You have a fresh conversation, not the parent's history. The only parent context supplied is in the user message. Return your final answer as text; if blocked, explain the blocker to the parent in that answer.\n`, { mode: 0o600 });
    signal.throwIfAborted();
    const args = [...cli.prefix, "--mode", "json", "-p", "--no-session", "--no-extensions", "--no-skills",
      "--no-prompt-templates", "--provider", work.model.provider, "--model", work.model.id,
      "--thinking", work.effort, "--append-system-prompt", promptFile];
    if (work.agent.tools.length) args.push("--tools", work.agent.tools.join(","));
    else args.push("--no-tools");
    return await new Promise<string>((accept, reject) => {
      const child = spawn(cli.command, args, {
        cwd, env: { ...process.env, PI_CODING_AGENT_DIR: agentDir }, shell: false,
        detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"],
      });
      children.add(child);
      let finalText: string | undefined;
      let finalStop: unknown;
      let protocolError: string | undefined;
      let spawnError = false;
      let killTimer: NodeJS.Timeout | undefined;
      const cancel = () => {
        terminate(child, "SIGTERM");
        killTimer ??= setTimeout(() => terminate(child, "SIGKILL"), 1000);
        killTimer.unref();
      };
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
      child.on("error", () => { spawnError = true; });
      // Never return stderr: providers and tools can print credentials there.
      child.stderr!.resume();
      child.stdin!.on("error", () => { /* close/exit reports the failed invocation */ });
      const lines = createInterface({ input: child.stdout!, crlfDelay: Infinity });
      lines.on("line", (line) => {
        if (!line.trim()) return;
        let event;
        try { event = JSON.parse(line); }
        catch { protocolError = "Pi emitted invalid JSON output"; return; }
        if (event.type !== "message_end" || event.message?.role !== "assistant") return;
        const message = event.message;
        if (message.provider !== work.model.provider || message.model !== work.model.id) {
          protocolError = "Child model does not match the exact requested provider/model";
        }
        finalStop = message.stopReason;
        // Discard thinking, images, tool payloads, usage and intermediate messages.
        finalText = Array.isArray(message.content)
          ? message.content.filter((part: { type?: string; text?: unknown }) => part.type === "text" && typeof part.text === "string")
            .map((part: { text: string }) => part.text).join("\n")
          : "";
      });
      child.on("close", (code, exitSignal) => {
        children.delete(child);
        signal.removeEventListener("abort", cancel);
        clearTimeout(killTimer);
        lines.close();
        if (signal.aborted) reject(new Error("Worker cancelled"));
        else if (spawnError) reject(new Error("Could not start the verified Pi CLI"));
        else if (protocolError) reject(new Error(protocolError));
        else if (code !== 0) reject(new Error(`Pi child failed (${exitSignal ?? `exit ${code}`}); inspect provider configuration privately`));
        else if (finalStop !== "stop" || !finalText?.trim()) {
          reject(new Error(`Pi child did not return a successful final text answer (stop reason: ${String(finalStop)})`));
        } else accept(finalText);
      });
      // Piped input keeps potentially large/private parent context out of process arguments.
      child.stdin!.end(`Parent context (explicit handoff; not shared conversation history):\n${context}\n\nAssigned task:\n${work.task}\n`);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export default function agentConfig(pi: Pi): void {
  const config = loadConfig();
  const acquire = limiter(config.concurrency);
  const calls = new Set<AbortController>();
  const children = new Set<ChildProcess>();
  const exit = () => { for (const child of children) terminate(child, "SIGKILL"); };
  const extensionDir = dirname(fileURLToPath(import.meta.url));
  const installedAgentDir = dirname(dirname(extensionDir));
  const fail = (message: string): Result => ({
    content: [{ type: "text", text: message }], details: { failed: true }, isError: true,
  });
  let stopped = false;
  pi.on("session_shutdown", () => {
    stopped = true;
    for (const call of calls) call.abort();
  });
  // Legacy AgentToolResult ignores returned isError; the stable result hook sets it.
  pi.on("tool_result", (event) => {
    if (event.toolName === "agent_config_task" &&
      (event.details as { failed?: unknown } | undefined)?.failed === true) return { isError: true };
  });
  pi.registerTool({
    name: "agent_config_task",
    label: "Configured worker tasks",
    description: `Delegate tasks to configured roles in separate Pi processes. Supply all relevant context explicitly: workers do not inherit conversation history. Calls block until the batch finishes, share a global concurrency limit of ${config.concurrency}, and return only final text. Follow-up requires a new call with context; no live worker messaging. Roles:\n${config.agents.map((agent) => `- ${agent.name}: ${agent.description}`).join("\n")}`,
    parameters: {
      type: "object", additionalProperties: false, required: ["context", "tasks"],
      properties: {
        context: { type: "string", description: "Explicit shared context for each worker; use empty text when unnecessary." },
        tasks: { type: "array", minItems: 1, items: {
          type: "object", additionalProperties: false, required: ["agent", "task"],
          properties: {
            agent: { type: "string", enum: config.agents.map((agent) => agent.name) },
            task: { type: "string", minLength: 1 },
          },
        } },
      },
    },
    async execute(_id, input, signal, _update, ctx) {
      if (stopped) return fail("This extension runtime has shut down");
      const controller = new AbortController();
      // A batch may legitimately have many queued tasks observing this owned signal.
      setMaxListeners(0, controller.signal);
      const abort = () => controller.abort();
      const signals = new Set([signal, ctx.signal].filter((item): item is AbortSignal => item !== undefined));
      for (const source of signals) {
        source.addEventListener("abort", abort, { once: true });
        if (source.aborted) abort();
      }
      if (calls.size === 0) process.on("exit", exit);
      calls.add(controller);
      try {
        const parsed = parseInput(input);
        const cli = invocation();
        const work = selectWork(parsed.tasks, config, ctx, pi.getThinkingLevel(), cli);
        const agentDir = process.env.PI_CODING_AGENT_DIR || installedAgentDir;
        const results = await Promise.all(work.map(async (item) => {
          let release: (() => void) | undefined;
          try {
            release = await acquire(controller.signal);
            const answer = await runChild(item, parsed.context, ctx.cwd, cli, controller.signal, children, agentDir);
            return { failed: false, text: `## ${item.agent.name}\n${answer}` };
          } catch (error) {
            return { failed: true, text: `## ${item.agent.name} — failed\n${error instanceof Error ? error.message : "Worker failed"}` };
          } finally { release?.(); }
        }));
        const failed = results.some((result) => result.failed);
        return { content: [{ type: "text", text: results.map((result) => result.text).join("\n\n") }], details: { failed }, isError: failed };
      } catch (error) {
        return fail(error instanceof Error ? error.message : "Worker dispatch failed");
      } finally {
        calls.delete(controller);
        if (calls.size === 0) process.removeListener("exit", exit);
        for (const source of signals) source.removeEventListener("abort", abort);
      }
    },
  });
}
