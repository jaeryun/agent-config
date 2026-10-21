#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import * as JSONC from 'jsonc-parser';

process.umask(0o077);
const repo = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const BEGIN = '<!-- agent-config:begin -->';
const END = '<!-- agent-config:end -->';
const missing = { exists: false };
const OMP_BUILTINS = new Set(['task', 'sonic', 'scout', 'reviewer', 'security-reviewer', 'seance']);
// OMP's 15 built-in model role ids (packages/coding-agent/src/config/model-roles.ts), plus the
// alias roles the previous release of this repository created and now only preserves as dependencies.
const OMP_ROLES = ['default', 'smol', 'slow', 'vision', 'plan', 'commit', 'tiny', 'memory', 'task', 'advisor', 'image', 'web', 'speech', 'dictation', 'judge'];
const OMP_OBSOLETE_ROLES = ['deep', 'review'];
const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const fail = message => { throw new Error(message); };
const own = (object, key) => Object.hasOwn(object, key);
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
const hash = text => createHash('sha256').update(text).digest('hex');
const expand = value => path.resolve(value === '~' ? os.homedir() : value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value);
const stat = file => { try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
}
function fields(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unknown field ${label}.${key}`);
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) fail(`${label} must be a nonempty, trimmed string`);
  return value;
}
function yamlDocument(source, label) {
  const doc = YAML.parseDocument(source, { uniqueKeys: true, stringKeys: true });
  if (doc.errors.length || doc.warnings.length) fail(`Invalid YAML in ${label}: ${(doc.errors[0] ?? doc.warnings[0]).message}`);
  return doc;
}
function options() {
  const result = { config: path.join(repo, 'config.local.yaml'), dryRun: false, uninstall: false };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: scripts/install.sh --client omp|pi [--config PATH] [--agent-dir PATH] [--pi-subagents-dir PATH] [--dry-run] [--uninstall]\nNode >=22; run npm ci --omit=dev first. Config defaults to config.local.yaml (required for installation).\nPi workers require installed nicobailon/pi-subagents 0.79.x (>=0.79.1); no custom runner is installed.\nTarget: --agent-dir, then PI_CODING_AGENT_DIR, then ~/.<client>/agent.');
      process.exit(0);
    }
    if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--uninstall') result.uninstall = true;
    else if (['--client', '--config', '--agent-dir', '--pi-subagents-dir'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) fail(`${arg} requires a value`);
      result[arg === '--agent-dir' ? 'agentDir' : arg.slice(2)] = value;
    } else fail(`Unknown argument: ${arg}`);
  }
  if (!['omp', 'pi'].includes(result.client)) fail('--client omp|pi is required; the installer never guesses the client');
  if (result['pi-subagents-dir'] && result.client !== 'pi') fail('--pi-subagents-dir is only valid with --client pi');
  result.agentDir = expand(result.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), `.${result.client}`, 'agent'));
  result.config = expand(result.config);
  return result;
}
// Canonicalize only existing ancestors (e.g. macOS /tmp -> /private/tmp).
// Descendants of the chosen roots are separately checked and may not redirect.
function canonical(file) {
  const info = stat(file);
  if (info) return fs.realpathSync(file);
  return path.join(canonical(path.dirname(file)), path.basename(file));
}
function safeParents(file, root) {
  if (!inside(file, root)) fail(`Path escapes its managed root: ${file}`);
  if (canonical(root) !== root) fail(`Managed root or ancestor changed through a symlink: ${root}`);
  let current = root;
  for (const part of path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = stat(current);
    if (info && (!info.isDirectory() || info.isSymbolicLink())) fail(`Redirected or non-directory parent: ${current}`);
  }
  const info = stat(root);
  if (info && (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync(root) !== root)) fail(`Managed root changed or redirected: ${root}`);
}
function snapshot(file) {
  const info = stat(file);
  if (!info) return null;
  if (info.isSymbolicLink()) return { link: fs.readlinkSync(file) };
  if (!info.isFile()) fail(`Expected a regular file: ${file}`);
  return { content: fs.readFileSync(file, 'utf8'), mode: info.mode & 0o777 };
}
function sourceLink(snapshotValue, destination, expected) {
  return snapshotValue?.link !== undefined && path.resolve(path.dirname(destination), snapshotValue.link) === expected;
}
function readConfig(file, client, target) {
  if (!stat(file)) fail(`Configuration is required: ${file}. Create your private YAML from config.example.yaml; no example is installed automatically.`);
  const config = yamlDocument(fs.readFileSync(file, 'utf8'), file).toJS({ maxAliasCount: 0 });
  fields(config, ['version', 'concurrency', 'agents'], 'config');
  if (config.version !== 3) fail('config.version must be 3. Migrate the file: agents.orchestrator replaces model+effort with an ordered `models: [{model, effort}, ...]` list whose first entry is the startup default; every model must be an exact provider/model-id and every effort a concrete level (inherit/native/@alias/glob are rejected). The installer never rewrites your source YAML.');
  if (!Number.isSafeInteger(config.concurrency) || config.concurrency < 1) fail('config.concurrency must be a positive integer');
  object(config.agents, 'config.agents');
  if (!own(config.agents, 'orchestrator')) fail('config.agents.orchestrator is required');
  const base = fs.realpathSync(path.dirname(file));
  const result = [];
  for (const [name, agent] of Object.entries(config.agents)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || ['main', 'sub', '__proto__', 'constructor', 'prototype'].includes(name)) fail(`Unsafe agent name: ${name}`);
    const orchestrator = name === 'orchestrator';
    if (orchestrator && (own(agent, 'model') || own(agent, 'effort'))) {
      fail('agents.orchestrator must use models: [{model, effort}, ...]; version 3 replaced the single model/effort pair with an ordered choice list whose first entry is the startup default');
    }
    if (orchestrator && ['tools', 'spawns', 'extensions'].some(key => own(agent, key))) {
      fail('orchestrator tools/spawns/extensions are unsupported; these are worker-only mappings');
    }
    fields(agent, orchestrator ? ['description', 'definition', 'models'] : ['description', 'definition', 'model', 'effort', 'tools', 'spawns', 'extensions'], `agents.${name}`);
    const native = client === 'omp' && OMP_BUILTINS.has(name);
    if (client === 'pi' && name === 'seance') fail('seance requires the native OMP historical-session runtime and has no pi port; omit it from a configuration used for pi.');
    const description = text(agent.description, `${name}.description`);
    const definition = text(agent.definition, `${name}.definition`);
    if (path.isAbsolute(definition) || definition.split(/[\\/]/).includes('..')) fail(`${name}.definition must be a contained relative path without '..'`);
    const source = fs.realpathSync(path.resolve(base, definition));
    if (!inside(source, base) || inside(source, target)) fail(`Definition escapes config directory or overlaps target: ${definition}`);
    const prompt = fs.readFileSync(source, 'utf8').trim();
    if (!prompt || /^---(?:\r?\n|$)/.test(prompt) || prompt.includes(BEGIN) || prompt.includes(END)) fail(`${name}.definition must be nonempty neutral Markdown without frontmatter or installer markers`);
    // A model/effort field is a scalar or an explicit {omp, pi} mapping resolved for the target client.
    const clientValue = (key, bag, label) => {
      const value = bag[key];
      if (value === undefined) fail(`${label} is required`);
      if (typeof value === 'string') return text(value, label);
      fields(value, ['omp', 'pi'], label);
      for (const item of Object.values(value)) text(item, label);
      if (!own(value, client)) fail(`${label} must be a string or a {omp, pi} mapping that provides ${client}`);
      return text(value[client], `${label}.${client}`);
    };
    const exactModel = (value, label) => {
      const model = text(value, label);
      if (model === 'inherit') fail(`${label} must be an exact provider/model-id. Version 3 removed inherit: main cycling and worker assignments must name the model they use instead of following another one.`);
      if (model === 'native') fail(`${label} must be an exact provider/model-id. Version 3 removed the native model sentinel: an OMP builtin name keeps its native definition, tools and spawn policy, but takes an explicit model and effort here.`);
      if (model.startsWith('@')) fail(`${label} must be an exact provider/model-id, not an @alias`);
      if (model.startsWith('pi/')) fail(`${label} must name the concrete provider/model-id. \`pi/<role>\` is OMP's portability role alias (not a provider), so it is rejected like every other role alias.`);
      if (/[*?\[\]]/.test(model) || !/^[a-zA-Z0-9_-]+\/[^\s,]+$/.test(model) || /:(inherit|off|minimal|low|medium|high|xhigh|max|auto)$/.test(model)) {
        fail(`${label} must be an exact provider/model-id without an effort suffix, alias, or glob`);
      }
      return model;
    };
    const exactEffort = (value, label) => {
      const effort = text(value, label);
      if (effort === 'inherit' || effort === 'native') fail(`${label} must be a concrete effort (${LEVELS.join(', ')}); version 3 removed inherit/native efforts`);
      if (!LEVELS.includes(effort)) fail(`Unsupported ${label}: ${effort}. Use one of ${LEVELS.join(', ')}.`);
      return effort;
    };
    let models = null, model = null, effort = null;
    if (orchestrator) {
      if (!Array.isArray(agent.models) || !agent.models.length) fail('agents.orchestrator.models must be a nonempty ordered list of {model, effort} choices; the first entry is the startup default');
      models = agent.models.map((choice, index) => {
        const label = `agents.orchestrator.models[${index}]`;
        fields(choice, ['model', 'effort'], label);
        const chosenModel = exactModel(clientValue('model', choice, `${label}.model`), `${label}.model`);
        const chosenEffort = exactEffort(clientValue('effort', choice, `${label}.effort`), `${label}.effort`);
        return { model: chosenModel, effort: chosenEffort, label: `${chosenModel} [${chosenEffort}]` };
      });
      const seen = new Set();
      for (const choice of models) {
        const id = `${choice.model}\u0000${choice.effort}`;
        if (seen.has(id)) fail(`agents.orchestrator.models repeats the same model+effort choice: ${choice.label}. Each main choice must be unique.`);
        seen.add(id);
      }
      if (client === 'pi') {
        const byModel = new Map();
        for (const choice of models) {
          if (byModel.has(choice.model)) {
            fail(`agents.orchestrator.models lists ${choice.model} twice (${byModel.get(choice.model)} and ${choice.effort}). Pi 1.3.0 resolves the main scope by model identity and would silently drop one of them; use one entry per Pi model (OMP may repeat a model with different efforts).`);
          }
          byModel.set(choice.model, choice.effort);
        }
      }
    } else {
      model = exactModel(clientValue('model', agent, `${name}.model`), `${name}.model`);
      effort = exactEffort(clientValue('effort', agent, `${name}.effort`), `${name}.effort`);
    }
    const toolMap = agent.tools ?? {};
    const spawnMap = agent.spawns ?? {};
    const extensionMap = agent.extensions ?? {};
    fields(toolMap, ['omp', 'pi'], `${name}.tools`);
    fields(spawnMap, ['omp', 'pi'], `${name}.spawns`);
    fields(extensionMap, ['pi'], `${name}.extensions`);
    if (OMP_BUILTINS.has(name) && (own(toolMap, 'omp') || own(spawnMap, 'omp'))) {
      fail(`${name}: tools.omp/spawns.omp cannot override an OMP builtin. Its definition, tools, output and spawn policy remain native; configure only the pi mapping.`);
    }
    for (const [toolClient, names] of Object.entries(toolMap)) {
      const valid = toolClient === 'pi' ? /^[a-z][a-z0-9_:/.-]*$/ : /^[a-z][a-z0-9_-]*$/;
      if (!Array.isArray(names) || names.some(item => typeof item !== 'string' || !valid.test(item)) || new Set(names).size !== names.length) fail(`${name}.tools.${toolClient} must be an array of distinct tool names`);
    }
    for (const [spawnClient, names] of Object.entries(spawnMap)) {
      if (names !== '*' && (!Array.isArray(names) || names.some(item => typeof item !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item)) || new Set(names).size !== names.length)) {
        fail(`${name}.spawns.${spawnClient} must be '*' or an array of distinct agent names`);
      }
    }
    let tools = [], spawns = spawnMap[client] ?? [], extensions;
    if (!native && !orchestrator) {
      if (!Array.isArray(toolMap[client])) fail(`${name}.tools.${client} is required`);
      tools = toolMap[client];
      if (client === 'pi' && !tools.length) fail(`${name}: specify a nonempty Pi tool allowlist; an empty plugin field can inherit default tools`);
      if (tools.some(tool => ['task', 'subagent', 'subagents_enable', 'agent_config_task'].includes(tool)) && spawns !== '*' && !spawns.length) {
        fail(`${name}: delegation tools require an explicit spawns grant`);
      }
    }
    if (own(extensionMap, 'pi')) {
      if (!Array.isArray(extensionMap.pi) || extensionMap.pi.some(item => typeof item !== 'string' || !item.trim())) fail(`${name}.extensions.pi must be an array of paths`);
      if (client === 'pi') extensions = extensionMap.pi.map(item => {
        const absolute = item.startsWith('~') ? expand(item) : path.resolve(base, item);
        const resolved = fs.realpathSync(absolute);
        if (!fs.statSync(resolved).isFile() && !fs.statSync(resolved).isDirectory()) fail(`Invalid Pi extension path: ${item}`);
        return resolved;
      });
    }
    result.push(orchestrator
      ? { name, description, prompt, models }
      : { name, description, prompt, model, effort, tools, spawns, extensions, native });
  }
  return { concurrency: config.concurrency, agents: result };
}
function blockRange(content) {
  const start = content.indexOf(BEGIN), end = content.indexOf(END);
  if (start === -1 && end === -1) return null;
  if (start === -1 || end < start || content.indexOf(BEGIN, start + BEGIN.length) !== -1 || content.indexOf(END, end + END.length) !== -1) fail('AGENTS.md contains malformed or repeated agent-config markers');
  return { start, end: end + END.length, block: content.slice(start, end + END.length) };
}
function getSlot(value, parts) {
  for (const key of parts) {
    if (value == null || !own(value, key)) return missing;
    value = value[key];
  }
  return { exists: true, value };
}
function settingEditor(content, file) {
  if (file.endsWith('.json')) {
    const errors = [];
    let value = JSONC.parse(content || '{}', errors, { allowTrailingComma: true, disallowComments: false });
    if (errors.length) fail(`Invalid JSONC settings: ${file} (offset ${errors[0].offset})`);
    object(value, file);
    let output = content || '{}\n';
    return {
      get: parts => getSlot(value, parts),
      set(parts, slot) {
        output = JSONC.applyEdits(output, JSONC.modify(output, parts, slot.exists ? slot.value : undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
        value = JSONC.parse(output);
      },
      output: () => output,
    };
  }
  const doc = yamlDocument(content || '{}\n', file);
  if (doc.toJS() == null) doc.contents = doc.createNode({});
  object(doc.toJS(), file);
  return {
    get: parts => getSlot(doc.toJS(), parts),
    set(parts, slot) {
      if (slot.exists) doc.setIn(parts, slot.value);
      else doc.deleteIn(parts);
    },
    output: () => doc.toString({ lineWidth: 0 }),
  };
}

function requirePiSubagents(target, explicit) {
  const root = explicit ? expand(explicit) : path.join(target, 'npm/node_modules/pi-subagents');
  const manifest = path.join(root, 'package.json');
  if (!stat(manifest)) fail('Pi workers require nicobailon/pi-subagents. Run pi install npm:pi-subagents@0.79.1 in this profile first. For a git/local installation, pass --pi-subagents-dir PATH to its package root.');
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const version = /^0\.79\.(\d+)$/.exec(pkg.version ?? '');
  if (pkg.name !== 'pi-subagents' || !version || Number(version[1]) < 1) fail(`Unsupported Pi plugin at ${root}: expected pi-subagents 0.79.x (>=0.79.1), found ${pkg.name ?? '(unknown)'} ${pkg.version ?? '(unknown)'}. Do not substitute a different subagent plugin.`);
  console.log(`Pi plugin prerequisite: ${pkg.name}@${pkg.version} (${root}). Verify it is loaded in the target Pi session.`);
}

function checkPiOverrides(config, editor) {
  const settings = editor.get(['subagents']);
  if (!settings.exists) return;
  const subagents = object(settings.value, 'subagents');
  for (const agent of config.agents.filter(agent => agent.name !== 'orchestrator')) {
    if (own(subagents.agentOverrides ?? {}, agent.name)) fail(`subagents.agentOverrides.${agent.name} would override the generated definition. Reconcile it with your local YAML before installing.`);
    for (const [provider, overrides] of Object.entries(subagents.agentOverridesByProvider ?? {})) {
      if (own(overrides, agent.name)) fail(`subagents.agentOverridesByProvider.${provider}.${agent.name} would override the generated definition. Reconcile it with your local YAML before installing.`);
    }
  }
}

// Both the client settings and plugin settings use the same leaf-level ownership.
function mergeSettings(editor, wanted, previous) {
  const records = new Map((previous?.changes ?? []).map(record => [JSON.stringify(record.path), record]));
  const changes = [];
  const containers = [...(previous?.containers ?? [])];
  let changed = false;
  for (const record of records.values()) {
    if (!isDeepStrictEqual(editor.get(record.path), record.installed)) fail(`Managed setting changed externally: ${record.path.join('.')}. Restore its installed value before reinstall/uninstall.`);
  }
  for (const entry of wanted) {
    for (let length = 1; length < entry.path.length; length++) {
      const prefix = entry.path.slice(0, length), slot = editor.get(prefix);
      if (slot.exists) object(slot.value, `Settings ${prefix.join('.')}`);
      else if (!containers.some(item => isDeepStrictEqual(item, prefix))) containers.push(prefix);
    }
    const id = JSON.stringify(entry.path);
    const before = records.get(id)?.before ?? editor.get(entry.path);
    if (!isDeepStrictEqual(editor.get(entry.path), entry.installed)) {
      editor.set(entry.path, entry.installed);
      changed = true;
    }
    records.delete(id);
    changes.push({ ...entry, before });
  }
  for (const record of records.values()) {
    if (!isDeepStrictEqual(editor.get(record.path), record.before)) {
      editor.set(record.path, record.before);
      changed = true;
    }
  }
  for (const prefix of [...containers].sort((a, b) => b.length - a.length)) {
    const slot = editor.get(prefix);
    if (slot.exists && slot.value && typeof slot.value === 'object' && !Array.isArray(slot.value) && !Object.keys(slot.value).length) {
      editor.set(prefix, missing);
      changed = true;
    }
  }
  return { changes, containers, changed };
}
// OMP resolves a settings value as a role reference only through these prefixes (config/model-roles.ts
// xa/xv): `@role`, `pi/role`, and the `*` default. Values are comma lists, so every comma-separated
// item is checked, and the optional suffix is any native thinking level, including `auto`/`inherit`.
const ALIAS_PREFIXES = ['@', 'pi/'];
const ALIAS_LEVELS = [...LEVELS, 'auto', 'inherit'];
function aliasedRoles(value, aliases) {
  const roles = new Set();
  for (const item of String(value).split(',')) {
    const text = item.trim();
    const star = text === '*' || text.startsWith('*:');
    const prefix = star ? '' : ALIAS_PREFIXES.find(candidate => text.startsWith(candidate));
    if (prefix === undefined) continue;
    const parts = text.slice(prefix.length).split(':');
    const level = parts.length === 2 && ALIAS_LEVELS.includes(parts[1]);
    const role = star ? 'default' : (parts.length === 1 || level) ? parts[0] : undefined;
    if (role && aliases.has(role)) roles.add(role);
  }
  return roles;
}
function roleReferences(document, aliases, references = new Map(), trail = []) {
  if (typeof document === 'string') {
    for (const role of aliasedRoles(document, aliases)) {
      if (!references.has(role)) references.set(role, new Set());
      references.get(role).add(trail.join('.') || '(document)');
    }
  } else if (Array.isArray(document)) {
    document.forEach((item, index) => roleReferences(item, aliases, references, [...trail, String(index)]));
  } else if (document && typeof document === 'object') {
    for (const [key, item] of Object.entries(document)) roleReferences(item, aliases, references, [...trail, key]);
  }
  return references;
}
function assign(target, parts, slot) {
  let cursor = target;
  for (const key of parts.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  if (slot.exists) cursor[parts.at(-1)] = slot.value;
  else delete cursor[parts.at(-1)];
}
function desiredSettings(client, config, editor, previous) {
  // Keyed by path so a leaf can never be installed twice (a duplicate would record the installer's own
  // value as `before` and break restore).
  const entries = new Map();
  const put = (parts, value) => entries.set(JSON.stringify(parts), { path: parts, installed: { exists: true, value } });
  const remove = parts => entries.set(JSON.stringify(parts), { path: parts, installed: missing });
  const main = config.agents.find(agent => agent.name === 'orchestrator');
  const [startup] = main.models;
  if (client === 'omp') {
    put(['task', 'maxConcurrency'], config.concurrency);
    const workers = config.agents.filter(agent => agent.name !== 'orchestrator');
    const names = workers.map(agent => agent.name);
    for (const agent of workers) put(['task', 'agentModelOverrides', agent.name], `${agent.model}:${agent.effort}`);
    const disabled = editor.get(['task', 'disabledAgents']);
    if (disabled.exists) {
      if (!Array.isArray(disabled.value)) fail('task.disabledAgents must be an array');
      const conflicts = disabled.value.filter(name => names.includes(name));
      if (conflicts.length) fail(`Configured OMP roles are disabled by task.disabledAgents: ${conflicts.join(', ')}. Remove those names explicitly before installing; unrelated disabled roles are preserved.`);
    }
    // Ctrl+P cycles these literal role ids, so each choice needs a readable role key of its own; the
    // modelTags name is what the selector shows for the same key.
    for (const choice of main.models) {
      put(['modelRoles', choice.label], `${choice.model}:${choice.effort}`);
      put(['modelTags', choice.label, 'name'], choice.label);
      put(['modelTags', choice.label, 'hidden'], false);
    }
    put(['modelRoles', 'default'], `${startup.model}:${startup.effort}`);
    put(['cycleOrder'], main.models.map(choice => choice.label));
    put(['defaultThinkingLevel'], startup.effort);
    for (const role of OMP_ROLES) put(['modelTags', role, 'hidden'], true);
    // Built-in role allocations are cleaned up, but a mapping another consumer still references by
    // alias must survive: removing it would silently reroute that consumer to a native fallback.
    // A role is cleared when it currently holds a value or when an earlier install already cleared it,
    // so the wanted removals stay identical across reinstalls instead of oscillating.
    const document = editor.get([]).value;
    const current = document && typeof document.modelRoles === 'object' && document.modelRoles !== null && !Array.isArray(document.modelRoles) ? document.modelRoles : {};
    const owned = new Set((previous?.changes ?? []).filter(record => record.path.length === 2 && record.path[0] === 'modelRoles').map(record => record.path[1]));
    const managed = [...OMP_ROLES, ...OMP_OBSOLETE_ROLES].filter(role => role !== 'default');
    const present = new Set(managed.filter(role => own(current, role)));
    const cleared = managed.filter(role => owned.has(role) && !own(current, role));
    const aliases = new Set([...OMP_ROLES, ...Object.keys(current)]);
    const installed = structuredClone(document ?? {});
    for (const entry of entries.values()) assign(installed, entry.path, entry.installed);
    for (const role of present) assign(installed, ['modelRoles', role], missing);
    let references = roleReferences(installed, aliases);
    const retained = new Map();
    for (let pass = 0; pass < present.size; pass++) {
      const dependency = [...present].find(role => !retained.has(role) && references.has(role));
      if (!dependency) break;
      retained.set(dependency, references.get(dependency));
      assign(installed, ['modelRoles', dependency], { exists: true, value: current[dependency] });
      references = roleReferences(installed, aliases);
    }
    for (const [role, paths] of retained) {
      console.log(`Preserving modelRoles.${role} (hidden): ${[...paths].sort().join(', ')} still reference that role by alias; removing the mapping would silently reroute the same consumer.`);
      put(['modelTags', role, 'hidden'], true);
    }
    for (const role of [...present].filter(role => !retained.has(role)).concat(cleared)) remove(['modelRoles', role]);
    const assigned = installed.modelRoles && typeof installed.modelRoles === 'object' ? installed.modelRoles : {};
    const unassigned = [...references.keys()].filter(role => role !== 'default' && !own(assigned, role) && !retained.has(role)).sort();
    if (unassigned.length) console.log(`Note: alias references without a modelRoles assignment: ${unassigned.join(', ')}. OMP resolves built-in role names through its native fallback chain; a non-builtin name stays a literal model pattern and its consumer may fail.`);
  } else {
    const slash = startup.model.indexOf('/');
    put(['defaultProvider'], startup.model.slice(0, slash));
    put(['defaultModel'], startup.model.slice(slash + 1));
    put(['defaultThinkingLevel'], startup.effort);
    put(['enabledModels'], main.models.map(choice => `${choice.model}:${choice.effort}`));
  }
  return [...entries.values()];
}
function render(config, client) {
  const files = {};
  const workers = config.agents.filter(agent => agent.name !== 'orchestrator');
  const main = config.agents.find(agent => agent.name === 'orchestrator');
  const capability = client === 'omp'
    ? `OMP transport: use native task/eval schemas and role permissions as exposed by the runtime; do not assume a particular batch mode or recursion limit. Builtin names retain OMP's own definitions, tools and output contracts. Configured roles: ${workers.map(agent => `${agent.name}${agent.native ? ' (native definition, explicit model from the YAML)' : ' (custom definition)'}`).join(', ') || '(none managed)'}. Other native roles, including seance, are not disabled. Every worker model and effort comes from the YAML assignment and never follows the main session model; Ctrl+P cycles only the orchestrator's configured models for the current session.`
    : workers.length
      ? `Pi transport: use the existing nicobailon/pi-subagents subagent tool. Configured roles: ${workers.map(agent => `${agent.name}: ${agent.description}`).join('; ')}. If only subagents_enable is available, activate it first. Use {agent, task, options:{context:"fresh"}} for a single assignment; shared instructions belong in task, not the context enum. Use native workflow/status/steer/resume/supervisor facilities. Nested delegation follows each role's grant and native limits. Per-run concurrency default: ${config.concurrency}. Every worker model and effort comes from the YAML assignment and never follows the main session model. There is no pi seance equivalent or OMP agent:// transport.`
      : 'No repository-managed worker roles. Existing plugin/user roles are not disabled; discover the actual runtime inventory before delegating.';
  const block = `${BEGIN}\n${main.prompt}\n\n## Client capabilities\n\n${capability}\n${END}`;
  if (client === 'omp') {
    for (const agent of workers.filter(agent => !agent.native)) {
      const frontmatter = { name: agent.name, description: agent.description, tools: agent.tools, spawns: agent.spawns, model: `${agent.model}:${agent.effort}`, thinkingLevel: agent.effort };
      files[`extensions/agent-config/agents/${agent.name}.md`] = `---\n${YAML.stringify(frontmatter, { lineWidth: 0 })}---\n\n${agent.prompt}\n\n## OMP transport\n\nUse native OMP communication and completion tools. Delegation follows this role's configured spawn grant and the native runtime limits. Relevant context is supplied in the assignment; report concrete blockers to the parent.\n`;
    }
  } else {
    for (const agent of workers) {
      const nesting = agent.spawns === '*' || agent.spawns.length > 0;
      // The plugin needs both the nesting grant and subagent in an explicit tool allowlist.
      const tools = nesting && !agent.tools.includes('subagent') ? [...agent.tools, 'subagent'] : agent.tools;
      const frontmatter = {
        name: agent.name, description: agent.description, advertise: true,
        model: agent.model, tools: tools.join(', '), systemPromptMode: 'append',
        inheritProjectContext: true, inheritGlobalContext: false, inheritSkills: true,
        defaultContext: 'fresh', allowNestedSubagents: nesting,
      };
      if (Array.isArray(agent.spawns) && agent.spawns.length) frontmatter.allowedAgents = agent.spawns.join(', ');
      frontmatter.thinking = agent.effort;
      if (agent.extensions?.length) frontmatter.extensions = agent.extensions;
      // The plugin's scalar-list parser treats a YAML inline [] as a literal name.
      const emptyExtensions = agent.extensions?.length === 0 ? 'extensions:\n' : '';
      files[`agents/${agent.name}.md`] = `---\n${YAML.stringify(frontmatter, { lineWidth: 0 })}${emptyExtensions}---\n\n${agent.prompt}\n\n## Pi runtime\n\nYou are the assigned role, not the parent orchestrator. Use the existing plugin's native result and supervisor channels. Any delegation must follow this role's configured grant and the runtime limits. Do not launch a substitute AI client. Return evidence and blockers through the native result channel.\n`;
    }
    if (workers.some(agent => OMP_BUILTINS.has(agent.name))) {
      files['agents/agent-config-OMP-LICENSE.txt'] = fs.readFileSync(path.join(repo, 'agent/upstream/oh-my-pi/LICENSE'), 'utf8');
    }
  }
  return { files, block };
}
function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) fail('Node.js >=22 is required');
  const opt = options();
  const target = canonical(opt.agentDir);
  const stateBase = canonical(expand(path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local/state'), 'agent-config')));
  const state = path.join(stateBase, hash(target));
  if (inside(target, repo) || inside(repo, target) || inside(state, repo) || inside(repo, state) || inside(state, target) || inside(target, state)) fail('Source repository, target, and private state must be disjoint directories');
  const manifestFile = path.join(state, 'manifest.json');
  const lock = path.join(state, '.install-lock');
  safeParents(manifestFile, state);
  if (stat(manifestFile)?.isSymbolicLink()) fail('Manifest must not be a symlink');
  let locked = false;
  const run = () => {
    const old = stat(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
    if (old && (old.version !== 1 || old.target !== target || old.client !== opt.client)) fail('Manifest belongs to a different client/target or unsupported version; uninstall with its original client first');
    if (opt.uninstall && !old) { console.log(`No managed installation for ${target}`); return; }
    const config = opt.uninstall ? null : readConfig(opt.config, opt.client, target);
    if (config && inside(canonical(opt.config), target)) fail('Install target must not contain the source configuration');
    const piWorkers = opt.client === 'pi' && config?.agents.some(agent => agent.name !== 'orchestrator');
    if (piWorkers) requirePiSubagents(target, opt['pi-subagents-dir']);
    const desired = config ? render(config, opt.client) : { files: {}, block: null };
    const next = { version: 1, client: opt.client, target, files: {}, agents: null, settings: null };
    const plans = [];
    const plan = (relative, after) => {
      if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) fail(`Unsafe managed path: ${relative}`);
      const destination = path.join(target, relative);
      safeParents(destination, target);
      const before = snapshot(destination);
      if (!isDeepStrictEqual(before, after)) plans.push({ destination, relative, before, after });
    };
    const relatives = new Set([...Object.keys(old?.files ?? {}), ...Object.keys(desired.files)]);
    // Only retire legacy repository links, never independently owned files.
    if (!opt.uninstall && opt.client === 'omp') {
      const workerPaths = config.agents.filter(agent => agent.name !== 'orchestrator').map(agent => `agents/${agent.name}.md`);
      const legacyPaths = new Set(['agents/architect.md', 'agents/verifier.md', 'agents/deep.md', 'agents/image-analyst.md', 'upstream/agency-agents', ...workerPaths]);
      for (const relative of legacyPaths) {
        if (old?.files[relative]) continue;
        const destination = path.join(target, relative);
        // Do not inspect children through an independently owned redirected parent.
        const parent = stat(path.dirname(destination));
        if (parent && (!parent.isDirectory() || parent.isSymbolicLink())) continue;
        const before = stat(destination)?.isSymbolicLink() ? { link: fs.readlinkSync(destination) } : null;
        if (sourceLink(before, destination, path.join(repo, 'agent', relative))) {
          safeParents(destination, target);
          relatives.add(relative);
          next.files[relative] = { before, installed: null, retired: true };
        }
      }
    }
    for (const relative of relatives) {
      const destination = path.join(target, relative);
      safeParents(destination, target);
      const current = snapshot(destination);
      const previous = old?.files[relative] ?? next.files[relative];
      if (old?.files[relative] && !isDeepStrictEqual(current, previous.installed)) fail(`Managed file changed externally: ${destination}. Preserve your edits and restore the installed version before reinstall/uninstall.`);
      const wanted = own(desired.files, relative);
      if (!previous && current && !sourceLink(current, destination, path.join(repo, 'agent', relative))) fail(`Refusing to overwrite unknown file: ${destination}`);
      const before = previous ? previous.before : current;
      const legacyAgentBaseline = opt.client === 'omp' && relative.startsWith('agents/') && sourceLink(before, destination, path.join(repo, 'agent', relative));
      const retired = (previous?.retired || legacyAgentBaseline) && !opt.uninstall;
      const after = wanted ? { content: desired.files[relative], mode: 0o600 } : retired ? null : before;
      if (next.files[relative] && !old?.files[relative]) { plan(relative, null); continue; }
      plan(relative, after);
      if (wanted) next.files[relative] = { before, installed: after };
      else if (retired) next.files[relative] = { before, installed: null, retired: true };
    }
    if (!opt.uninstall && opt.client === 'omp') {
      for (const agent of config.agents.filter(agent => agent.name !== 'orchestrator')) {
        const relative = `agents/${agent.name}.md`;
        const destination = path.join(target, relative);
        safeParents(destination, target);
        if (stat(destination) && !old?.files[relative] && !next.files[relative]?.retired) fail(`Existing native role would shadow the configured package role: ${destination}. Preserve it elsewhere or explicitly remove the conflicting definition before installing.`);
      }
    }
    const agentsFile = path.join(target, 'AGENTS.md');
    safeParents(agentsFile, target);
    const agentsCurrent = snapshot(agentsFile);
    const legacy = sourceLink(agentsCurrent, agentsFile, path.join(repo, 'agent/AGENTS.md'));
    if (agentsCurrent?.link !== undefined && !legacy) fail(`Refusing unknown AGENTS.md symlink: ${agentsFile}`);
    let agentsText = legacy ? '' : agentsCurrent?.content ?? '';
    const range = blockRange(agentsText);
    if (old?.agents && range?.block !== old.agents.block) fail('Managed AGENTS.md block changed or disappeared; restore it before reinstall/uninstall');
    if (!old && range) fail('AGENTS.md already contains a managed block without this installation manifest');
    let separator = old?.agents?.separator ?? (agentsText ? (agentsText.endsWith('\n') ? '\n' : '\n\n') : '');
    if (desired.block) {
      agentsText = range ? agentsText.slice(0, range.start) + desired.block + agentsText.slice(range.end) : agentsText + separator + desired.block + '\n';
      next.agents = { block: desired.block, separator, existed: old?.agents?.existed ?? Boolean(agentsCurrent), legacyLink: old?.agents?.legacyLink ?? (legacy ? agentsCurrent.link : null) };
    } else {
      let start = range.start;
      if (separator && agentsText.slice(0, start).endsWith(separator)) start -= separator.length;
      let end = range.end;
      if (agentsText[end] === '\n') end++;
      agentsText = agentsText.slice(0, start) + agentsText.slice(end);
    }
    const agentsAfter = !desired.block && agentsText === '' && old.agents.legacyLink
      ? { link: old.agents.legacyLink }
      : !desired.block && !agentsText && !old.agents.existed ? null : { content: agentsText, mode: agentsCurrent?.mode ?? 0o600 };
    plan('AGENTS.md', agentsAfter);
    let settingsRelative = old?.settings?.file;
    if (!settingsRelative) {
      settingsRelative = opt.client === 'pi' ? 'settings.json' : stat(path.join(target, 'config.yml')) ? 'config.yml' : stat(path.join(target, 'config.yaml')) ? 'config.yaml' : 'config.yml';
      if (opt.client === 'omp' && !stat(path.join(target, settingsRelative)) && (stat(path.join(target, 'settings.json')) || stat(path.join(target, 'agent.db')))) fail('OMP legacy settings exist without YAML; migrate them with OMP before installing');
    }
    if (!['config.yml', 'config.yaml', 'settings.json'].includes(settingsRelative)) fail('Unsafe settings path in manifest');
    const settingsFile = path.join(target, settingsRelative);
    safeParents(settingsFile, target);
    const settingsCurrent = snapshot(settingsFile);
    let settingsText = settingsCurrent?.content ?? '';
    if (settingsCurrent?.link !== undefined) {
      const legacyConfig = path.join(canonical(expand(path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local/state'), 'omp-config'))), hash(target), 'config.yml');
      if (opt.client !== 'omp' || ![legacyConfig, path.join(repo, 'agent/config.yml')].includes(path.resolve(target, settingsCurrent.link))) fail(`Refusing unknown settings symlink: ${settingsFile}`);
      settingsText = fs.readFileSync(settingsFile, 'utf8');
    }
    const editor = settingEditor(settingsText, settingsRelative);
    let settingsChanged = settingsCurrent?.link !== undefined;
    if (piWorkers) checkPiOverrides(config, editor);
    // OMP's task-agent user lookup ignores PI_CODING_AGENT_DIR in 18.12.1.
    // A dedicated configured package root is supported by native discovery.
    // Own only its array membership, never the user's complete extension list.
    let extensionRoot = null;
    const previousRoot = old?.settings?.extensionRoot;
    const needsRoot = opt.client === 'omp' && config?.agents.some(agent => agent.name !== 'orchestrator' && !agent.native);
    if (previousRoot || needsRoot) {
      const slot = editor.get(['extensions']);
      if (slot.exists && (!Array.isArray(slot.value) || slot.value.some(value => typeof value !== 'string'))) fail('OMP extensions must be an array of paths');
      let entries = slot.exists ? [...slot.value] : [];
      if (previousRoot?.added && !entries.includes(previousRoot.root)) fail(`Managed OMP extension registration disappeared: ${previousRoot.root}. Restore that entry before reinstall/uninstall.`);
      if (needsRoot) {
        const root = path.join(target, 'extensions/agent-config');
        extensionRoot = {
          root,
          added: previousRoot ? previousRoot.added : !entries.includes(root),
          existed: previousRoot ? previousRoot.existed : slot.exists,
        };
        if (!entries.includes(root)) entries.push(root);
      } else if (previousRoot?.added) {
        entries = entries.filter(entry => entry !== previousRoot.root);
      }
      const after = !needsRoot && previousRoot && !previousRoot.existed && !entries.length
        ? missing : { exists: true, value: entries };
      if (!isDeepStrictEqual(slot, after)) {
        editor.set(['extensions'], after);
        settingsChanged = true;
      }
    }
    const wanted = config ? desiredSettings(opt.client, config, editor, old?.settings) : [];
    const { changes, containers, changed } = mergeSettings(editor, wanted, old?.settings);
    settingsChanged ||= changed;
    const settingsOutput = editor.output();
    const existed = old?.settings?.existed ?? Boolean(settingsCurrent);
    if (settingsChanged) {
      const empty = !Object.keys(editor.get([]).value).length;
      plan(settingsRelative, !config && !existed && empty ? null : { content: settingsOutput, mode: settingsCurrent?.mode ?? 0o600 });
    }
    if (config) next.settings = { file: settingsRelative, existed, changes, containers, extensionRoot };
    if (piWorkers || old?.pluginSettings) {
      const relative = 'extensions/subagent/config.json';
      const destination = path.join(target, relative);
      safeParents(destination, target);
      const current = snapshot(destination);
      if (current?.link !== undefined) fail(`Refusing redirected Pi plugin settings: ${destination}`);
      const pluginEditor = settingEditor(current?.content ?? '', relative);
      const pluginWanted = piWorkers ? [
        { path: ['globalConcurrencyLimit'], installed: { exists: true, value: config.concurrency } },
        { path: ['parallel', 'concurrency'], installed: { exists: true, value: config.concurrency } },
      ] : [];
      const merged = mergeSettings(pluginEditor, pluginWanted, old?.pluginSettings);
      const existed = old?.pluginSettings?.existed ?? Boolean(current);
      if (merged.changed) {
        const empty = !Object.keys(pluginEditor.get([]).value).length;
        plan(relative, !piWorkers && !existed && empty ? null : { content: pluginEditor.output(), mode: current?.mode ?? 0o600 });
      }
      if (piWorkers) next.pluginSettings = { existed, changes: merged.changes, containers: merged.containers };
    }
    if (config) {
      console.log(`Requested ${opt.client} mapping (no installer substitution):`);
      for (const agent of config.agents) {
        if (agent.name === 'orchestrator') console.log(`  orchestrator: models=${agent.models.map(choice => choice.label).join(' | ')} (first is the ${opt.client} startup default)`);
        else console.log(`  ${agent.name}: model=${agent.model}; effort=${agent.effort}; tools=${agent.native ? '(OMP native definition)' : agent.tools.join(',') || '(none)'}`);
      }
      if (opt.client === 'omp') console.warn('WARNING: OMP native runtime may auth-fallback or clamp unsupported effort. Installation renders requested selectors only. Verify available model/auth and actual resolved worker model/effort; any mismatch is a failed runtime acceptance check.');
      console.warn(`WARNING: The explicit ${opt.client} startup model/effort requires native capability and actual loaded-value verification. A native fallback, clamp, or ignored startup value is a failed acceptance check, not a successful configuration.`);
      if (piWorkers) console.warn('Pi definitions are installed for pi-subagents, not executed by this repository. Verify /subagents-models and /subagents-doctor in a new session; project definitions/settings and native effort handling may change effective values.');
    }
    const manifestText = JSON.stringify(next, null, 2) + '\n';
    const oldManifestText = old ? fs.readFileSync(manifestFile, 'utf8') : null;
    for (const item of plans) console.log(`${opt.dryRun ? 'Would ' : ''}${item.after ? 'write' : 'remove'} ${item.destination}`);
    if (opt.dryRun) { console.log('Dry run: no target or private-state mutations.'); return; }
    if (!plans.length && !opt.uninstall && oldManifestText === manifestText) { console.log('Already installed; no changes.'); return; }
    const backup = path.join(state, 'backups', `${Date.now()}-${randomUUID()}`);
    safeParents(path.join(backup, 'journal.json'), state);
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
    const journal = [];
    // Full pre-change backups stay private, outside the source and manifest.
    for (let index = 0; index < plans.length; index++) {
      const item = plans[index];
      if (item.before) fs.writeFileSync(path.join(backup, `${index}.json`), JSON.stringify(item.before), { mode: 0o600 });
      journal.push({ file: item.destination, backup: item.before ? `${index}.json` : null });
    }
    fs.writeFileSync(path.join(backup, 'journal.json'), JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
    const applied = [];
    const publish = (destination, value, root) => {
      safeParents(destination, root);
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      if (!value) { fs.unlinkSync(destination); return; }
      const temporary = path.join(path.dirname(destination), `.agent-config-${randomUUID()}.tmp`);
      try {
        if (value.link !== undefined) fs.symlinkSync(value.link, temporary);
        else fs.writeFileSync(temporary, value.content, { mode: value.mode, flag: 'wx' });
        safeParents(destination, root);
        fs.renameSync(temporary, destination);
      } finally { if (stat(temporary)) fs.unlinkSync(temporary); }
    };
    try {
      for (const item of plans) {
        safeParents(item.destination, target);
        if (!isDeepStrictEqual(snapshot(item.destination), item.before)) fail(`Concurrent file change: ${item.destination}`);
        publish(item.destination, item.after, target);
        applied.push(item);
      }
      safeParents(manifestFile, state);
      if ((stat(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : null) !== oldManifestText) fail('Manifest changed concurrently');
      if (opt.uninstall) fs.unlinkSync(manifestFile);
      else publish(manifestFile, { content: manifestText, mode: 0o600 }, state);
    } catch (error) {
      for (const item of applied.reverse()) {
        try {
          safeParents(item.destination, target);
          if (!isDeepStrictEqual(snapshot(item.destination), item.after)) fail('file changed during rollback');
          publish(item.destination, item.before, target);
        } catch (rollback) { console.error(`Rollback conflict at ${item.destination}: ${rollback.message}; recover from ${backup}`); }
      }
      throw error;
    }
    console.log(`${opt.uninstall ? 'Uninstalled' : 'Installed'} ${opt.client}. Private backups: ${backup}`);
    if (!opt.uninstall) console.log('Start a new session to load the copied configuration.');
  };
  try {
    if (stat(lock)) fail(`Another installation holds ${lock}; if interrupted, inspect its owner before removing the stale lock`);
    if (!opt.dryRun) {
      safeParents(manifestFile, state);
      fs.mkdirSync(state, { recursive: true, mode: 0o700 });
      fs.chmodSync(state, 0o700);
      fs.mkdirSync(lock, { mode: 0o700 });
      locked = true;
      fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, target, client: opt.client }), { mode: 0o600 });
    }
    run();
  } finally {
    if (locked) {
      safeParents(path.join(lock, 'owner.json'), state);
      fs.unlinkSync(path.join(lock, 'owner.json'));
      fs.rmdirSync(lock);
    }
  }
}
try { main(); } catch (error) { console.error(`Error: ${error.message}`); process.exitCode = 1; }
