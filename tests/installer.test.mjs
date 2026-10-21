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
// OMP's built-in model role ids; the installer hides all of them from the selector.
const BUILTIN_ROLES = ['default', 'smol', 'slow', 'vision', 'plan', 'commit', 'tiny', 'memory', 'task', 'advisor', 'image', 'web', 'speech', 'dictation', 'judge'];

// Config v3: the orchestrator carries an ordered list of main model/effort choices and every worker
// names an exact provider/model plus a concrete effort. Native OMP names (task, sonic, scout,
// reviewer, security-reviewer, seance) keep the OMP definition and only map the pi side.
// OMP can repeat one model with different efforts (each choice gets its own role key); Pi 1.3.0
// scopes the main list by model identity, so its fixture uses distinct models.
const mainChoices = client => {
  const first = { model: { omp: 'example/main', pi: 'example/main' }, effort: { omp: 'high', pi: 'high' } };
  return client === 'omp'
    ? [first, { model: 'example/alt', effort: 'medium' }, { model: 'example/alt', effort: 'low' }]
    : [first, { model: 'example/alt', effort: 'medium' }];
};
const choiceModel = (choice, client) => typeof choice.model === 'string' ? choice.model : choice.model[client];
const choiceEffort = (choice, client) => typeof choice.effort === 'string' ? choice.effort : choice.effort[client];
const slots = client => mainChoices(client).map(choice => `${choiceModel(choice, client)} [${choiceEffort(choice, client)}]`);

async function fixture(t, client) {
  const root = await mkdtemp(join(tmpdir(), 'agent-config-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'agent');
  await mkdir(target);
  await writeFile(join(root, 'main.md'), '# Test orchestrator\nPreserve user work.\n');
  await writeFile(join(root, 'worker.md'), '# Test worker\nDeliver the assigned change.\n');
  await writeFile(join(root, 'custom.md'), '# Custom worker\nHandle the assignment end to end.\n');
  const config = {
    version: 3,
    concurrency: 2,
    agents: {
      orchestrator: { description: 'Coordinate', definition: 'main.md', models: mainChoices(client) },
      task: {
        description: 'Implement',
        definition: 'worker.md',
        model: { omp: 'example/task', pi: 'example/task' },
        effort: { omp: 'high', pi: 'high' },
        tools: { pi: ['read', 'bash'] },
      },
      deep: {
        description: 'Custom depth',
        definition: 'custom.md',
        model: 'example/deep',
        effort: { omp: 'medium', pi: 'low' },
        tools: { omp: ['read'], pi: ['read'] },
      },
    },
  };
  const configPath = join(root, 'config.local.yaml');
  await writeFile(configPath, YAML.stringify(config));
  const settingsPath = join(target, client === 'omp' ? 'config.yml' : 'settings.json');
  const initial = client === 'omp'
    ? {
        modelRoles: { default: 'example/old-main:low', slow: 'example/old-slow:high', unrelated: 'example/other:low' },
        cycleOrder: ['default', 'slow', 'unrelated'],
        modelTags: { unrelated: { name: 'Unrelated label' } },
        defaultThinkingLevel: 'low',
        task: {
          agentModelOverrides: { task: 'example/old-task:low', independent: 'example/independent:high' },
          maxConcurrency: 9,
          agentAccountPools: { task: { example: ['account-kept'] } },
          agentServiceTierOverrides: { task: 'priority' },
        },
        extensions: ['original-extension'],
        custom: { preserve: true },
      }
    : {
        defaultProvider: 'old',
        defaultModel: 'legacy-main',
        defaultThinkingLevel: 'low',
        enabledModels: ['old/legacy-main:low'],
        custom: { preserve: true },
      };
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
  const readSettings = async () => client === 'omp' ? YAML.parse(await readFile(settingsPath, 'utf8')) : JSON.parse(await readFile(settingsPath, 'utf8'));
  const writeSettings = (value) => writeFile(settingsPath, client === 'omp' ? YAML.stringify(value) : JSON.stringify(value, null, 2));
  const writeConfig = (value) => writeFile(configPath, YAML.stringify(value));
  const manifestPath = async () => {
    const base = join(root, 'state/agent-config');
    const [id] = await readdir(base);
    return join(base, id, 'manifest.json');
  };
  const exists = async (file) => { try { await stat(file); return true; } catch { return false; } };
  return {
    root, realRoot: await realpath(root), target, realTarget: await realpath(target),
    config, configPath, settingsPath, initial, originalPolicy, command, run, readSettings, writeSettings, writeConfig,
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
      // The first main choice is the hidden startup role; the other choices are readable cycle slots.
      assert.deepEqual(settings.modelRoles, {
        default: 'example/main:high',
        unrelated: 'example/other:low',
        'example/main [high]': 'example/main:high',
        'example/alt [medium]': 'example/alt:medium',
        'example/alt [low]': 'example/alt:low',
      });
      assert.deepEqual(settings.cycleOrder, slots('omp'));
      assert.equal(settings.defaultThinkingLevel, 'high');
      // Every built-in role is hidden from the selector, and each readable slot stays visible.
      for (const role of BUILTIN_ROLES) assert.equal(settings.modelTags[role]?.hidden, true, `builtin role ${role} must be hidden`);
      assert.deepEqual(settings.modelTags['example/main [high]'], { name: 'example/main [high]', hidden: false });
      assert.deepEqual(settings.modelTags.unrelated, { name: 'Unrelated label' });
      // Workers carry their YAML assignment; unrelated overrides are untouched, and OMP enabledModels
      // stays unset so worker models outside the main pool stay selectable.
      assert.deepEqual(settings.task.agentModelOverrides, {
        task: 'example/task:high',
        deep: 'example/deep:medium',
        independent: 'example/independent:high',
      });
      assert.equal(own(settings, 'enabledModels'), false);
      assert.equal(settings.task.maxConcurrency, 2);
      assert.ok(settings.extensions.includes('original-extension'));
      assert.ok(settings.extensions.includes(join(f.realTarget, 'extensions/agent-config')));
      assert.ok(await f.exists(join(f.target, 'extensions/agent-config/agents/deep.md')));
      assert.equal(await f.exists(join(f.target, 'extensions/agent-config/agents/task.md')), false);
      assert.equal(await f.exists(join(f.target, 'agents/task.md')), false);
    } else {
      assert.equal(settings.defaultProvider, 'example');
      assert.equal(settings.defaultModel, 'main');
      assert.equal(settings.defaultThinkingLevel, 'high');
      assert.deepEqual(settings.enabledModels, ['example/main:high', 'example/alt:medium']);
      assert.ok(await f.exists(join(f.target, 'agents/task.md')));
      assert.ok(await f.exists(join(f.target, 'agents/deep.md')));
      const deep = await readFile(join(f.target, 'agents/deep.md'), 'utf8');
      const frontmatter = YAML.parse(deep.slice(4, deep.indexOf('\n---', 4)));
      assert.equal(frontmatter.model, 'example/deep');
      assert.equal(frontmatter.thinking, 'low');
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
      assert.deepEqual(settings.modelRoles, f.initial.modelRoles);
      assert.deepEqual(settings.modelTags ?? {}, f.initial.modelTags);
      assert.deepEqual(settings.cycleOrder, f.initial.cycleOrder);
      assert.equal(settings.defaultThinkingLevel, f.initial.defaultThinkingLevel);
      assert.equal(settings.task.agentModelOverrides.task, 'example/old-task:low');
      assert.equal(settings.task.agentModelOverrides.independent, 'example/independent:high');
      assert.equal(settings.task.maxConcurrency, 9);
      assert.deepEqual(settings.extensions, ['original-extension', 'user-added-extension']);
      assert.equal(await f.exists(join(f.target, 'extensions/agent-config/agents/deep.md')), false);
    } else {
      assert.equal(settings.defaultProvider, 'old');
      assert.equal(settings.defaultModel, 'legacy-main');
      assert.equal(settings.defaultThinkingLevel, 'low');
      assert.deepEqual(settings.enabledModels, ['old/legacy-main:low']);
      const plugin = JSON.parse(await readFile(f.pluginConfigPath, 'utf8'));
      assert.deepEqual(plugin, { globalConcurrencyLimit: 5, parallel: { concurrency: 4, maxTasks: 9 }, toolActivation: 'eager', artifactDir: 'session' });
      assert.equal(await f.exists(join(f.target, 'agents/task.md')), false);
      assert.equal(await f.exists(join(f.target, 'agents/deep.md')), false);
    }
  });

  test(`${client}: dry-run and invalid configuration do not change existing files`, async (t) => {
    const f = await fixture(t, client);
    const beforeSettings = await readFile(f.settingsPath, 'utf8');
    const beforeEntries = (await readdir(f.target)).sort();
    f.run('--dry-run');
    assert.equal(await readFile(f.settingsPath, 'utf8'), beforeSettings);
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
    assert.deepEqual((await readdir(f.target)).sort(), beforeEntries);
    f.config.agents.deep.definition = 'missing.md';
    await f.writeConfig(f.config);
    const rejected = f.command();
    assert.notEqual(rejected.status, 0);
    assert.equal(await readFile(f.settingsPath, 'utf8'), beforeSettings);
    assert.deepEqual((await readdir(f.target)).sort(), beforeEntries);
  });
}

test('version 2 configuration is rejected with v3 migration guidance', async (t) => {
  for (const client of ['omp', 'pi']) {
    const f = await fixture(t, client);
    const beforeEntries = (await readdir(f.target)).sort();
    f.config.version = 2;
    await f.writeConfig(f.config);
    const result = f.command();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /version/i);
    assert.equal(await readFile(f.settingsPath, 'utf8'), client === 'omp' ? YAML.stringify(f.initial) : JSON.stringify(f.initial, null, 2));
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
    assert.deepEqual((await readdir(f.target)).sort(), beforeEntries);
  }
});

test('orchestrator main choices are an ordered nonempty list and replace model/effort', async (t) => {
  const f = await fixture(t, 'omp');
  const rejected = async (label, mutate) => {
    const config = structuredClone(f.config);
    mutate(config);
    await f.writeConfig(config);
    const result = f.command('--dry-run');
    assert.notEqual(result.status, 0, `${label} must be rejected`);
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy, `${label} must not modify the target`);
  };
  await rejected('legacy model/effort pair', (config) => {
    config.agents.orchestrator = { description: 'Coordinate', definition: 'main.md', model: 'example/main', effort: 'high' };
  });
  await rejected('legacy pair next to models', (config) => { config.agents.orchestrator.effort = 'high'; });
  await rejected('missing models', (config) => { delete config.agents.orchestrator.models; });
  await rejected('empty models', (config) => { config.agents.orchestrator.models = []; });
  await rejected('models entry without effort', (config) => { config.agents.orchestrator.models = [{ model: 'example/main' }]; });
  await rejected('orchestrator tools', (config) => { config.agents.orchestrator.tools = { omp: ['read'] }; });
});

test('worker and main assignments reject inherit, native, aliases, globs and effort suffixes', async (t) => {
  for (const client of ['omp', 'pi']) {
    const f = await fixture(t, client);
    const rejected = async (label, mutate) => {
      const config = structuredClone(f.config);
      mutate(config, client);
      await f.writeConfig(config);
      const result = f.command('--dry-run');
      assert.notEqual(result.status, 0, `${label} (${client}) must be rejected`);
      assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy, `${label} (${client}) must not modify the target`);
    };
    await rejected('worker inherits the parent model', (config, target) => { config.agents.deep.model = { omp: 'inherit', pi: 'inherit' }; });
    await rejected('worker uses the native sentinel', (config) => { config.agents.deep.model = { omp: 'native', pi: 'native' }; });
    await rejected('worker uses an alias model', (config) => { config.agents.deep.model = '@task'; });
    await rejected('worker uses the portability role alias', (config) => { config.agents.deep.model = 'pi/slow'; });
    await rejected('worker uses a glob model', (config) => { config.agents.deep.model = 'example/*'; });
    await rejected('worker model carries an effort suffix', (config) => { config.agents.deep.model = 'example/deep:high'; });
    await rejected('worker inherits effort', (config) => { config.agents.deep.effort = { omp: 'inherit', pi: 'inherit' }; });
    await rejected('worker effort is unsupported', (config) => { config.agents.deep.effort = { omp: 'turbo', pi: 'turbo' }; });
    await rejected('main choice inherits', (config, target) => { config.agents.orchestrator.models[0].model = { omp: 'inherit', pi: 'inherit' }; });
    await rejected('main choice uses the native sentinel', (config) => { config.agents.orchestrator.models[0].model = { omp: 'native', pi: 'native' }; });
    await rejected('main choice uses an alias', (config) => { config.agents.orchestrator.models[1].model = '@deep'; });
    await rejected('main choice uses the portability role alias', (config) => { config.agents.orchestrator.models[1].model = 'pi/review'; });
    await rejected('main choice inherits effort', (config) => { config.agents.orchestrator.models[1].effort = { omp: 'inherit', pi: 'inherit' }; });
    await rejected('main choice model carries an effort suffix', (config) => { config.agents.orchestrator.models[1].model = 'example/alt:low'; });
    await rejected('per-client mapping misses the target client', (config, target) => { config.agents.deep.model = target === 'pi' ? { omp: 'example/deep' } : { pi: 'example/deep' }; });
  }
});

test('duplicate main choices are rejected, but OMP may repeat one model with different efforts', async (t) => {
  const omp = await fixture(t, 'omp');
  const duplicate = structuredClone(omp.config);
  duplicate.agents.orchestrator.models.push({ model: 'example/main', effort: 'high' });
  await omp.writeConfig(duplicate);
  const repeated = omp.command('--dry-run');
  assert.notEqual(repeated.status, 0, 'the same model+effort pair must be rejected');
  assert.equal(await readFile(join(omp.target, 'AGENTS.md'), 'utf8'), omp.originalPolicy);

  await omp.writeConfig(omp.config);
  omp.run();
  const settings = await omp.readSettings();
  assert.deepEqual(settings.cycleOrder, slots('omp'));
  assert.equal(settings.modelRoles['example/alt [medium]'], 'example/alt:medium');
  assert.equal(settings.modelRoles['example/alt [low]'], 'example/alt:low');

  const pi = await fixture(t, 'pi');
  const piDuplicate = structuredClone(pi.config);
  piDuplicate.agents.orchestrator.models = [{ model: 'example/main', effort: 'high' }, { model: 'example/main', effort: 'low' }];
  await pi.writeConfig(piDuplicate);
  const result = pi.command('--dry-run');
  assert.notEqual(result.status, 0, 'Pi cannot hold one model twice in its main scope');
  assert.match(result.stderr, /example\/main/);
  assert.equal(await readFile(join(pi.target, 'AGENTS.md'), 'utf8'), pi.originalPolicy);
});

test('OMP builtin names keep their native definition while taking explicit YAML assignments', async (t) => {
  const f = await fixture(t, 'omp');
  delete f.config.agents.deep;
  f.config.agents.seance = {
    description: 'Native OMP seance', definition: 'worker.md',
    model: 'example/seance', effort: 'low', tools: { pi: ['read'] },
  };
  await f.writeConfig(f.config);
  f.run();
  assert.equal(await f.exists(join(f.target, 'extensions/agent-config')), false);
  assert.equal(await f.exists(join(f.target, 'agents/task.md')), false);
  assert.equal(await f.exists(join(f.target, 'agents/seance.md')), false);
  const settings = await f.readSettings();
  assert.deepEqual(settings.extensions, f.initial.extensions);
  assert.deepEqual(settings.task.agentModelOverrides, { task: 'example/task:high', seance: 'example/seance:low', independent: 'example/independent:high' });
  assert.equal(settings.task.maxConcurrency, 2);
  assert.equal(settings.modelRoles.default, 'example/main:high');

  const rejected = async (label, mutate) => {
    const config = structuredClone(f.config);
    mutate(config);
    await f.writeConfig(config);
    const result = f.command('--dry-run');
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /builtin/);
  };
  await rejected('builtin tools.omp override', (config) => { config.agents.task.tools = { omp: ['read'], pi: ['read'] }; });
  await rejected('builtin spawns.omp override', (config) => { config.agents.task.spawns = { omp: ['scout'] }; });
});

test('Pi rejects an explicitly configured seance while OMP keeps that native role unchanged', async (t) => {
  const f = await fixture(t, 'pi');
  f.config.agents.seance = {
    description: 'Native OMP seance', definition: 'worker.md', model: 'example/seance', effort: 'low', tools: { pi: ['read'] },
  };
  await f.writeConfig(f.config);
  const result = f.command('--dry-run');
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
  assert.equal(await f.exists(join(f.target, 'agents/seance.md')), false);
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

test('OMP removes obsolete builtin role allocations but keeps a mapping an alias consumer still needs', async (t) => {
  // Every role referenced by an unmanaged consumer must survive, including comma lists and native
  // thinking suffixes (`auto`/`inherit`), and retention must follow transitive alias chains.
  const dependent = await fixture(t, 'omp');
  const settings = await dependent.readSettings();
  settings.modelRoles = {
    default: 'example/old-main:low',
    slow: 'example/old-slow:high',
    deep: '@smol',
    smol: 'example/fast:low',
    review: 'example/review:high',
    task: 'example/task-model:high',
  };
  settings.task.agentModelOverrides['documentation-reviewer'] = '@deep, @task';
  settings.task.agentModelOverrides['release-notes'] = '@review:auto';
  await dependent.writeSettings(settings);
  dependent.run();
  const kept = await dependent.readSettings();
  assert.equal(kept.modelRoles.deep, '@smol');
  assert.equal(kept.modelRoles.smol, 'example/fast:low');
  assert.equal(kept.modelRoles.task, 'example/task-model:high');
  assert.equal(kept.modelRoles.review, 'example/review:high');
  for (const role of ['deep', 'smol', 'task', 'review']) assert.equal(kept.modelTags[role]?.hidden, true, `${role} must stay hidden`);
  assert.equal(own(kept.modelRoles, 'slow'), false);
  assert.equal(kept.task.agentModelOverrides['documentation-reviewer'], '@deep, @task');
  assert.equal(kept.task.agentModelOverrides['release-notes'], '@review:auto');
  assert.equal(kept.task.agentModelOverrides.task, 'example/task:high');
  assert.equal(kept.modelRoles.unrelated, undefined);

  // Without that consumer both mappings are obsolete: cleaned up now, restored on uninstall.
  const obsolete = await fixture(t, 'omp');
  const plain = await obsolete.readSettings();
  plain.modelRoles = { default: 'example/old-main:low', deep: '@smol', smol: 'example/fast:low' };
  await obsolete.writeSettings(plain);
  obsolete.run();
  const cleaned = await obsolete.readSettings();
  assert.equal(own(cleaned.modelRoles, 'deep'), false);
  assert.equal(own(cleaned.modelRoles, 'smol'), false);
  assert.equal(cleaned.modelRoles.default, 'example/main:high');
  obsolete.run('--uninstall');
  const restored = await obsolete.readSettings();
  assert.deepEqual(restored.modelRoles, plain.modelRoles);
});

test('OMP worker assignments stay fixed when the main choices change', async (t) => {
  const f = await fixture(t, 'omp');
  f.run();
  const before = await f.readSettings();
  const reordered = structuredClone(f.config);
  reordered.agents.orchestrator.models = [
    { model: 'example/alt', effort: 'low' },
    { model: { omp: 'example/main', pi: 'example/main' }, effort: { omp: 'high', pi: 'high' } },
  ];
  await f.writeConfig(reordered);
  f.run();
  const after = await f.readSettings();
  assert.deepEqual(after.task.agentModelOverrides, before.task.agentModelOverrides);
  assert.deepEqual(after.cycleOrder, ['example/alt [low]', 'example/main [high]']);
  assert.deepEqual(Object.keys(after.modelRoles).sort(), ['default', 'example/alt [low]', 'example/main [high]', 'unrelated']);
  assert.equal(after.modelRoles.default, 'example/alt:low');
  assert.equal(after.defaultThinkingLevel, 'low');
  f.run('--uninstall');
  assert.deepEqual((await f.readSettings()).modelRoles, f.initial.modelRoles);
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
  assert.equal(settings.modelRoles.default, 'example/main:high');
  assert.equal(settings.task.agentModelOverrides.task, 'example/task:high');
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
  await f.writeConfig(f.config);
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
  await f.writeConfig(f.config);
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

test('the first main choice is the managed startup default and uninstall restores the previous one', async (t) => {
  for (const client of ['omp', 'pi']) {
    const f = await fixture(t, client);
    f.run();
    const settings = await f.readSettings();
    if (client === 'omp') {
      assert.equal(settings.modelRoles.default, 'example/main:high');
      assert.equal(settings.defaultThinkingLevel, 'high');
      assert.deepEqual(settings.cycleOrder, slots('omp'));
    } else {
      assert.equal(settings.defaultProvider, 'example');
      assert.equal(settings.defaultModel, 'main');
      assert.equal(settings.defaultThinkingLevel, 'high');
      assert.deepEqual(settings.enabledModels, ['example/main:high', 'example/alt:medium']);
    }
    f.run('--uninstall');
    const restored = await f.readSettings();
    if (client === 'omp') {
      assert.equal(restored.modelRoles.default, 'example/old-main:low');
      assert.equal(restored.defaultThinkingLevel, 'low');
      assert.deepEqual(restored.cycleOrder, f.initial.cycleOrder);
    } else {
      assert.equal(restored.defaultProvider, 'old');
      assert.equal(restored.defaultModel, 'legacy-main');
      assert.equal(restored.defaultThinkingLevel, 'low');
      assert.deepEqual(restored.enabledModels, ['old/legacy-main:low']);
    }
  }
});
