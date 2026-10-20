import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, realpath, stat, symlink, readlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const repo = fileURLToPath(new URL('../', import.meta.url));
const own = (value, key) => Object.hasOwn(value ?? {}, key);

// Config v2: native OMP names (task, sonic, scout, reviewer, security-reviewer, seance) are pi-only
// definitions. `deep` stays a custom role, so it produces a generated definition for both clients.
async function fixture(t, client) {
  const root = await mkdtemp(join(tmpdir(), 'agent-config-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'agent');
  await mkdir(target);
  await writeFile(join(root, 'main.md'), '# Test orchestrator\nPreserve user work.\n');
  await writeFile(join(root, 'worker.md'), '# Test worker\nDeliver the assigned change.\n');
  await writeFile(join(root, 'custom.md'), '# Custom worker\nHandle the assignment end to end.\n');
  const config = {
    version: 2,
    concurrency: 2,
    agents: {
      orchestrator: { description: 'Coordinate', definition: 'main.md', model: 'inherit', effort: 'inherit' },
      task: {
        description: 'Implement',
        definition: 'worker.md',
        model: { omp: 'native', pi: 'inherit' },
        effort: { omp: 'native', pi: 'inherit' },
        tools: { pi: ['read', 'bash'] },
      },
      deep: {
        description: 'Custom depth',
        definition: 'custom.md',
        model: 'inherit',
        effort: { omp: 'medium', pi: 'inherit' },
        tools: { omp: ['read'], pi: ['read'] },
      },
    },
  };
  const configPath = join(root, 'config.local.yaml');
  await writeFile(configPath, YAML.stringify(config));
  const settingsPath = join(target, client === 'omp' ? 'config.yml' : 'settings.json');
  const initial = client === 'omp'
    ? {
        modelRoles: { default: 'example/main:high', unrelated: 'example/other:low' },
        task: { agentModelOverrides: { task: 'example/old-task:low', independent: 'example/independent:high' }, maxConcurrency: 9,
          agentAccountPools: { task: { example: ['account-kept'] } }, agentServiceTierOverrides: { task: 'priority' } },
        extensions: ['original-extension'],
        custom: { preserve: true },
      }
    : { defaultProvider: 'example', defaultModel: 'main', defaultThinkingLevel: 'high', custom: { preserve: true } };
  await writeFile(settingsPath, client === 'omp' ? YAML.stringify(initial) : JSON.stringify(initial, null, 2));
  const originalPolicy = '# Personal instructions\nNever edit my private notes.\n';
  await writeFile(join(target, 'AGENTS.md'), originalPolicy);
  const pluginConfigPath = join(target, 'extensions/subagent/config.json');
  if (client === 'pi') {
    await mkdir(join(target, 'extensions/subagent'), { recursive: true });
    await writeFile(pluginConfigPath, JSON.stringify({ globalConcurrencyLimit: 5, parallel: { concurrency: 4, maxTasks: 9 }, toolActivation: 'eager' }));
  }
  const pluginArgs = client === 'pi' ? ['--pi-subagents-dir', join(repo, 'node_modules/pi-subagents')] : [];
  const command = (...args) => spawnSync('bash', [join(repo, 'scripts/install.sh'), '--client', client, '--config', configPath, '--agent-dir', target, ...pluginArgs, ...args], {
    cwd: repo,
    env: { ...process.env, HOME: root, XDG_STATE_HOME: join(root, 'state'), PI_CODING_AGENT_DIR: target },
    encoding: 'utf8', timeout: 30000,
  });
  const run = (...args) => {
    const result = command(...args);
    assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
    return result;
  };
  const readSettings = async () => YAML.parse(await readFile(settingsPath, 'utf8'));
  const writeSettings = (value) => writeFile(settingsPath, client === 'omp' ? YAML.stringify(value) : JSON.stringify(value, null, 2));
  const manifestPath = async () => {
    const base = join(root, 'state/agent-config');
    const [id] = await readdir(base);
    return join(base, id, 'manifest.json');
  };
  const exists = async (file) => { try { await stat(file); return true; } catch { return false; } };
  return {
    root, realRoot: await realpath(root), target, realTarget: await realpath(target),
    config, configPath, settingsPath, initial, originalPolicy, command, run, readSettings, writeSettings,
    pluginConfigPath, manifestPath, exists,
  };
}


for (const client of ['omp', 'pi']) {
  test(`${client}: install, reconfigure, and uninstall preserve user policy and unrelated settings`, async (t) => {
    const f = await fixture(t, client);
    f.run();
    let policy = await readFile(join(f.target, 'AGENTS.md'), 'utf8');
    assert.ok(policy.includes(f.originalPolicy.trim()));
    assert.ok(policy.includes('Test orchestrator'));
    let settings = await f.readSettings();
    assert.deepEqual(settings.custom, f.initial.custom);
    if (client === 'omp') {
      assert.deepEqual(settings.modelRoles, f.initial.modelRoles);
      // The operator already routed this native role; the native sentinel must not touch that routing.
      assert.equal(settings.task.agentModelOverrides.task, 'example/old-task:low');
      assert.equal(settings.task.agentModelOverrides.independent, 'example/independent:high');
      assert.equal(settings.task.maxConcurrency, 2);
      assert.ok(settings.extensions.includes('original-extension'));
      assert.ok(settings.extensions.includes(join(f.realTarget, 'extensions/agent-config')));
      assert.ok(await f.exists(join(f.target, 'extensions/agent-config/agents/deep.md')));
      assert.equal(await f.exists(join(f.target, 'extensions/agent-config/agents/task.md')), false);
      assert.equal(await f.exists(join(f.target, 'agents/task.md')), false);
    } else {
      assert.equal(settings.defaultModel, 'main');
      assert.equal(settings.defaultThinkingLevel, 'high');
      assert.ok(await f.exists(join(f.target, 'agents/task.md')));
      assert.ok(await f.exists(join(f.target, 'agents/deep.md')));
      const plugin = JSON.parse(await readFile(f.pluginConfigPath, 'utf8'));
      assert.equal(plugin.globalConcurrencyLimit, 2);
      assert.equal(plugin.parallel.concurrency, 2);
      assert.equal(plugin.parallel.maxTasks, 9);
      plugin.artifactDir = 'session';
      await writeFile(f.pluginConfigPath, JSON.stringify(plugin));
    }
    settings.custom.afterInstall = 'keep this';
    if (client === 'omp') settings.extensions.push('user-added-extension');
    await f.writeSettings(settings);
    await writeFile(join(f.target, 'AGENTS.md'), policy + '\nUser added this later.\n');
    f.run();
    policy = await readFile(join(f.target, 'AGENTS.md'), 'utf8');
    assert.ok(policy.includes('User added this later.'));
    assert.equal(policy.match(/# Test orchestrator/g)?.length, 1);
    f.run('--uninstall');
    policy = await readFile(join(f.target, 'AGENTS.md'), 'utf8');
    assert.ok(policy.includes(f.originalPolicy.trim()));
    assert.ok(policy.includes('User added this later.'));
    assert.ok(!policy.includes('Test orchestrator'));
    settings = await f.readSettings();
    assert.equal(settings.custom.afterInstall, 'keep this');
    if (client === 'omp') {
      assert.equal(settings.task.agentModelOverrides.task, 'example/old-task:low');
      assert.deepEqual(settings.extensions, ['original-extension', 'user-added-extension']);
      assert.equal(await f.exists(join(f.target, 'extensions/agent-config/agents/deep.md')), false);
    } else {
      assert.equal(settings.defaultModel, 'main');
      const plugin = JSON.parse(await readFile(f.pluginConfigPath, 'utf8'));
      assert.deepEqual(plugin, { globalConcurrencyLimit: 5, parallel: { concurrency: 4, maxTasks: 9 }, toolActivation: 'eager', artifactDir: 'session' });
      assert.equal(await f.exists(join(f.target, 'agents/task.md')), false);
      assert.equal(await f.exists(join(f.target, 'agents/deep.md')), false);
    }
  });

  test(`${client}: dry-run and invalid configuration do not change existing files`, async (t) => {
    const f = await fixture(t, client);
    const beforeSettings = await readFile(f.settingsPath, 'utf8');
    const beforeEntries = await readdir(f.target);
    f.run('--dry-run');
    assert.equal(await readFile(f.settingsPath, 'utf8'), beforeSettings);
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
    assert.deepEqual(await readdir(f.target), beforeEntries);
    f.config.agents.deep.definition = 'missing.md';
    await writeFile(f.configPath, YAML.stringify(f.config));
    const rejected = f.command();
    assert.notEqual(rejected.status, 0);
    assert.equal(await readFile(f.settingsPath, 'utf8'), beforeSettings);
    assert.deepEqual(await readdir(f.target), beforeEntries);
  });
}

test('version 1 configuration is rejected with migration guidance', async (t) => {
  for (const client of ['omp', 'pi']) {
    const f = await fixture(t, client);
    const beforeEntries = (await readdir(f.target)).sort();
    f.config.version = 1;
    await writeFile(f.configPath, YAML.stringify(f.config));
    const result = f.command();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /version/i);
    assert.equal(await readFile(f.settingsPath, 'utf8'), client === 'omp' ? YAML.stringify(f.initial) : JSON.stringify(f.initial, null, 2));
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
    assert.deepEqual((await readdir(f.target)).sort(), beforeEntries);
  }
});

test('OMP native roles install no replacement definition and register no extension root', async (t) => {
  const f = await fixture(t, 'omp');
  delete f.config.agents.deep;
  // A native OMP name such as seance stays untouched rather than getting a generated definition.
  f.config.agents.seance = {
    description: 'Native OMP seance', definition: 'worker.md',
    model: { omp: 'native', pi: 'inherit' }, effort: { omp: 'native', pi: 'inherit' }, tools: { pi: ['read'] },
  };
  await writeFile(f.configPath, YAML.stringify(f.config));
  f.run();
  assert.equal(await f.exists(join(f.target, 'extensions/agent-config')), false);
  assert.equal(await f.exists(join(f.target, 'agents/task.md')), false);
  assert.equal(await f.exists(join(f.target, 'agents/seance.md')), false);
  const settings = await f.readSettings();
  assert.deepEqual(settings.extensions, f.initial.extensions);
  assert.deepEqual(settings.task.agentModelOverrides, f.initial.task.agentModelOverrides);
  assert.equal(settings.task.maxConcurrency, 2);
  assert.deepEqual(settings.modelRoles, f.initial.modelRoles);
});

test('OMP explicit native model/effort binds the role and restores the previous routing on uninstall', async (t) => {
  const f = await fixture(t, 'omp');
  f.config.agents.task.model = { omp: 'example/native', pi: 'inherit' };
  f.config.agents.task.effort = { omp: 'xhigh', pi: 'inherit' };
  await writeFile(f.configPath, YAML.stringify(f.config));
  f.run();
  let settings = await f.readSettings();
  assert.equal(settings.task.agentModelOverrides.task, 'example/native:xhigh');
  assert.equal(settings.task.agentModelOverrides.independent, 'example/independent:high');
  f.run();
  settings = await f.readSettings();
  assert.equal(settings.task.agentModelOverrides.task, 'example/native:xhigh');
  f.run('--uninstall');
  settings = await f.readSettings();
  assert.equal(settings.task.agentModelOverrides.task, 'example/old-task:low');
  assert.equal(settings.task.agentModelOverrides.independent, 'example/independent:high');
  assert.deepEqual(settings.modelRoles, f.initial.modelRoles);
  assert.equal(settings.task.maxConcurrency, 9);
});

test('OMP rejects inherit routing and OMP-only fields on native roles', async (t) => {
  const f = await fixture(t, 'omp');
  const rejected = async (label, mutate) => {
    const config = structuredClone(f.config);
    mutate(config);
    await writeFile(f.configPath, YAML.stringify(config));
    const result = f.command('--dry-run');
    assert.notEqual(result.status, 0, `${label} must be rejected`);
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy, `${label} must not modify the target`);
  };
  await rejected('native inherit model/effort', (config) => {
    config.agents.task.model = { omp: 'inherit', pi: 'inherit' };
    config.agents.task.effort = { omp: 'inherit', pi: 'inherit' };
  });
  await rejected('native tools.omp', (config) => { config.agents.task.tools = { omp: ['read'], pi: ['read'] }; });
  await rejected('native spawns.omp', (config) => { config.agents.task.spawns = { omp: ['scout'] }; });
});

test('Pi rejects an explicitly configured seance while OMP keeps that native role unchanged', async (t) => {
  const f = await fixture(t, 'pi');
  f.config.agents.seance = {
    description: 'Native OMP seance', definition: 'worker.md',
    model: { omp: 'native', pi: 'inherit' }, effort: { omp: 'native', pi: 'inherit' }, tools: { pi: ['read'] },
  };
  await writeFile(f.configPath, YAML.stringify(f.config));
  const result = f.command('--dry-run');
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
  assert.equal(await f.exists(join(f.target, 'agents/seance.md')), false);
});

test('native sentinel is rejected for pi, custom roles, and main', async (t) => {
  const pi = await fixture(t, 'pi');
  const piConfig = structuredClone(pi.config);
  piConfig.agents.task.model = { omp: 'native', pi: 'native' };
  await writeFile(pi.configPath, YAML.stringify(piConfig));
  assert.notEqual(pi.command('--dry-run').status, 0);
  assert.equal(await readFile(join(pi.target, 'AGENTS.md'), 'utf8'), pi.originalPolicy);

  const omp = await fixture(t, 'omp');
  const custom = structuredClone(omp.config);
  custom.agents.deep.model = { omp: 'native', pi: 'inherit' };
  await writeFile(omp.configPath, YAML.stringify(custom));
  assert.notEqual(omp.command('--dry-run').status, 0);

  const main = structuredClone(omp.config);
  main.agents.orchestrator.model = { omp: 'native', pi: 'inherit' };
  await writeFile(omp.configPath, YAML.stringify(main));
  assert.notEqual(omp.command('--dry-run').status, 0);
  assert.equal(await readFile(join(omp.target, 'AGENTS.md'), 'utf8'), omp.originalPolicy);
});

test('OMP keeps disabled-role conflict detection and preserves unrelated disabled roles', async (t) => {
  const f = await fixture(t, 'omp');
  const settings = await f.readSettings();
  settings.task.disabledAgents = ['other-role'];
  await f.writeSettings(settings);
  f.run();
  assert.deepEqual((await f.readSettings()).task.disabledAgents, ['other-role']);

  const conflicting = await f.readSettings();
  conflicting.task.disabledAgents = ['other-role', 'deep'];
  await f.writeSettings(conflicting);
  const result = f.command('--dry-run');
  assert.notEqual(result.status, 0);
  assert.equal(await f.exists(join(f.target, 'extensions/agent-config/agents/deep.md')), true);
});

test('OMP reinstall retires a previously owned native replacement and restores forced runtime settings', async (t) => {
  const f = await fixture(t, 'omp');
  f.run();
  const manifestPath = await f.manifestPath();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.files ??= {};
  manifest.settings ??= { changes: [], containers: [] };
  manifest.settings.changes ??= [];
  manifest.settings.containers ??= [];
  const relative = 'extensions/agent-config/agents/task.md';
  const replacement = '---\nname: task\ntools: [read]\n---\n\nPrevious native replacement.\n';
  await mkdir(join(f.target, 'extensions/agent-config/agents'), { recursive: true });
  await writeFile(join(f.target, relative), replacement, { mode: 0o600 });
  manifest.files[relative] = { before: null, installed: { content: replacement, mode: 0o600 } };
  const forced = async (path, installed, before) => {
    const settings = await f.readSettings();
    let cursor = settings;
    for (const part of path.slice(0, -1)) cursor = cursor[part] ??= {};
    cursor[path.at(-1)] = installed;
    await f.writeSettings(settings);
    manifest.settings.changes.push({ path, installed: { exists: true, value: installed }, before });
    for (let length = 1; length < path.length; length++) {
      const prefix = path.slice(0, length);
      if (!manifest.settings.containers.some(item => JSON.stringify(item) === JSON.stringify(prefix))) manifest.settings.containers.push(prefix);
    }
  };
  await forced(['task', 'batch'], true, { exists: false });
  await forced(['task', 'maxRecursionDepth'], 1, { exists: true, value: 3 });
  await forced(['task', 'enableEffort'], false, { exists: false });
  await forced(['async', 'enabled'], true, { exists: false });
  await forced(['task', 'agentPrewalk', 'task'], 'off', { exists: false });
  await forced(['task', 'agentModelOverrides', 'task'], 'example/forced:medium', { exists: true, value: 'example/old-task:low' });
  await writeFile(manifestPath, JSON.stringify(manifest));
  f.run();
  assert.equal(await f.exists(join(f.target, relative)), false);
  const settings = await f.readSettings();
  assert.equal(own(settings.task, 'batch'), false);
  assert.equal(own(settings.task, 'enableEffort'), false);
  assert.equal(settings.task.maxRecursionDepth, 3);
  assert.equal(own(settings.async ?? {}, 'enabled'), false);
  assert.equal(own(settings.task.agentPrewalk ?? {}, 'task'), false);
  assert.equal(settings.task.maxConcurrency, 2);
  assert.deepEqual(settings.modelRoles, f.initial.modelRoles);
  assert.equal(settings.task.agentModelOverrides.task, 'example/old-task:low');
  assert.deepEqual(settings.task.agentAccountPools, f.initial.task.agentAccountPools);
  assert.deepEqual(settings.task.agentServiceTierOverrides, f.initial.task.agentServiceTierOverrides);
  f.run('--uninstall');
  assert.equal(await f.exists(join(f.target, relative)), false);
  assert.equal((await f.readSettings()).task.maxRecursionDepth, 3);
});

test('Uninstall refuses a modified generated role instead of losing user edits', async (t) => {
  const f = await fixture(t, 'omp');
  f.run();
  const rolePath = join(f.target, 'extensions/agent-config/agents/deep.md');
  const edited = (await readFile(rolePath, 'utf8')) + '\nMy manual role change.\n';
  await writeFile(rolePath, edited);
  const result = f.command('--uninstall');
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(rolePath, 'utf8'), edited);
  assert.ok((await readFile(join(f.target, 'AGENTS.md'), 'utf8')).includes('Test orchestrator'));
});

test('Install refuses to overwrite an unknown custom-role file', async (t) => {
  const f = await fixture(t, 'omp');
  const foreign = join(f.target, 'extensions/agent-config/agents/deep.md');
  await mkdir(join(f.target, 'extensions/agent-config/agents'), { recursive: true });
  await writeFile(foreign, '# User-authored local role\n');
  const result = f.command();
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(foreign, 'utf8'), '# User-authored local role\n');
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
});


test('Pi rejects a missing child extension before changing an existing installation', async (t) => {
  const f = await fixture(t, 'pi');
  f.run();
  const rolePath = join(f.target, 'agents/deep.md');
  const before = await readFile(rolePath, 'utf8');
  const settingsBefore = await readFile(f.settingsPath, 'utf8');
  f.config.agents.deep.extensions = { pi: ['absent-extension.ts'] };
  await writeFile(f.configPath, YAML.stringify(f.config));
  assert.notEqual(f.command().status, 0);
  assert.equal(await readFile(rolePath, 'utf8'), before);
  assert.equal(await readFile(f.settingsPath, 'utf8'), settingsBefore);
});

test('OMP preserves an independently owned external upstream directory', async (t) => {
  const f = await fixture(t, 'omp');
  const external = join(f.root, 'personal-upstream');
  await mkdir(external);
  await writeFile(join(external, 'personal.txt'), 'Do not touch this.');
  await symlink(external, join(f.target, 'upstream'));
  f.run('--dry-run');
  f.run();
  f.run('--uninstall');
  assert.equal(await readlink(join(f.target, 'upstream')), external);
  assert.equal(await readFile(join(external, 'personal.txt'), 'utf8'), 'Do not touch this.');
});

test('Pi can remove every worker while retaining the orchestrator and user settings', async (t) => {
  const f = await fixture(t, 'pi');
  f.run();
  delete f.config.agents.task;
  delete f.config.agents.deep;
  await writeFile(f.configPath, YAML.stringify(f.config));
  f.run();
  assert.ok((await readFile(join(f.target, 'AGENTS.md'), 'utf8')).includes('Test orchestrator'));
  await assert.rejects(readFile(join(f.target, 'agents/task.md')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(f.target, 'agents/deep.md')), { code: 'ENOENT' });
  assert.deepEqual((await f.readSettings()).custom, f.initial.custom);
  f.run('--uninstall');
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
});

test('Pi refuses missing plugin and keeps user configuration untouched', async (t) => {
  const f = await fixture(t, 'pi');
  const before = await readFile(f.pluginConfigPath, 'utf8');
  const result = f.command('--pi-subagents-dir', join(f.root, 'not-installed'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pi install npm:pi-subagents/);
  assert.equal(await readFile(f.pluginConfigPath, 'utf8'), before);
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
});

test('Pi refuses role overrides that would silently replace the YAML model', async (t) => {
  const f = await fixture(t, 'pi');
  const settings = await f.readSettings();
  settings.subagents = { agentOverrides: { task: { model: 'another/model' } } };
  await f.writeSettings(settings);
  const result = f.command();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /agentOverrides.task/);
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
  assert.deepEqual((await f.readSettings()).subagents, settings.subagents);
});

test('Pi rejects a global thinking default when parent effort inheritance was requested', async (t) => {
  const f = await fixture(t, 'pi');
  const settings = await f.readSettings();
  settings.subagents = { defaultThinking: 'low' };
  await f.writeSettings(settings);
  const result = f.command();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /effort=inherit conflicts/);
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
});

test('Pi cutover removes the old managed runner without modifying the native plugin', async (t) => {
  const f = await fixture(t, 'pi');
  f.run();
  const manifestPath = await f.manifestPath();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  // The previous release stored these exact relative paths with version-1 ownership records.
  for (const relative of ['extensions/agent-config/index.ts', 'extensions/agent-config/config.json']) {
    const content = relative.endsWith('.json') ? '{"version":1,"agents":[]}' : '// previous managed runner\n';
    await mkdir(join(f.target, 'extensions/agent-config'), { recursive: true });
    await writeFile(join(f.target, relative), content, { mode: 0o600 });
    manifest.files[relative] = { before: null, installed: { content, mode: 0o600 } };
  }
  await writeFile(manifestPath, JSON.stringify(manifest));
  const nativeConfig = await readFile(f.pluginConfigPath, 'utf8');
  f.run();
  await assert.rejects(readFile(join(f.target, 'extensions/agent-config/index.ts')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(f.target, 'extensions/agent-config/config.json')), { code: 'ENOENT' });
  assert.equal(await readFile(f.pluginConfigPath, 'utf8'), nativeConfig);
  f.run('--uninstall');
  await assert.rejects(readFile(join(f.target, 'extensions/agent-config/index.ts')), { code: 'ENOENT' });
});

test('explicit main startup selection is managed and restored for both clients', async (t) => {
  for (const client of ['omp', 'pi']) {
    const f = await fixture(t, client);
    const initial = await f.readSettings();
    if (client === 'omp') initial.modelRoles.default = 'example/old-main:low';
    else Object.assign(initial, { defaultModel: 'old-main', defaultThinkingLevel: 'low' });
    await f.writeSettings(initial);
    f.config.agents.orchestrator.model = { omp: 'example/main', pi: 'example/main' };
    f.config.agents.orchestrator.effort = { omp: 'high', pi: 'high' };
    await writeFile(f.configPath, YAML.stringify(f.config));
    f.run();
    let settings = await f.readSettings();
    if (client === 'omp') {
      assert.equal(settings.modelRoles.default, 'example/main:high');
      assert.equal(settings.modelRoles.unrelated, 'example/other:low');
      assert.equal(settings.defaultThinkingLevel, 'high');
    } else {
      assert.equal(settings.defaultProvider, 'example');
      assert.equal(settings.defaultModel, 'main');
      assert.equal(settings.defaultThinkingLevel, 'high');
    }
    f.run('--uninstall');
    settings = await f.readSettings();
    if (client === 'omp') {
      assert.equal(settings.modelRoles.default, 'example/old-main:low');
      assert.equal(own(settings, 'defaultThinkingLevel'), false);
    } else {
      assert.equal(settings.defaultModel, 'old-main');
      assert.equal(settings.defaultThinkingLevel, 'low');
    }

    const mixed = structuredClone(f.config);
    mixed.agents.orchestrator.effort = { omp: 'inherit', pi: 'inherit' };
    await writeFile(f.configPath, YAML.stringify(mixed));
    assert.notEqual(f.command('--dry-run').status, 0);
  }
});
