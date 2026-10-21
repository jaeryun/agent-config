import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repo = fileURLToPath(new URL('../', import.meta.url));
const piPackage = join(repo, 'node_modules/@earendil-works/pi-coding-agent');
const plugin = join(repo, 'node_modules/pi-subagents');

const text = content => typeof content === 'string' ? content
  : Array.isArray(content) ? content.map(part => part.text ?? '').join('\n') : '';

function run(binary, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`Timed out: ${args.join(' ')}\n${stderr}`)); }, 45000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

for (const scenario of ['roles', 'reviewer-grant', 'vision', 'broken-extension']) {
test(`real pi-subagents preserves native behavior: ${scenario}`, { timeout: 60000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'agent-config-native-pi-'));
  const target = join(root, 'agent');
  const workspace = join(root, 'workspace');
  await mkdir(target);
  await mkdir(workspace);
  t.after(() => rm(root, { recursive: true, force: true }));
  const evidence = join(workspace, 'evidence.txt');
  await writeFile(evidence, 'ACTUAL_READ_RESULT_7319\n');
  const image = join(workspace, 'pixel.png');
  // Opaque test fixture: the endpoint checks image transport, not visual interpretation.
  await writeFile(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64'));
  const vision = scenario === 'vision' || scenario === 'broken-extension';
  const reviewer = scenario === 'reviewer-grant';
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      const tools = (body.tools ?? []).map(tool => tool.function?.name ?? tool.name);
      const messages = body.messages ?? [];
      const parent = messages.some(message => message.role === 'user' && text(message.content).includes('MAIN_DISPATCH_7319'));
      const results = messages.filter(message => message.role === 'tool');
      const hasImages = messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === 'image_url'));
      requests.push({ model: body.model, effort: body.reasoning_effort, tools, parent, hasImages });
      let call, answer;
      const launches = messages.filter(message => message.role === 'assistant')
        .flatMap(message => message.tool_calls ?? []).filter(tool => tool.function?.name === 'subagent');
      if (parent && !tools.includes('subagent')) call = { name: 'subagents_enable', arguments: '{}' };
      else if (parent && launches.length < (scenario === 'roles' ? 2 : 1)) call = { name: 'subagent', arguments: JSON.stringify({
        agent: vision ? 'image-analyst' : reviewer ? 'reviewer' : launches.length === 0 ? 'scout' : 'task',
        task: vision ? `Inspect ${image} and return a concise visual observation with its evidence path.` : `Read ${evidence} and report its contents. Do not edit any files.`,
        async: false, options: { context: 'fresh', agentScope: 'user', mission: false, acceptance: { level: 'none', reason: 'Read-only integration check' } },
      }) };
      else if (!parent && reviewer && tools.includes('subagent') && launches.length < 2) call = { name: 'subagent', arguments: JSON.stringify({
        agent: launches.length === 0 ? 'task' : 'scout',
        task: `Read ${evidence} and report its contents. Do not edit.`,
        async: false, options: { context: 'fresh', mission: false, acceptance: { level: 'none', reason: 'Read-only nested check' } },
      }) };
      else if (!parent && tools.includes('read') && !results.length) call = { name: 'read', arguments: JSON.stringify({ path: vision ? image : evidence }) };
      else answer = `${parent ? 'PARENT_DONE' : 'NATIVE_WORKER_DONE'} ${body.model}\n${hasImages ? 'IMAGE_TRANSPORT_CONFIRMED' : ''}\n${results.map(message => text(message.content)).join('\n')}`;
      const delta = call ? { role: 'assistant', tool_calls: [{ index: 0, id: `call_${requests.length}`, type: 'function', function: call }] }
        : { role: 'assistant', content: answer };
      const event = (delta, finish_reason = null) => ({ id: `response_${requests.length}`, object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000), model: body.model, choices: [{ index: 0, delta, finish_reason }] });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify(event(delta))}\n\n`);
      res.write(`data: ${JSON.stringify(event({}, call ? 'tool_calls' : 'stop'))}\n\n`);
      res.end('data: [DONE]\n\n');
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const env = { PATH: process.env.PATH, HOME: join(root, 'home'), TMPDIR: root,
    XDG_STATE_HOME: join(root, 'state'), PI_CODING_AGENT_DIR: target, PI_OFFLINE: '1', PI_TELEMETRY: '0', TERM: 'dumb', NO_COLOR: '1' };
  const metadata = JSON.parse(await readFile(join(piPackage, 'package.json'), 'utf8'));
  const cli = join(piPackage, metadata.bin.pi);
  const installPlugin = await run(process.execPath, [cli, 'install', plugin], workspace, env);
  assert.equal(installPlugin.code, 0, installPlugin.stderr);
  const settingsPath = join(target, 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  Object.assign(settings, { defaultProvider: 'smoke', defaultModel: 'parent', defaultThinkingLevel: 'medium', retry: { enabled: false },
    cacheWarming: 'off', enableInstallTelemetry: false, enableAnalytics: false, quietStartup: true });
  await writeFile(settingsPath, JSON.stringify(settings));
  const model = id => ({ id, name: id, reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000, maxTokens: 4096, compat: { supportsReasoningEffort: true } });
  await writeFile(join(target, 'models.json'), JSON.stringify({ providers: { smoke: {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`, api: 'openai-completions', apiKey: 'local-only', models: [model('parent'), model('worker'), model('scout'), model('reviewer'), model('vision')],
  } } }));
  const config = YAML.parse(await readFile(join(repo, 'config.example.yaml'), 'utf8'));
  // The main list is a native Pi scope; the first entry is the startup model. Workers never inherit it.
  config.agents.orchestrator.models = [{ model: 'smoke/parent', effort: 'medium' }, { model: 'smoke/scout', effort: 'low' }];
  await mkdir(join(root, 'definitions'));
  for (const [name, agent] of Object.entries(config.agents)) {
    const prompt = await readFile(join(repo, agent.definition), 'utf8');
    agent.definition = `definitions/${name}.md`;
    await writeFile(join(root, agent.definition), prompt);
    if (name === 'orchestrator') continue;
    agent.model = { task: 'smoke/worker', scout: 'smoke/scout' }[name] ?? 'smoke/reviewer';
    agent.effort = name === 'scout' ? 'low' : 'high';
  }
  config.agents.reviewer.model = 'smoke/reviewer';
  config.agents.reviewer.effort = 'high';
  config.agents['image-analyst'].model = 'smoke/vision';
  config.agents['image-analyst'].effort = 'low';
  config.agents['image-analyst'].extensions = { pi: [] };
  if (scenario === 'broken-extension') {
    await writeFile(join(root, 'broken.mjs'), 'export default function () { throw new Error("Inspection extension could not initialize"); }\n');
    config.agents['image-analyst'].extensions.pi = ['broken.mjs'];
    config.agents['image-analyst'].tools.pi = ['read', 'inspection_tool'];
  }
  const configPath = join(root, 'config.local.yaml');
  await writeFile(configPath, YAML.stringify(config));
  const install = await run(process.execPath, [join(repo, 'scripts/install.mjs'), '--client', 'pi', '--config', configPath,
    '--agent-dir', target, '--pi-subagents-dir', plugin], workspace, env);
  assert.equal(install.code, 0, install.stderr);
  const installed = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(installed.enabledModels, ['smoke/parent:medium', 'smoke/scout:low']);
  assert.equal(installed.defaultProvider, 'smoke');
  assert.equal(installed.defaultModel, 'parent');
  const result = await run(process.execPath, [cli, '--mode', 'json', '-p', '--no-session', '--provider', 'smoke', '--model', 'parent',
    '--thinking', 'medium', 'MAIN_DISPATCH_7319: Delegate the requested evidence inspection to the configured roles.'], workspace, env);
  assert.equal(result.code, 0, result.stderr);
  const events = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  const completed = events.filter(event => event.type === 'tool_execution_end' && event.toolName === 'subagent');
  assert.equal(completed.length, scenario === 'roles' ? 2 : 1, result.stdout + result.stderr);
  if (scenario === 'broken-extension') {
    assert.equal(completed[0].isError || completed[0].result?.isError, true, JSON.stringify(completed));
    assert.equal(requests.filter(request => !request.parent).length, 0, 'A missing inspection tool must not silently fall back to another worker');
    return;
  }
  for (const event of completed) {
    assert.notEqual(event.isError, true, JSON.stringify(event));
    assert.notEqual(event.result?.isError, true, JSON.stringify(event));
    assert.match(JSON.stringify(event.result), vision ? /IMAGE_TRANSPORT_CONFIRMED/ : /ACTUAL_READ_RESULT_7319/);
  }
  const workers = requests.filter(request => !request.parent && request.tools.includes('read'));
  if (vision) {
    assert.ok(workers.some(request => request.model === 'vision' && request.effort === 'low' && request.hasImages));
    assert.ok(workers.every(request => !request.tools.includes('subagent')));
    assert.ok(requests.filter(request => request.parent).every(request => !request.hasImages), 'The vision-capable parent receives the result, not every image again');
  } else if (reviewer) {
    assert.ok(workers.some(request => request.model === 'reviewer' && request.effort === 'high' && request.tools.includes('subagent')));
    assert.ok(workers.some(request => request.model === 'scout' && request.effort === 'low' && !request.tools.includes('subagent') && !request.tools.includes('bash')), 'Allowed nested scout executes');
    assert.ok(requests.every(request => request.model !== 'worker'), 'Reviewer must not launch the forbidden task role');
  } else {
    assert.ok(workers.some(request => request.model === 'scout' && request.effort === 'low' && !request.tools.includes('bash') && !request.tools.includes('write') && !request.tools.includes('subagent')));
    assert.ok(workers.some(request => request.model === 'worker' && request.effort === 'high' && request.tools.includes('write') && request.tools.includes('subagent')));
  }
  assert.ok(requests.every(request => !request.tools.includes('agent_config_task')));
  const final = events.filter(event => event.type === 'message_end' && event.message?.role === 'assistant').at(-1);
  assert.match(text(final?.message?.content), /PARENT_DONE/);
  assert.match(text(final?.message?.content), vision ? /IMAGE_TRANSPORT_CONFIRMED/ : /ACTUAL_READ_RESULT_7319/);
});
}
