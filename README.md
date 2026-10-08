# 사용자 전역 OMP 구성 초안

> 상태: 초안. 실제 `~/.omp/agent`에 설치하지 않았으며, 기존 전역 설정·지침·에이전트를 변경하지 않는다.

이 저장소는 프로젝트와 독립적인 사용자 전역 OMP 설정을 Git으로 관리한다. 남이 작성한 프롬프트를 기반으로 필요한 부분만 개편하고, 차용 원본과 실행용 수정본을 분리한다. 인증 정보·실행 로그·세션·캐시는 저장하지 않는다.

## 구성과 소유권

```text
agent/
  config.yml                  # 모델 role과 OMP 기본 에이전트 바인딩
  AGENTS.md                   # 메인 지침의 import와 OMP 로컬 정책
  prompts/
    orchestrator.md           # Agency Orchestrator + Handoff 기반 메인 지침
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
```

- 구체적인 모델과 effort는 `config.yml`만 수정한다. 추가 에이전트는 role을 참조한다.
- OMP 기본 `task`, `sonic`, `scout`, `reviewer`, `security-reviewer`는 기존 프롬프트를 유지하고 모델 배정만 지정한다.
- 메인은 조율만 담당한다. 설계·검증과 구현은 해당 작업자에게 맡기며 플랜 모드를 사용하지 않는다.
- advisor 모델은 배정하되 기본 비활성화한다. 호출별 effort 자동 변경, prewalk와 자동 모델 fallback은 사용하지 않는다.
- `AGENTS.md`의 `@prompts/orchestrator.md`는 OMP context import로 확장한다. 독립된 오케스트레이터 서브에이전트를 추가하지 않는다.

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
| `prompts/orchestrator.md` | 오케스트레이터의 mission·gate·state·context·성공 기준, 인계 template와 실패 피드백 필드 | 실행하지 않을 agency pipeline·roster·예시 명령·예측을 제외하고 역할명·재시도 기준을 조정 |
| `agents/architect.md` | 설계 원문 대부분, DDD·패턴 선택표·경계·ADR template | OMP frontmatter, 허구의 기억·경험 제거, 의무 ADR·대안 개수 완화, 읽기 전용·이미지 경계 추가 |
| `agents/verifier.md` | QA 원문 대부분, 증거 기준·UI 검증법·보고 template | 고정 Laravel·포트·캡처 명령과 미존재 참조 제거, 직접 시각 관찰을 Luna의 텍스트 관찰로 대체, scope·실행·이미지 경계 추가 |
| `agents/image-analyst.md` | QA의 Core Beliefs와 Visual Evidence Analysis | 범용 이미지 범위·선택적 브라우저 캡처·불확실성·텍스트 전용 인계 추가 |
| `AGENTS.md` | 원문 기반 메인 지침을 import | OMP 역할 배정·동시 작업·이미지 격리·권한 경계만 정의 |

원문 내 template와 UI 예시는 요청된 범위에 맞는 경우에만 사용한다. 별도 문서 생성, 지정 viewport·포트·품질 등급이나 특정 수정 회차를 자동 요구하지 않는다. 인기도나 원문 보존 자체가 행동 품질을 증명하지는 않는다.

## 설치하지 않고 설정 확인

저장소 루트에서 초안의 role을 읽는다.

```sh
PI_CODING_AGENT_DIR="$PWD/agent" omp config get modelRoles --json
```

runtime smoke는 임시 HOME의 `.omp/agent`에 이 초안을 복사하고, 실제 OMP RPC의 `get_state`로 확인한다. 사용자 에이전트 탐색은 HOME 기반이므로 `PI_CODING_AGENT_DIR`만 바꾼 검증으로 충분하다고 가정하지 않는다. 본 초안 확인에서는 모델 요청을 보내지 않으며, parser·import·roster 로드를 모델 행동이나 실제 이미지 분석의 통과로 확대하지 않는다.

## 향후 전역 적용

아직 installer나 배포 자동화를 추가하지 않는다. 적용할 때는 다음 경계를 지킨다.

1. 기존 사용자 `config.yml`의 관련 값만 병합한다. 인증·브라우저·확장 등 다른 개인 설정을 보존한다.
2. `AGENTS.md`, `prompts/`, 추가 에이전트, `upstream/`과 라이선스를 함께 배치한다. 기존 파일 덮어쓰기·삭제는 차이를 확인한다.
3. 기존 `rules/astra-flash-coordination.mdc`의 충돌하는 두 모델 정책을 정리한다. 필요한 협업·Ouroboros 제한은 이 초안에 보존했다.
4. 메인 `AGENTS.md`가 task 작업자에 그대로 상속되지 않는 OMP 계약을 고려한다. 작업자별 경계는 각각의 프롬프트에도 둔다.
5. 프로젝트 정의는 수정하지 않는다. 같은 이름이면 프로젝트 에이전트가 우선하므로 실제 모델과 프롬프트를 확인한다.
6. 새 세션에서 실제 구현·검증·이미지 질문을 smoke 실행한 뒤 행동 품질과 비용을 평가한다.

## Git 관리

초안과 차용 원본만 추적한다. 인증 정보·로컬 override·runtime DB·로그·세션·캐시는 `.gitignore`로 제외한다. 원격 연결이나 push는 별도 요청 전에는 하지 않는다.

원본을 변경하지 않고 실행용 수정본을 개편한다. 원본과 수정본의 차이는 다음처럼 확인할 수 있다. 차이가 있을 때 `git diff --no-index`의 종료 코드 1은 정상이다.

```sh
git diff --no-index \
  agent/upstream/agency-agents/engineering/engineering-software-architect.md \
  agent/agents/architect.md
```

upstream 갱신 시에는 새 버전과 blob을 확인하고, 로컬 개편을 다시 비교한다. 자동으로 최신 프롬프트를 받아 실행 계약을 바꾸지 않는다.
