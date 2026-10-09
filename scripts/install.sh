#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  printf '%s\n' 'Usage: scripts/install.sh [--dry-run] [--agent-dir PATH]' \
    'Default: PI_CODING_AGENT_DIR, otherwise ~/.omp/agent.' \
    'Existing managed files are backed up; unrelated settings and agents are preserved.'
}

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

agent_dir="${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}"
dry_run=false
while (($#)); do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --agent-dir) (($# >= 2)) || die '--agent-dir needs a path'; agent_dir="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

for executable in omp python3; do
  command -v "$executable" >/dev/null || die "Required executable not found: $executable"
done
repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
agent_dir="$(python3 -c 'import os, sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))' "$agent_dir")"
case "$agent_dir" in "$repo_dir"|"$repo_dir"/*) die 'Install target must be outside the source repository' ;; esac
state_base="${XDG_STATE_HOME:-$HOME/.local/state}/omp-config"
state_base="$(python3 -c 'import os, sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))' "$state_base")"
case "$state_base" in "$repo_dir"|"$repo_dir"/*) die 'Private installation state must be outside the source repository' ;; esac
target_id="$(python3 -c 'import hashlib, sys; print(hashlib.sha256(sys.argv[1].encode()).hexdigest())' "$agent_dir")"
state_dir="$state_base/$target_id"
state_config="$state_dir/config.yml"
backup_dir="$agent_dir/install-backups/$(date '+%Y%m%d-%H%M%S')-$$"

paths=(AGENTS.md agents/architect.md agents/verifier.md agents/image-analyst.md upstream/agency-agents config.yml)
sources=("$repo_dir/agent/AGENTS.md" "$repo_dir/agent/agents/architect.md" "$repo_dir/agent/agents/verifier.md" "$repo_dir/agent/agents/image-analyst.md" "$repo_dir/agent/upstream/agency-agents" "$state_config")
legacy_rule='rules/astra-flash-coordination.mdc'

for index in 0 1 2 3; do
  [[ -f "${sources[$index]}" && -r "${sources[$index]}" ]] || die "Missing source: ${sources[$index]}"
done
[[ -f "$repo_dir/agent/config.yml" && -d "${sources[4]}" ]] || die 'Missing source configuration or upstream directory'
for relative in "${paths[@]}" "$legacy_rule"; do
  destination="$agent_dir/$relative"
  if [[ -d "$destination" && ! -L "$destination" && "$relative" != upstream/agency-agents ]]; then
    die "Expected a file, found a directory: $destination"
  fi
done
[[ ! -L "$state_config" && ! -d "$state_config" ]] || die "Private merged config must be a regular file: $state_config"
if [[ -L "$agent_dir/config.yml" && ! -e "$agent_dir/config.yml" ]]; then
  die "Existing config symlink is broken: $agent_dir/config.yml"
fi

stage="$(mktemp -d "${TMPDIR:-/tmp}/omp-config-install.XXXXXX")"
changed_paths=()
changed_sources=()
state_changed=false
state_had_original=false
committed=false
lock_held=false
next_config=''

cleanup() {
  exit_code=$?
  set +e
  if [[ "$committed" == false ]]; then
    for ((index=${#changed_paths[@]}-1; index>=0; index--)); do
      relative="${changed_paths[$index]}"
      destination="$agent_dir/$relative"
      expected="${changed_sources[$index]}"
      if [[ -L "$destination" && "$(readlink "$destination")" == "$expected" ]]; then
        rm -f -- "$destination"
      fi
      if [[ -e "$destination" || -L "$destination" ]]; then
        printf 'Rollback conflict; recover from backup manually: %s\n' "$destination" >&2
      elif [[ -e "$backup_dir/$relative" || -L "$backup_dir/$relative" ]]; then
        mv -- "$backup_dir/$relative" "$destination"
      fi
    done
    if [[ "$state_changed" == true ]]; then
      if ! cmp -s -- "$stage/agent/config.yml" "$state_config"; then
        printf 'Rollback conflict; merged config changed externally: %s\n' "$state_config" >&2
      elif [[ "$state_had_original" == true ]]; then
        cp -p -- "$backup_dir/merged-config.yml" "$state_config"
      else
        rm -f -- "$state_config"
      fi
    fi
  fi
  [[ "$lock_held" == false ]] || rmdir -- "$state_dir/.install-lock"
  [[ -z "$next_config" ]] || rm -f -- "$next_config"
  rm -rf -- "$stage"
  return "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p -- "$stage/agent" "$stage/workspace"
if [[ "$dry_run" == false ]]; then
  mkdir -p -- "$agent_dir" "$state_dir"
  mkdir -- "$state_dir/.install-lock" 2>/dev/null || die "Another installation or stale lock exists: $state_dir/.install-lock"
  lock_held=true
fi
if [[ -f "$agent_dir/config.yml" ]]; then
  cp -pL -- "$agent_dir/config.yml" "$stage/agent/config.yml"
elif [[ -f "$agent_dir/config.yaml" ]]; then
  cp -pL -- "$agent_dir/config.yaml" "$stage/agent/config.yml"
elif [[ -e "$agent_dir/settings.json" || -e "$agent_dir/agent.db" ]]; then
  die 'Legacy settings exist without YAML config; let OMP migrate them before installing'
else
  printf '{}\n' > "$stage/agent/config.yml"
fi

omp_config() {
  local directory="$1"
  shift
  (
    unset OMP_PROFILE PI_PROFILE PI_CONFIG_FILES
    export PI_CODING_AGENT_DIR="$directory"
    cd -- "$stage/workspace"
    command omp config "$@"
  )
}

json_value() {
  python3 - "$1" <<'PY'
import json, sys
value = json.loads(sys.argv[1])["value"]
print(value if isinstance(value, str) else json.dumps(value, separators=(",", ":")))
PY
}

merge_records() {
  python3 - "$1" "$2" <<'PY'
import json, sys
current, desired = (json.loads(value)["value"] for value in sys.argv[1:])
if not isinstance(current, dict) or not isinstance(desired, dict):
    raise SystemExit("Expected record-valued OMP settings")
print(json.dumps({**current, **desired}, separators=(",", ":")))
PY
}

# Explicit managed keys: values are read from the draft, never duplicated here.
managed_keys=(modelRoles modelRoleStorage plan.enabled plan.defaultOnStartup advisor.enabled prewalk.enabled retry.modelFallback task.batch task.maxConcurrency task.maxRecursionDepth task.enableEffort task.enableLsp task.prewalk task.agentModelOverrides)
for key in "${managed_keys[@]}"; do
  desired="$(omp_config "$repo_dir/agent" get "$key" --json)"
  case "$key" in
    modelRoles|task.agentModelOverrides)
      current="$(omp_config "$stage/agent" get "$key" --json)"
      value="$(merge_records "$current" "$desired")"
      ;;
    *) value="$(json_value "$desired")" ;;
  esac
  omp_config "$stage/agent" set "$key" "$value" >/dev/null
done

if [[ "$dry_run" == true ]]; then
  for index in "${!paths[@]}"; do
    printf 'Would link %s -> %s\n' "$agent_dir/${paths[$index]}" "${sources[$index]}"
  done
  if [[ -e "$agent_dir/$legacy_rule" || -L "$agent_dir/$legacy_rule" ]]; then
    printf 'Would back up and disable legacy rule: %s\n' "$agent_dir/$legacy_rule"
  fi
  printf 'Dry run: no destination or private-state files changed.\n'
  committed=true
  exit 0
fi

if ! cmp -s -- "$stage/agent/config.yml" "$state_config"; then
  if [[ -f "$state_config" ]]; then
    mkdir -p -- "$backup_dir"
    cp -p -- "$state_config" "$backup_dir/merged-config.yml"
    state_had_original=true
  fi
  next_config="$state_dir/config.yml.next.$$"
  cp -- "$stage/agent/config.yml" "$next_config"
  chmod 600 "$next_config"
  mv -- "$next_config" "$state_config"
  state_changed=true
fi

replace_destination() {
  local relative="$1" source="$2" destination="$agent_dir/$1"
  if [[ -n "$source" && -L "$destination" && "$(readlink "$destination")" == "$source" ]]; then
    printf 'Already linked: %s\n' "$destination"
    return
  fi
  mkdir -p -- "$(dirname -- "$destination")"
  if [[ -e "$destination" || -L "$destination" ]]; then
    mkdir -p -- "$(dirname -- "$backup_dir/$relative")"
    mv -- "$destination" "$backup_dir/$relative"
  fi
  changed_paths+=("$relative")
  changed_sources+=("$source")
  if [[ -n "$source" ]]; then
    ln -s -- "$source" "$destination"
    printf 'Linked %s -> %s\n' "$destination" "$source"
  fi
}

if [[ -e "$agent_dir/$legacy_rule" || -L "$agent_dir/$legacy_rule" ]]; then
  replace_destination "$legacy_rule" ''
  printf 'Backed up and disabled legacy rule: %s\n' "$legacy_rule"
fi
for index in "${!paths[@]}"; do
  replace_destination "${paths[$index]}" "${sources[$index]}"
done
committed=true
[[ ! -d "$backup_dir" ]] || printf 'Backups: %s\n' "$backup_dir"
printf 'Installed. Prompt changes are live through links; rerun this script after config changes.\n'
