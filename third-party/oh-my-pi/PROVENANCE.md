# oh-my-pi role prompt provenance

Source project: [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) — "Coding agent with the IDE wired in", distributed as the `omp` CLI (https://omp.sh).
License: MIT. Copyright holders, verbatim from the pinned `LICENSE`:

- Copyright (c) 2025 Mario Zechner
- Copyright (c) 2025-2026 Can Bölük
- Copyright (c) 2026 Stencil Labs, Inc.

The MIT text for those holders is stored in [`LICENSE`](LICENSE). It covers the borrowed prompt material here and the five derived task/sonic/scout/reviewer/security-reviewer definitions in `agent/agents/`; it does not set the license of this repository or its independently authored custom roles. The installer includes this notice with the derived pi role copies.

## Pinned revision

- Tag: `v18.12.1`
- Commit: `291e055836c210f314af3f73f53244e8e9d09de8`
- Prompt files upstream: `packages/coding-agent/src/prompts/agents/{task,scout,reviewer,security-reviewer}.md`
- Shared frontmatter template upstream: `packages/coding-agent/src/prompts/agents/frontmatter.md`
- Builtin agent metadata upstream: `packages/coding-agent/src/task/agents.ts`

Installed 18.12.1 runtime used for the export: Homebrew `can1357/tap/omp` 18.12.1,
`omp-darwin-arm64` build `20261017-231446-291e055`,
SHA-256 `fa41b27d434380e99b713e4f9ced0f73eb1fc0c409fdf23a57c119971d24bac5`.

Retrieval commands (run manually; nothing here downloads or refreshes prompts at runtime):

```bash
omp agents unpack --dir /tmp/omp-agents --json
curl -fsSL -o LICENSE https://raw.githubusercontent.com/can1357/oh-my-pi/v18.12.1/LICENSE
curl -fsSL -o task.md https://raw.githubusercontent.com/can1357/oh-my-pi/v18.12.1/packages/coding-agent/src/prompts/agents/task.md
```

## What `agents/` contains

`agents/*.md` is the byte-for-byte output of `omp agents unpack` on the pinned 18.12.1 binary, i.e. the exact role contract the runtime discovers: OMP renders each bundled agent from its prompt body plus the frontmatter from its builtin metadata table. Recorded frontmatter at this revision:

| File | tools | spawns | model | thinkingLevel | output schema |
|---|---|---|---|---|---|
| `task.md` | full access (declared in body) | `"*"` | `@task` | `auto` | none |
| `sonic.md` | full access (declared in body) | none | `@smol` | `medium` | none |
| `scout.md` | `read, find, grep, glob, web_search` | none | `@smol` | `medium` | `summary`/`files`/`architecture` + optional `report` |
| `reviewer.md` | `read, find, grep, glob, bash, lsp, web_search, ast_grep` | `scout` | `@slow` | not declared | `overall_correctness`/`explanation`/`confidence` + `findings` |
| `security-reviewer.md` | `read, find, grep, glob, lsp, ast_grep` | none | not declared (parent model) | not declared | `coverage_summary` + `findings`/`reviewed_paths`/`deferred` |

`task` and `sonic` share one prompt body upstream; only their description, model role, thinking level, and spawn grant differ. `task` delegates by design (`spawns: "*"`); `reviewer` may delegate to `scout`.

Upstream source files for the three schema-bearing roles carry the same prompt bodies; only the frontmatter serialization differs (`thinking-level` vs `thinkingLevel`, `model: "@smol"` as a scalar, `output:`/`read-summarize:` blocks). The source `task.md` has no frontmatter at all: `spawns`, `model`, and `thinkingLevel` come from the builtin metadata table. Bodies were verified identical between the pinned source files and this export.

`seance.md` is deliberately not stored or ported: it operates on a forked historical OMP session and has no pi equivalent.

The compiled 18.12.1 binary does not embed this project `LICENSE`; the only license assets inside it belong to the browser-relay extension. The MIT text above therefore comes from the pinned source tag, not from the binary.

Unrelated: `code-yeongyu/oh-my-openagent` (`omo-ai` / senpi) is a different project under a Sustainable Use License and is not the source of any prompt here.

## Derived pi definitions

`agent/agents/{task,sonic,scout,reviewer,security-reviewer}.md` are English ports of the semantics above for the `nicobailon/pi-subagents` plugin, not verbatim copies:

- Preserved: role scope and judgement criteria, read-only constraints, patch-anchored review criteria, consumer-side routing trace, severity/priority and confidence, location (path plus line range), verdict, source-to-sink tracing, untrusted-input handling, root-cause dedupe, reviewed/deferred coverage.
- Replaced: OMP `yield` sections and output schemas become the plugin's native final-text result; discovery and code-intelligence instructions use the pi tools the configured allowlist grants. Pi's native `find` is path discovery, not OMP's semantic search. OMP `agent://` communication becomes the plugin's native supervisor channel.
- Not copied: per-role output schemas, the OMP transport footer, and any blanket prohibition on delegation or on processing raw images.

Store files as-is; do not regenerate them from a live install without updating this record.
