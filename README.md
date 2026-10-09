# 사용자 전역 OMP 구성 초안

> 상태: 초안. 실제 `~/.omp/agent`에는 아직 설치하지 않았다. 설치 스크립트를 실행하면 사용자 전역 설정과 지침이 적용된다.

이 저장소는 프로젝트와 독립적인 사용자 전역 OMP 설정을 Git으로 관리한다. 남이 작성한 프롬프트를 기반으로 필요한 부분만 개편하고, 차용 원본과 실행용 수정본을 분리한다. 인증 정보·실행 로그·세션·캐시는 저장하지 않는다.

## 구성과 소유권

```text
agent/
  config.yml                  # 모델 role과 OMP 기본 에이전트 바인딩
  AGENTS.md                   # Agency Orchestrator + Handoff와 OMP 로컬 정책
  agents/
    architect.md              # Software Architect 원문 기반
    verifier.md               # Evidence Collector 원문 기반
    image-analyst.md           # Evidence Collector의 관찰 기준 + 범용 이미지 경계
  upstream/agency-agents/
    LICENSE
    specialized/agents-orchestrator.md
    engineering/engineering-software-architect.md
    testing/testing-evidence-collector.md
    strategy/coordination/handoff-templates.md
scripts/
  install.sh                  # 기존 설정을 병합하는 심볼릭링크 설치
```

- 구체적인 모델과 effort는 `config.yml`만 수정한다. 추가 에이전트는 role을 참조한다.
- OMP 기본 `task`, `sonic`, `scout`, `reviewer`, `security-reviewer`는 기존 프롬프트를 유지하고 모델 배정만 지정한다.
- 메인은 조율만 담당한다. 설계·검증과 구현은 해당 작업자에게 맡기며 플랜 모드를 사용하지 않는다.
- advisor 모델은 배정하되 기본 비활성화한다. 호출별 effort 자동 변경, prewalk와 자동 모델 fallback은 사용하지 않는다.
- 오케스트레이터 내용은 표준 메인 지침 파일인 `AGENTS.md`에 직접 둔다. `prompts/`나 별도 오케스트레이터 서브에이전트를 추가하지 않는다.

## 이미지 처리 경계

원본 이미지는 저가 `vision` 작업자만 처리한다. 메인·구현자·설계자·검증자·advisor는 관찰 결과와 증거 경로를 텍스트로 받는다.

`image-analyst`는 사진·도표·스캔 문서·스크린샷을 모두 다루며 브라우저 전용이 아니다. Playwright helper가 픽셀을 자동 반환하면 캡처·확인 작업 자체를 이 작업자에게 맡긴다. 텍스트만 반환하는 `vision` 이미지 질문 경로도 사용할 수 있지만 같은 이미지를 두 경로에서 중복 분석하지 않는다.

이 경계는 프롬프트 정책이지 보안 sandbox나 provider 수준의 강제 차단은 아니다. 사용자가 메인에 직접 붙인 이미지를 이미 수신한 사실을 되돌릴 수 없다. 실제 도입 시 캡처 출력, advisor 문맥과 실제 모델 배정을 확인해야 한다. 다른 모델의 원본 이미지 처리는 사용자 명시 승인 없이는 허용하지 않는다.

## 조사 범위와 차용 결정

[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)의 메인 오케스트레이션·개발·검증 영역을 세 개의 읽기 전용 조사 작업으로 병렬 검토했다. 오케스트레이터 전체와 관련 NEXUS 전략·인계·활성화·build playbook, 설계·개발·리뷰 후보, QA·접근성·시각 검토 후보를 조사했다. 일부 대형 문서는 필요한 구간만 검토했으며 저장소 전체를 읽었다고 주장하지 않는다.

- **메인**: Agents Orchestrator만으로는 부족하다. 인계 계약은 Handoff Templates를 함께 차용한다. agency 전체 roster, 고정 경로·명령, 고정 재시도 횟수와 spawn-as-subagent 실행 예시는 사용하지 않는다.
- **설계**: Software Architect의 도메인·경계·패턴 선택표·의존 방향·트레이드오프 기준을 원문 중심으로 유지한다. 특정 stack의 Senior Developer, 과도한 Master Plan Architect는 추가하지 않는다.
- **검증**: Evidence Collector의 외관과 동작 증거 구분, 재현 가능한 결함, 미검증 보고를 유지한다. Reality Checker의 강제 실패·수정 회차·포괄적 출시 판정은 기본 계약으로 가져오지 않는다.
- **이미지**: 검토한 후보에는 범용 이미지 분석 프롬프트가 없다. 이미지 생성용 프롬프트를 대신 쓰지 않는다. Evidence Collector의 관찰 기준을 그대로 차용하고 범용 이미지 범위와 텍스트 전용 인계를 로컬 정책으로 추가한다.

## 원본 보존과 최소 개편

기준 버전: `f99f6aa910a442b0197b768ce0ea7751e35e2060`

`agent/upstream/agency-agents/`의 파일은 원본 그대로 보존한다. 취득한 파일의 Git blob 해시는 upstream tree와 일치한다.

| 원본 파일 | Git blob |
|---|---|
| `specialized/agents-orchestrator.md` | `9d62d814d3c5153ef7b403bb4ecba2e9dc21f8ae` |
| `engineering/engineering-software-architect.md` | `1a69148c99b2c170e36e035a0c7a341e98e634e9` |
| `testing/testing-evidence-collector.md` | `321ce36bd2586254b0d7194c5f62965204170532` |
| `strategy/coordination/handoff-templates.md` | `71bff4dbe71d533d992aa7734093bd95cfb0968d` |
| `LICENSE` | `523078c01624b9b1b1c551e75054b9d3a9f953ab` |

원본 URL은 `https://github.com/msitarzewski/agency-agents/blob/<기준 버전>/<원본 파일>`이다. MIT 고지는 원본 디렉터리의 `LICENSE`에 보존한다.

| 실행용 파일 | 유지한 원문 | 필요한 개편 |
|---|---|---|
| `AGENTS.md` | 오케스트레이터의 mission·gate·state·context·성공 기준, 인계 template와 실패 피드백 필드 | 실행하지 않을 agency pipeline·roster·예시 명령·예측을 제외하고 역할명·재시도 기준과 OMP 배정·이미지·권한 정책을 조정 |
| `agents/architect.md` | 설계 원문 대부분, DDD·패턴 선택표·경계·ADR template | OMP frontmatter, 허구의 기억·경험 제거, 의무 ADR·대안 개수 완화, 읽기 전용·이미지 경계 추가 |
| `agents/verifier.md` | QA 원문 대부분, 증거 기준·UI 검증법·보고 template | 고정 Laravel·포트·캡처 명령과 미존재 참조 제거, 직접 시각 관찰을 Luna의 텍스트 관찰로 대체, scope·실행·이미지 경계 추가 |
| `agents/image-analyst.md` | QA의 Core Beliefs와 Visual Evidence Analysis | 범용 이미지 범위·선택적 브라우저 캡처·불확실성·텍스트 전용 인계 추가 |

원문 내 template와 UI 예시는 요청된 범위에 맞는 경우에만 사용한다. 별도 문서 생성, 지정 viewport·포트·품질 등급이나 특정 수정 회차를 자동 요구하지 않는다. 인기도나 원문 보존 자체가 행동 품질을 증명하지는 않는다.

## 설치하지 않고 설정 확인

저장소 루트에서 초안의 role을 읽는다.

```sh
PI_CODING_AGENT_DIR="$PWD/agent" omp config get modelRoles --json
```

runtime smoke는 임시 HOME의 `.omp/agent`에 설치하고 실제 OMP RPC의 `get_state`로 확인한다. 사용자 에이전트 탐색은 HOME 기반이므로 `PI_CODING_AGENT_DIR`만 바꾼 검증으로 충분하다고 가정하지 않는다. 모델 요청을 보내지 않은 parser·roster 로드 검증을 모델 행동이나 실제 이미지 분석의 통과로 확대하지 않는다.

## 심볼릭링크 설치

필요한 실행 파일은 Bash, `omp`, Python 3이다. 저장소 루트에서 먼저 적용 예정 경로를 확인하고 설치한다.

```sh
./scripts/install.sh --dry-run
./scripts/install.sh
```

기본 대상은 `PI_CODING_AGENT_DIR`이 있으면 해당 경로, 없으면 `~/.omp/agent`이다. 다른 사용자 디렉터리나 프로필을 지정할 수 있다.

```sh
./scripts/install.sh --agent-dir "$HOME/.omp/profiles/work/agent"
```

### 연결과 설정 병합

- `AGENTS.md`, 에이전트 파일 3개, `upstream/agency-agents`는 이 저장소의 정본에 직접 링크한다. 다른 사용자 에이전트와 파일은 그대로 둔다.
- 기존 `config.yml` 또는 `config.yaml`을 임시 디렉터리에 복사하고, OMP의 실제 설정 CLI로 초안이 관리하는 키만 병합한다. 사용자 정의 role·에이전트 바인딩과 관련 없는 브라우저·확장·개인 설정을 보존한다.
- 병합한 설정은 `${XDG_STATE_HOME:-$HOME/.local/state}/omp-config/<대상 경로 해시>/config.yml`에 비공개 파일로 저장한다. 전역 `config.yml`은 이 파일에 링크한다. 개인 설정을 Git 저장소에 복사하지 않는다.
- 초안 설정 값을 설치 스크립트에 복제하지 않는다. 관리 키 목록은 스크립트에 명시하며, 새 관리 키를 추가할 때는 목록도 갱신한다.
- 프롬프트 변경은 링크를 통해 연결되지만, 진행 중인 세션의 이미 로드한 지침까지 자동 갱신된다고 가정하지 않는다. 새 세션에서 확인한다.
- `agent/config.yml`을 수정하면 설치 스크립트를 다시 실행해 병합한다. OMP 설정 편집이 전역 링크를 일반 파일로 교체한 경우도 재실행하면 현재 값을 보존해 다시 연결한다.

### 백업과 실패

- 충돌하는 기존 파일·링크는 `<사용자 agent 디렉터리>/install-backups/<시각>-<PID>/`에 보존한다. 같은 링크와 같은 설정으로 재실행하면 불필요한 교체·백업을 하지 않는다.
- 알려진 구형 `rules/astra-flash-coordination.mdc`가 있으면 백업 후 비활성화한다. 다른 규칙은 수정하지 않는다.
- 설치 중 오류나 INT/TERM이 발생하면 이번 실행에서 바꾼 링크와 생성한 설정을 되돌린다. 이동·설정 게시 전에 복구 기록을 남긴다. 외부 프로세스가 동시에 바꾼 경로는 덮어쓰지 않고 복구 충돌을 보고하며, 경로 배치 자체가 바뀌면 자동 복구를 중단한다. 백업은 자동 삭제하지 않는다.
- 대상별 `.install-lock` 링크에 실행별 임시 경로를 소유 토큰으로 담아 동시 설치를 막는다. 링크 생성 한 번으로 획득과 소유권을 함께 기록하고, 종료 시 자기 토큰의 링크만 제거한다. 강제 종료로 lock이 남았다면 다른 설치가 실행 중이 아닌지 확인한 뒤 보고된 lock 링크를 정리한다.
- `--dry-run`은 임시 설정을 병합해 계획만 보여주며 대상과 비공개 설치 상태를 바꾸지 않는다.
- YAML 설정 없이 legacy `settings.json` 또는 `agent.db`만 있으면 설치를 중단한다. 먼저 OMP가 기존 설정을 YAML로 마이그레이션하도록 한다.
- 소스 저장소 내부를 설치 대상이나 개인 상태 경로로 지정하지 못하게 한다. 관리 경로의 실제 부모 디렉터리가 대상 밖이나 소스로 연결되는 하위 심볼릭링크도 거부한다. 백업 경로의 재연결과 상태 디렉터리의 심볼릭링크도 거부한다.
- 개인 상태 디렉터리와 설치 대상은 서로 포함하지 않는 별도 경로여야 한다. 교체할 디렉터리 안에 상태를 만들어 설치 중 함께 이동되는 것을 방지한다.

실제 전역 적용 후에는 새 세션에서 모델 배정과 구현·검증·이미지 질문을 smoke 실행해야 한다. 프로젝트 정의는 수정하지 않으며, 같은 이름이면 프로젝트 에이전트가 전역 정의보다 우선한다. 메인 `AGENTS.md`가 task 작업자에 그대로 상속되지 않으므로 작업자별 경계도 각각의 프롬프트에 유지한다.

## 검증한 범위

초기 구현과 아래 smoke 검증은 메인 작성자가 직접 수행했다. 독립적인 안전성 검토를 통과했다는 의미는 아니었다. 이후 별도 세션의 안전성 검토와 실제 실행 검증을 분리해 수행하고, 발견된 결함은 메인이 수정한 뒤 같은 작업자들이 독립 재검증했다.

- Bash 문법 검사와 실제 설치 스크립트 실행을 확인했다.
- 임시 사용자 디렉터리에서 dry-run 무변경, 링크 6개 생성, 기존 파일 백업, 개인 설정·사용자 정의 role·다른 에이전트 보존, legacy 규칙 비활성화를 확인했다.
- 같은 설정으로 재실행할 때 불필요한 교체·백업이 없으며, 설치 후 편집한 개인 설정도 재설치 시 보존되는 것을 확인했다.
- 설치 도중 실제 파일 경로 오류를 발생시켜 메인 지침·legacy 규칙 복구와 생성 설정·lock 정리를 확인했다. 기존 `config.yaml` 병합과 소스 저장소 내부 설치 거부도 확인했다.
- 설치된 링크를 실제 OMP RPC에서 `--model @default`를 명시해 로드하고 Astra medium, 추가 에이전트 3개, 통합된 메인·인계·이미지 정책을 확인했다.
- 실제 사용자 전역 디렉터리는 변경하지 않았다. 모델 요청을 보내지 않았으므로 작업 품질, 이미지 격리 준수와 비용 절감은 아직 미검증이다.
- 무인증 환경의 자동 기본 시작에서는 로컬 모델로 선택이 바뀌는 현상이 별도 실행 검증에서 관측됐다. 명시적 role 해석 성공을 인증된 자동 모델 선택의 검증으로 확대하지 않는다.

### 독립 검토 결과

| 수행자 | 독립 검토·실행 범위 | 최종 결과 |
|---|---|---|
| `InstallerSafetyReview` — 작성자와 별도 task 세션 | 하위 symlink 탈출, 상태·대상 중첩, 실제 파일 이동·설정 게시 직후 TERM, journal 할당 사이 TERM, lock 획득 직후 TERM과 다른 소유자 lock 보존 | 재현한 HIGH 4개·MEDIUM 1개 모두 수정 후 통과 |
| `InstallerRuntimeReview` — 별도 task 세션 | 실제 installer/OMP CLI로 정상 설치, 개인 설정 보존, dry-run, 재실행, 부분 실패·복구, 경로 거부와 기존 lock 보존 | 확인한 실행 범위에서 PASS |

변경되지 않은 경계의 유효한 증거는 재사용했고, 최종 lock/journal 변경은 영향받는 경로를 별도로 재검증했다. 실제 사용자 디렉터리에는 설치하지 않았고 OMP 모델 프롬프트도 실행하지 않았다.

이 결과는 확인한 설치·복구 경계에 한정된다. 임의의 비협조적 외부 프로세스와 경쟁하는 모든 filesystem interleaving이나 SIGKILL·전원 장애의 자동 복구를 보증하지 않는다. 모델 행동·인증된 자동 모델 선택·이미지 격리 준수·비용은 미검증이다. 이후 검증 보고에서도 작성자 smoke와 독립 검토의 주체·범위를 구분한다.

## Git 관리

초안과 차용 원본만 추적한다. 인증 정보·로컬 override·runtime DB·로그·세션·캐시는 `.gitignore`로 제외한다. 원격 연결이나 push는 별도 요청 전에는 하지 않는다.

원본을 변경하지 않고 실행용 수정본을 개편한다. 원본과 수정본의 차이는 다음처럼 확인할 수 있다. 차이가 있을 때 `git diff --no-index`의 종료 코드 1은 정상이다.

```sh
git diff --no-index \
  agent/upstream/agency-agents/engineering/engineering-software-architect.md \
  agent/agents/architect.md
```

upstream 갱신 시에는 새 버전과 blob을 확인하고, 로컬 개편을 다시 비교한다. 자동으로 최신 프롬프트를 받아 실행 계약을 바꾸지 않는다.
