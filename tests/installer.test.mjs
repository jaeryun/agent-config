import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink, readlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const repo = fileURLToPath(new URL('../', import.meta.url));

async function fixture(t, client) {
  const root = await mkdtemp(join(tmpdir(), 'agent-config-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'agent');
  await mkdir(target);
  await writeFile(join(root, 'main.md'), '# Test orchestrator\nPreserve user work.\n');
  await writeFile(join(root, 'worker.md'), '# Test worker\nDeliver the assigned change.\n');
  const config = {
    version: 1,
    concurrency: 2,
    agents: {
      orchestrator: { description: 'Coordinate', definition: 'main.md', model: 'inherit', effort: 'inherit' },
      task: { description: 'Implement', definition: 'worker.md', model: 'inherit', effort: { omp: 'medium', pi: 'inherit' }, tools: { omp: ['read'], pi: ['read'] } },
    },
  };
  const configPath = join(root, 'config.local.yaml');
  await writeFile(configPath, YAML.stringify(config));
  const settingsPath = join(target, client === 'omp' ? 'config.yml' : 'settings.json');
  const initial = client === 'omp'
    ? { modelRoles: { default: 'example/main:high', unrelated: 'example/other:low' }, task: { agentModelOverrides: { task: 'example/old:low', independent: 'example/custom:high' } }, extensions: ['original-extension'], custom: { preserve: true } }
    : { defaultProvider: 'example', defaultModel: 'main', defaultThinkingLevel: 'high', custom: { preserve: true } };
  await writeFile(settingsPath, client === 'omp' ? YAML.stringify(initial) : JSON.stringify(initial, null, 2));
  const originalPolicy = '# Personal instructions\nNever edit my private notes.\n';
  await writeFile(join(target, 'AGENTS.md'), originalPolicy);
  const command = (...args) => spawnSync('bash', [join(repo, 'scripts/install.sh'), '--client', client, '--config', configPath, '--agent-dir', target, ...args], {
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
  return { root, target, config, configPath, settingsPath, initial, originalPolicy, command, run, readSettings, writeSettings };
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
      assert.equal(settings.task.agentModelOverrides.independent, 'example/custom:high');
      assert.notEqual(settings.task.agentModelOverrides.task, 'example/old:low');
    } else {
      assert.equal(settings.defaultModel, 'main');
      assert.equal(settings.defaultThinkingLevel, 'high');
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
      assert.equal(settings.task.agentModelOverrides.task, 'example/old:low');
      assert.deepEqual(settings.extensions, ['original-extension', 'user-added-extension']);
    } else assert.equal(settings.defaultModel, 'main');
  });

  test(`${client}: dry-run and invalid configuration do not change existing files`, async (t) => {
    const f = await fixture(t, client);
    const beforeSettings = await readFile(f.settingsPath, 'utf8');
    const beforeEntries = await readdir(f.target);
    f.run('--dry-run');
    assert.equal(await readFile(f.settingsPath, 'utf8'), beforeSettings);
    assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
    assert.deepEqual(await readdir(f.target), beforeEntries);
    f.config.agents.task.definition = 'missing.md';
    await writeFile(f.configPath, YAML.stringify(f.config));
    const rejected = f.command();
    assert.notEqual(rejected.status, 0);
    assert.equal(await readFile(f.settingsPath, 'utf8'), beforeSettings);
    assert.deepEqual(await readdir(f.target), beforeEntries);
  });
}

test('OMP rejects live-parent worker effort inheritance rather than silently changing it', async (t) => {
  const f = await fixture(t, 'omp');
  f.config.agents.task.effort = 'inherit';
  await writeFile(f.configPath, YAML.stringify(f.config));
  const result = f.command('--dry-run');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /effort|thinking/i);
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
});

test('Uninstall refuses a modified generated role instead of losing user edits', async (t) => {
  const f = await fixture(t, 'omp');
  f.run();
  const rolePath = join(f.target, 'extensions/agent-config/agents/task.md');
  const edited = (await readFile(rolePath, 'utf8')) + '\nMy manual role change.\n';
  await writeFile(rolePath, edited);
  const result = f.command('--uninstall');
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(rolePath, 'utf8'), edited);
  assert.ok((await readFile(join(f.target, 'AGENTS.md'), 'utf8')).includes('Test orchestrator'));
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
  await writeFile(f.configPath, YAML.stringify(f.config));
  f.run();
  assert.ok((await readFile(join(f.target, 'AGENTS.md'), 'utf8')).includes('Test orchestrator'));
  await assert.rejects(readFile(join(f.target, 'extensions/agent-config/index.ts')), { code: 'ENOENT' });
  assert.deepEqual((await f.readSettings()).custom, f.initial.custom);
  f.run('--uninstall');
  assert.equal(await readFile(join(f.target, 'AGENTS.md'), 'utf8'), f.originalPolicy);
});
