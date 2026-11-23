# 개인 에이전트 환경

개인 지침과 역할을 Rulesync 43.8.0의 공식 CLI로 클라이언트별 native 형식에 맞춰 생성한다. 별도 설치 스크립트나 공통 문서 복사 경로는 사용하지 않는다. 모델·effort·계정·동시 실행 수는 클라이언트의 개인 설정에 남긴다.

## 정본

| 경로 | 역할 |
|---|---|
| `.rulesync/rules/behavior.md` | 메인·작업자 공통 범위·승인·검증 기준 |
| `.rulesync/rules/development.md` | 메인·작업자 공통 구현·계약·오류·테스트·검증 기준 |
| `.rulesync/rules/orchestration.md` | 메인의 위임·조율·통합·완료 판단 지침 |
| `.rulesync/subagents/*.md` | 공통 역할 본문과 클라이언트별 메타데이터 |
| `AGENTS.md` | 이 저장소를 수정하는 에이전트의 작업 안내. 배포하거나 생성하지 않는다 |
| `docs/*-reference.md` | 각 지침의 근거 주석판. 해당 정본과 함께 갱신한다 |
| `ORCHESTRATOR.original.md`, `docs/ref/` | 과거 원본과 참고 자료. 배포하지 않는다 |
| `rulesync.jsonc`, `package-lock.json` | 생성 설정과 Rulesync 버전 고정 |

배포할 규칙 정본은 `behavior.md`, `development.md`, `orchestration.md`다. `startup.md`나 별도의 루트 오케스트레이션 정본은 두지 않는다. YAML frontmatter는 Rulesync가 대상과 생성 형식을 판단하는 메타데이터다.

## 설치와 갱신

Node.js 22 이상이 필요하다. 저장소에서 실행한다.

```sh
npm ci --ignore-scripts
npx rulesync generate --global --output-roots "$HOME" --targets omp --features rules,subagents --dry-run
npx rulesync generate --global --output-roots "$HOME" --targets omp --features rules,subagents
npx rulesync generate --global --output-roots "$HOME" --targets omp --features rules,subagents --check
```

규칙만 갱신할 때는 `--features rules`를 사용한다. 다른 클라이언트는 target만 바꾼다.

```sh
npx rulesync generate --global --output-roots "$HOME" --targets claudecode,codexcli --features rules,subagents
npx rulesync generate --global --output-roots "$HOME" --targets opencode --features rules,subagents
npx rulesync generate --global --output-roots "$HOME" --targets opencodev1 --features rules,subagents
npx rulesync generate --global --output-roots "$HOME" --targets pi --features rules
```

`opencode`는 2.x, `opencodev1`은 1.x다. 같은 경로를 사용하므로 둘을 함께 설치하지 않는다. Pi target은 서브에이전트를 지원하지 않으므로 규칙만 생성한다. 다른 target도 공식 지원 범위를 확인하고 대상과 기능을 명시한다. `npm run ai:generate -- ...`는 같은 공식 CLI의 단축 명령이다.

`--dry-run`은 쓰지 않고 변경을 미리 보여 준다. `--check`는 생성물과 정본이 다르면 종료 코드 1을 반환한다. 생성 전 미리보기의 출력 경로와 경고를 확인한다. 설정의 `delete: false`를 유지하고 `--delete`로 관리되지 않는 개인 규칙·역할을 일괄 삭제하지 않는다. 이름을 바꾸거나 제거한 규칙의 이전 생성물은 소유 경로와 내용을 확인한 뒤 개별적으로 정리한다.

이 저장소 루트에 배포용 규칙을 생성하지 않는다. 특히 `--global --output-roots "$HOME"` 없이 Codex용 규칙을 생성하면 저장소 안내인 루트 `AGENTS.md`를 덮어쓸 수 있다.

## 클라이언트별 규칙 배치

모든 규칙 정본은 `root: false`인 모듈형 규칙이다. 별도 시작 파일 없이 각 클라이언트의 native 로딩 방식을 사용한다.

| 클라이언트 | 기본 사용자 경로에서 생성되는 규칙 |
|---|---|
| OMP | `~/.omp/agent/rules/behavior.md`, `development.md`, `orchestration.md` |
| Claude Code | `~/.claude/rules/behavior.md`, `development.md`, `orchestration.md` |
| Codex CLI | `~/.codex/AGENTS.md`에 세 본문을 합친다 |
| OpenCode / OpenCode V1 | `~/.config/opencode/memories/behavior.md`, `development.md`, `orchestration.md` 및 설정의 `instructions` 등록 |
| Pi | `~/.pi/agent/AGENTS.md`에 세 본문을 합친다 |

Rulesync는 `root: true`인 정본이 없다는 권고 경고를 출력할 수 있다. 세 규칙을 native 모듈형 규칙으로 배포하는 구성에서는 예상되는 경고이며, 이를 없애기 위한 별도 시작 파일은 만들지 않는다. 다른 경고는 원인을 확인한다.

파일 분리와 로딩 시점은 서로 다르다. 범위 제한이 없는 규칙은 OMP·Claude Code 등에서 자동 로딩되며, Codex·Pi는 세 본문을 기본 지침으로 합친다. 따라서 모든 클라이언트에서 오케스트레이션 문서를 메인에게만 필요할 때 로딩하도록 보장하지 않는다. 오케스트레이션 본문의 역할 지침은 메인에게 적용하고, 서브에이전트에게 메인 역할을 맡기거나 본문 전체를 다시 전달하지 않는다.

## OMP 역할과 개인 설정

OMP에는 `deep`, `image-analyst`만 `~/.omp/agent/agents/`에 생성한다. `task`, `scout`, `sonic`, `reviewer`, `security-reviewer`는 OMP 내장 정의를 유지한다. 이 다섯 역할의 공통 본문은 Claude Code·Codex CLI·OpenCode용 생성에 사용한다.

OMP의 `task.agentModelOverrides`를 그대로 사용하며 정본에 모델·effort를 고정하지 않는다. MCP·hook·인증·권한 설정은 위 명령의 생성 대상이 아니다. OpenCode의 규칙 등록처럼 해당 기능에 필요한 설정 갱신은 Rulesync가 수행한다.

OMP global 경로는 기본 프로필 전용이다. `OMP_PROFILE`, `PI_PROFILE`, `PI_CODING_AGENT_DIR`로 다른 프로필을 쓰는 경우 위 경로를 해당 프로필의 설치 경로로 간주하지 않는다. Rulesync의 `HOME_DIR` 등 홈 경로 오버라이드를 사용하는 경우에도 미리보기에서 실제 출력 경로를 확인한다. 자체 설치기의 환경 변수 검사나 경고 차단은 더 이상 제공하지 않는다.

## 개인 오버라이드

`rulesync.local.jsonc`는 공식 CLI가 읽는 로컬 설정 파일이며 버전 관리하지 않는다. 공유 설정을 덮어쓸 수 있으므로 배포 전 미리보기를 확인한다.

`.rulesync.local/`을 원본 overlay로 쓰려면 공식 옵션으로 명시한다. 같은 상대 경로의 파일 전체를 대체하므로 역할 본문과 필요한 메타데이터를 함께 유지한다.

```sh
npx rulesync generate --input-roots .rulesync .rulesync.local --global --output-roots "$HOME" --targets omp --features rules,subagents --dry-run
```

## 확인

`--check`로 생성 정합성을 확인한 뒤 새 클라이언트 세션에서 실제 로딩을 확인한다. 생성 정합성과 실제 세션 검증은 구분해서 보고한다. 생성 동작을 비교하려면 `--output-roots`와 `HOME_DIR`를 동일한 임시 디렉터리로 지정해 실제 개인 설정에 쓰지 않고 확인한다.

공식 근거: [설정](https://rulesync.dyoshikawa.com/guide/configuration), [CLI](https://rulesync.dyoshikawa.com/reference/cli-commands), [파일 형식](https://rulesync.dyoshikawa.com/reference/file-formats).
