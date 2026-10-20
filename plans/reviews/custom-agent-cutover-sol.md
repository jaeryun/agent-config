> Original independent review of draft SHA-256 `dc54bec331213a05ba630e357f22e4770447ecef1770e603d63ccdb95dec1038`. Line numbers refer to that draft, not the revised plan. Runtime: OMP 18.12.1, `openai-codex/gpt-6.1-sol`, thinking `high`, fallback `false`.

# Sol independent review — custom-agent cutover

## Verdict: REQUEST_CHANGES

The plan correctly retains native OMP discovery/task execution and nicobailon/pi-subagents, separates role names from execution-tool names, preserves explicit model/effort intent, and avoids a new runner or schema framework. The required changes concern concrete native-policy conflicts and rename safety, not a different architecture. In particular, disabling a native name is not always equivalent to disabling a bundled definition, and retaining settings bytes is not enough to retain their effective restrictions after a rename.

This is a static plan review, not implementation approval or runtime verification. I read the complete shared contract and plan, inspected the specified repository implementation/definitions/tests, the supplied six native OMP exports, installed pi-subagents sources/docs, and relevant official OMP v18.12.1 sources. I did not run builds, tests, installations, model requests, or delegation and did not edit repository/global files.

## Required findings

### R1 — P1: OMP's proposed disable policy can disable unrelated user-owned roles

**Plan location:** §1 first boundary bullet; §5 OMP items 2 and 6 (plan lines 85, 89); §7 acceptance row “사용자 정의 보존”.

**Observed evidence:** In official OMP 18.12.1 [`resolveEffectiveSubagentPolicy()`](https://github.com/can1357/oh-my-pi/blob/v18.12.1/packages/coding-agent/src/task/structured-subagent.ts), discovery/first-wins lookup resolves `agent` first, then `cfgTaskDisabledAgents.get(...).includes(agentName)` rejects it. There is no `agent.source === "bundled"` condition. The [discovery contract](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/task-agent-discovery.md#availability-constraints-beyond-discovery) documents the same name-based preflight check.

**Failure scenario:** An unrelated project or user defines its own `reviewer` or `scout`. Adding every bundled name to `task.disabledAgents` makes that custom agent uncallable even though its file survives. Renaming only this repository's roles does not solve this collision. The current plan promises preservation of other owners' agents while merely asking implementers to investigate the contradictory native behavior.

**Minimal plan correction:** Record the now-confirmed name-wide semantics. Before changing settings, inspect discovered non-bundled definitions occupying any proposed disabled name, including project/package sources; stop and report those collisions rather than disabling them. Require a user-owned policy decision when all bundled names cannot be disabled without disabling an independently owned same-name agent; do not rename/delete that other agent or silently exempt it. Add an acceptance case with an unrelated custom agent named after a builtin, not only an unrelated differently named agent. If native-only operation cannot satisfy both goals in that environment, state that incompatibility explicitly instead of promising unconditional support.

### R2 — P1: Vibe is a proven bypass, not merely an unverified default-name dependency

**Plan location:** §5 OMP item 4 (line 87); §7 item 1 and acceptance rows “기본 제공 역할 비활성화” / “이름 생략·특수 경로”.

**Observed evidence:** Official OMP 18.12.1 [`VibeSessionRegistry.#resolveWorker()`](https://github.com/can1357/oh-my-pi/blob/v18.12.1/packages/coding-agent/src/vibe/runtime.ts) maps `fast`/`good` through `VIBE_CLI_AGENT` to `sonic`/`task`, calls `getBundledAgent(agentName)` directly, and resolves its model. `#registerTurnJob()` then calls `runSubprocess(...)` through `#buildSpawnOptions()`, bypassing `resolveEffectiveSubagentPolicy()`. This path does not check `task.disabledAgents` and does not discover the repository's renamed agents.

**Failure scenario:** Normal task calls correctly reject disabled `task`/`sonic`, while entering Vibe and spawning `fast`/`good` still runs their bundled definitions and potentially their native model-role policy. Documenting Vibe as unsupported does not itself make that call fail or disable the native definition. An acceptance rule that simply observes “allowed or failed” can pass while the headline “default builtins disabled” remains false.

**Minimal plan correction:** Replace the open investigation wording with the observed bypass and make the scope decision explicit: either the user accepts that builtins are disabled only on named task/eval dispatch surfaces and that Vibe remains an unmodified native bypass, or implementation is blocked until a supported native gate prevents that entry path. Do not promise an error boundary without identifying an actual native gate, silently disable unrelated tools, patch OMP, or introduce a runner/shim. Define the acceptance outcome for Vibe according to the approved choice. The existing user gate for excluded features is useful, but must explain this distinction between “not ported”, “not supported”, and “cannot execute”.

### R3 — P1: Role renames can silently drop user-owned authorization/model restrictions

**Plan location:** §4 rename paragraph; §5 OMP item 6; §5 pi item 4; §6 preservation bullets; §7 model/effort and migration acceptance.

**Observed evidence:** OMP's [`resolveEffectiveSubagentPolicy()`](https://github.com/can1357/oh-my-pi/blob/v18.12.1/packages/coding-agent/src/task/structured-subagent.ts) indexes `task.agentAccountPools`, `task.agentServiceTierOverrides`, and `task.agentCompactionThresholdOverrides` by exact `agentName`; its [discovery/model contract](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/task-agent-discovery.md#model-and-structured-output-precedence) also identifies exact-name soft-request budgets. Installed pi-subagents `docs/models.md:200-224` documents `subagents.modelScope.agents.<name>` and explicitly states that unknown names are allowed when only named-agent allowlists are configured. Existing `scripts/install.mjs:237-275` handles model/advisor/prewalk leaves for configured OMP names; it does not migrate these other name-keyed policies. `scripts/install.mjs:183-196` checks pi overrides for the current YAML worker names only.

**Failure scenario:** A user restricts `task.agentAccountPools.task` to one account or `subagents.modelScope.agents.task` to an allowed model set. Renaming `task` to a new role leaves those user-owned settings untouched on disk but stops applying them to the worker. The new role may authenticate outside the previous account pool or cease to be subject to its per-role model allowlist. Merely preserving the YAML model and effort does not preserve this policy.

**Minimal plan correction:** Add an explicit rename preflight for native exact-name settings in effective user/project/overlay scopes, at minimum OMP account pools and pi model scope, plus the existing override/advisor/prewalk keys and other supported exact-name policy maps. For unowned entries, report old/new-name effects and stop for reconciliation rather than automatically moving, deleting, or ignoring them. Migrate only entries whose ownership and user-approved role mapping are established, preserving rollback records and destination-conflict checks. Add consumer-visible acceptance that a renamed worker remains subject to an existing account/model restriction, or that installation refuses the unresolved policy without mutation. No credentials need to be read to detect these configuration keys.

### R4 — P2: `subagents.disableBuiltins: true` is conditional on per-agent overrides, including overrides unrelated to new roles

**Plan location:** §5 pi items 2 and 4 (lines 95, 97); §7 builtin-disable acceptance.

**Observed evidence:** Installed `node_modules/pi-subagents/src/agents/agents.js:1336-1365`, `applyBuiltinOverrides()`, returns a project per-agent override before applying project bulk-disable, and returns a user per-agent override before applying user bulk-disable. `selectProviderOverrides()` at `:1072-1084` can supply the per-agent override from the active parent's provider map. Project `disableBuiltins: false` also supersedes a user `true`. The ordinary snapshot path uses this same function at `:2529-2540`.

**Failure scenario:** Existing user settings contain `subagents.agentOverrides.worker: { thinking: "high" }`, without `disabled: true`. Adding only the bulk-disable leaf leaves the bundled `worker` enabled under this implementation. The same can happen only for one provider or trusted project. Checking overrides only against this repository's new names will miss an override for an old builtin name, and one clean-profile/native-list observation will not establish the global claim.

**Minimal plan correction:** State these actual precedence rules and require preflight across the entire builtin inventory, not just the generated role names, considering provider-scoped and project overrides. Preserve existing entries; refuse and report a still-enabled builtin requiring reconciliation instead of deleting overrides or silently adding per-name disables to user-owned definitions. Add acceptance fixtures for a thinking-only builtin override, provider-scoped override, and project bulk-disable override; define the supported profile/project scope rather than implying that one user leaf governs all future projects.

### R5 — P2: Future implementation approval must not implicitly authorize commit/push

**Plan location:** §7 item 6 (line 122), “승인된 구현 작업의 commit/push까지 수행”.

**Evidence and failure scenario:** The shared review contract states that current authorization is plan/reviews only, and identifies unresolved names/permissions/workflow exclusions as user decisions. The plan correctly says that at the top, but its future execution sequence bundles publication into an implementation approval. A later implementer can interpret ordinary approval of the cutover as authority to mutate Git history and push remote state, although implementation and publication are distinct actions.

**Minimal plan correction:** Remove the automatic commit/push step, or make both conditional on explicit user authorization for those actions. Keep documentation updates in implementation completion criteria. Global installation already has its own permission gate; publication should not receive weaker treatment.

## Optional suggestions — not blockers

1. **Specify the private-YAML migration actor and rollback boundary.** §6 preserves personal definition paths and settings correctly, but §4 says personal YAML is renamed alongside generated assets without saying whether that is a user edit, a reviewed one-time migration, or installer behavior. Current `readConfig()` only reads source YAML (`scripts/install.mjs:91-149`), while `plan()`/backup/rollback manage destination files and private state (`:335-341`, `:498-541`). The smallest clarification is to keep the installer source-read-only and describe the approved private-YAML edit separately; if automated source writes are chosen, explicitly extend their backup/conflict/rollback boundary rather than assuming destination journaling covers them.

2. **Include complete pi builtin inventory, by source, when validating disable scope.** Installed `agents/` includes native helper roles and code-owned external-CLI profiles (`codex-exec`, `codex-exec-writer`, `cursor-agent`, `cursor-agent-writer`, `claude-code`, `claude-code-writer`), not just the seven common native role names listed near the start of `docs/agents.md`. Discovery obtains builtin files from the entire package directory (`src/agents/agents.js:2191-2194`). This does not authorize using or porting those profiles; it makes the effect of disabling all plugin builtins explicit.

3. **Retain the plan's semantic-output approach.** OMP native exports use `output` as a structured schema; pi's `output` is an output-file default (`docs/agents.md:435`). OMP schema enforcement depends on effective structured mode, and caller/session schema precedence matters. Do not add schemas or `structured: true` merely to mimic builtin text. If a real consumer requires machine-readable output, record that consumer and verify that particular native result path. The current plan is correct not to copy OMP `yield` instructions into pi prompts.

4. **Keep model-quality claims separate from transport evidence.** Existing `tests/pi-plugin.test.mjs` genuinely exercises native worker dispatch and a real `read` tool through a deterministic endpoint, but only selected roles/mappings and foreground `async:false` calls. Updating it can prove cutover routing/permissions/results, not autonomous prompt quality, global async-workflow behavior, or security isolation. §7 already recognizes the distinction; keep it in the final acceptance report.

## Unverified assumptions and scope limits

- No runtime checks were executed under the review-only prohibition. The failure paths above are source-established; I did not reproduce them against running clients.
- I inspected the supplied native OMP exports as files; I did not rerun `omp agents unpack` or independently attest which installed binary produced them. Official source checks used the explicit v18.12.1 tag. Documentation inventory is not a substitute for the supplied six-definition inventory.
- No personal `config.local.yaml`, credentials, actual global configuration, unrelated histories, or external accounts were read. The user's actual collision/policy cases remain unknown; the required preflights must discover configuration conflicts without exposing secrets.
- The exact future role names, reviewer tool widening, main-only policy, Vibe scope exception, and exclusion of native special workflows remain user decisions. No final names are selected by this review.
- Actual loaded plugin identity, target/profile settings layering, available tools, provider capabilities, fallback/clamping, and resolved model/effort need the implementation-time native checks already required by the plan. Static preservation of requested selectors does not establish their effective use.
- This review does not assert that prompts enforce a host sandbox or that a generated tool allowlist excludes every additive OMP extension/MCP tool. The plan appropriately describes read-only intent as policy, not security isolation.
- No new runner, scheduler, plugin, compatibility alias, schema framework, or automatic port of native workflows is required by these corrections. Parent owns integration; this report is the only authored deliverable.
