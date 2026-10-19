# Agent Config

**메인 오케스트레이터와 전문 서브에이전트의 역할·행동·협업 체계를 정의하고, 개인 YAML을 기준으로 OMP와 pi에 적용하는 저장소다.**

에이전트 정의는 이 저장소가 소유한다. 모델·effort·활성 역할·개인 정의 경로는 gitignore된 `config.local.yaml`에서 관리한다. 실행은 **OMP의 네이티브 task** 또는 **기존 `nicobailon/pi-subagents` 플러그인**에 맡긴다. 자체 서브에이전트 실행기·스케줄러·플러그인을 만들거나 설치하지 않는다.

## AI에게 설치 맡기기

사용하는 OMP 또는 pi에 다음 요청을 전달한다.

```text
https://github.com/jaeryun/agent-config 를 내 환경에 설치해 줘.
README.md와 INSTALL.md를 읽고 현재 클라이언트와 설치된 플러그인을 확인해.
기존 config.local.yaml이 있으면 사용하고, 없으면 예제를 바탕으로
내 사용 가능 모델과 선택을 반영해 작성해 줘.
pi라면 nicobailon/pi-subagents의 실제 버전과 정의 형식을 확인하고
기존 플러그인에 적용해. 별도 실행기를 만들거나 다른 플러그인으로 대체하지 마.
기존 지침·인증·무관한 설정을 보존하고 dry-run 후 설치해.
새 세션의 실제 역할 목록과 모델·effort를 확인하고,
모델 호출까지 확인했는지는 별도로 보고해 줘.
```

전체 절차는 [INSTALL.md](INSTALL.md)에 있다. 지원 범위는 OMP와 pi이며, **pi의 지원 플러그인은 npm 패키지 `pi-subagents`**다. `@tintinweb/pi-subagents`, 공식 subagent 예제 등 다른 동명 구현에 그대로 적용된다고 가정하지 않는다.

## 왜 이 pi 플러그인인가

pi는 서브에이전트 실행기를 기본 제공하지 않으며 공식 저장소에는 확장 예제가 있다. 공식 단일 표준이 지정되어 있다는 근거는 없다. 조사한 후보 중 `nicobailon/pi-subagents`는 [pi 공식 패키지 목록](https://pi.dev/packages/pi-subagents)에 등록되어 있고, 사용 지표와 기존 모델·thinking·작업자 관리 기능을 고려하면 이 프로젝트의 기본 지원 대상으로 타당하다. 비교 근거와 지표의 한계는 [REFERENCES.md](REFERENCES.md)에 기록한다.

설치기가 받는 플러그인 버전 범위는 **0.79.x 중 0.79.1 이상**이다. 다른 버전을 자동 교체하지 않는다. 이전 자체 어댑터에서의 pi 0.73.1·1.3.0 테스트는 이 플러그인의 검증이 아니며, 현재 호환성 근거로 사용하지 않는다. 실제 확인한 조합과 범위는 [변경 이력](CHANGELOG.md)에 구분한다.

현재 실제 실행 확인 조합은 **pi 1.3.0 + pi-subagents 0.79.1**, macOS arm64다. 다른 버전·OS는 이 검증에 포함하지 않았으며 사용자의 환경에서 별도 로딩·실행 확인이 필요하다.

## 에이전트 구성

| 역할 | 책임 |
|---|---|
| `orchestrator` | 요청 이해, 직접 작업 또는 위임 판단, 결과 통합과 최종 완료를 책임진다. |
| `task` | 기존 설계와 관례를 따르는 일반 구현을 조사부터 확인까지 담당한다. |
| `sonic` | 규칙과 예외가 정해진 기계적 변경·자료 수집을 담당한다. |
| `scout` | 위치를 모르는 코드와 자료를 읽기 전용으로 탐색한다. |
| `deep` | 원인이 불명확한 결함과 설계 판단이 필요한 구현을 담당한다. |
| `reviewer` | 정확성·호환성 결함을 읽기 전용으로 검토한다. |
| `security-reviewer` | 인증·인가·secret·외부 입력 경계를 읽기 전용으로 검토한다. |
| `image-analyst` | 원본 이미지를 관찰하고 텍스트 결과와 증거 경로만 반환한다. |

메인은 조율만 하지 않는다. 작은 작업은 직접 처리하고, 위임은 불확실성·위험·독립성과 실제 이익을 기준으로 결정한다. 작업자는 재위임하지 않으며 메인이 통합과 완료를 책임진다. 모든 작업에 전문가 팀이나 고정 리뷰 단계를 요구하지 않는다.

## 원본과 개인 설정

```text
agent/AGENTS.md               # 공통 메인 오케스트레이터 정의
agent/agents/*.md             # 공통 서브에이전트 7개 정의
config.example.yaml          # 공개 설정 예제
config.local.yaml            # 개인 모델·effort·정의 매핑; gitignore
.local/                      # 개인 정의 파일; gitignore
scripts/install.sh           # OMP/pi 설정 변환·설치 진입점
INSTALL.md                   # AI용 설치·검증·원복 절차
```

전체 예제는 [`config.example.yaml`](config.example.yaml)이다. 개인 파일이 없을 때만 `config.local.yaml`로 복사한다.

```yaml
version: 1
concurrency: 3
agents:
  orchestrator:
    description: Coordinate and complete the requested work.
    definition: agent/AGENTS.md
    model: inherit
    effort: inherit
  task:
    description: Implement one cohesive change.
    definition: agent/agents/task.md
    model: inherit
    effort: {omp: medium, pi: inherit}
    tools:
      omp: [read, grep, glob, bash, eval, edit, write]
      pi: [read, bash, edit, write, grep, find, ls]
```

- `definition`은 YAML 디렉터리 안의 상대 Markdown 경로다. 절대 경로, `..`, 바깥을 가리키는 링크는 허용하지 않는다. 개인 정의는 `.local/`에 둘 수 있다.
- `model`은 `inherit` 또는 정확한 `provider/model-id`다. `effort`는 별도로 `inherit`, `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` 중 지원되는 값을 선택한다.
- `model`·`effort`에 `{omp: 값, pi: 값}`을 지정하면 환경별 provider ID와 지원 수준을 구분할 수 있다.
- 메인은 모델·effort를 둘 다 `inherit`로 유지하거나 둘 다 명시한다. 명시적 값은 새 세션의 시작값이다.
- OMP 작업자의 effort는 명시해야 한다. pi의 `effort: inherit`는 `thinking`을 생략한다. 사용자 `subagents.defaultThinking`이 있으면 부모 effort 상속과 충돌하므로 설치를 거부하고 결정을 요구한다.
- pi의 사용자 role override가 생성할 정의를 덮어쓰는 경우에도 자동 삭제하거나 무시하지 않고 중단한다. 기존 설정과 YAML을 먼저 조정한다. 프로젝트별 override와 실제 로딩값은 작업 디렉터리에서 확인해야 한다.
- API key·OAuth token은 YAML에 넣지 않는다. 인증은 각 클라이언트가 관리한다. 개인 YAML과 `.local/`은 push하지 않는다.

## 환경별 적용

| 항목 | OMP | pi + pi-subagents |
|---|---|---|
| 메인 지침 | `AGENTS.md` 관리 구역 | `AGENTS.md` 관리 구역 |
| 작업자 정의 | `extensions/agent-config/agents/*.md` | `agents/*.md` |
| 모델·effort | 네이티브 model selector·thinkingLevel | 플러그인의 `model`·`thinking` frontmatter |
| 실행 도구 | `task` | `subagent` / 필요 시 `subagents_enable` |
| 후속 작업 | OMP의 작업자 관리 기능 | 플러그인의 상태·steer·resume·supervisor 기능 |
| 동시 실행 설정 | `task.maxConcurrency` | native run의 `globalConcurrencyLimit`·`parallel.concurrency` |

pi의 `concurrency`는 **한 run 내부의 기본 제한**이다. 서로 독립된 여러 run을 포괄하는 새 전역 제한을 만들지 않으며, 네이티브 호출별 override까지 보안 경계로 차단한다고 주장하지 않는다. 플러그인의 다른 기능과 설정은 보존한다.

pi 작업자는 새 문맥을 기본으로 하고 프로젝트 지침과 사용 가능한 skill을 읽는다. 전역 메인 지침은 상속하지 않으며 재위임은 금지한다. 확장 로딩·진행 표시·비동기 실행·출력 관리는 플러그인 계약을 따른다. 이미지 입력과 브라우저 기능은 선택 모델 및 실제 제공 도구의 능력을 확인해야 한다.

## 직접 설치하기

Node.js 22 이상, npm과 대상 클라이언트가 필요하다. pi 자체가 요구하는 Node.js 최소 버전도 충족해야 한다.

```sh
npm ci --omit=dev --ignore-scripts
# config.local.yaml이 없는 경우에만 복사하고 개인 설정을 작성한다.
cp config.example.yaml config.local.yaml

./scripts/install.sh --client omp --dry-run
./scripts/install.sh --client omp
```

pi는 먼저 같은 프로필에 지원 플러그인이 설치되어 있어야 한다. 기존 호환 설치는 재사용한다.

```sh
pi install npm:pi-subagents@0.79.1
./scripts/install.sh --client pi --dry-run
./scripts/install.sh --client pi
```

표준 npm 설치는 `<agent-dir>/npm/node_modules/pi-subagents`에서 확인한다. git/local 설치는 `--pi-subagents-dir /absolute/plugin/root`를 지정한다. 이 옵션은 **기존 플러그인을 확인하는 경로**이지 플러그인을 새로 로딩하는 옵션이 아니다. 실제 활성화는 pi 설정과 새 세션에서 확인한다.

대상 경로는 `--agent-dir` > `PI_CODING_AGENT_DIR` > `~/.omp/agent` 또는 `~/.pi/agent` 순서다. `--client`는 필수다. 기존 지침과 무관한 설정을 보존하며, 관리 파일 충돌은 덮어쓰지 않는다. YAML·정의를 수정하면 재설치하고 새 세션을 연다.

## 이전 설치에서 전환·제거

이전 자체 pi 어댑터가 설치되어 있다면 같은 대상·설치 상태를 사용해 재설치한다. 설치기가 소유한 `extensions/agent-config/index.ts`와 `config.json`은 제거하고 플러그인 정의로 전환한다. 해당 파일이 변경됐거나 소유 기록이 없으면 임의로 삭제하지 않는다. **기존 pi-subagents 패키지는 교체·삭제하지 않는다.**

```sh
./scripts/install.sh --client pi --uninstall --dry-run
./scripts/install.sh --client pi --uninstall
```

제거는 이 저장소의 정의와 관리한 설정만 대상으로 한다. 플러그인 자체는 유지한다. 상세 복구 절차는 [설치 안내](INSTALL.md#갱신과-제거)에 있다. 오래된 OMP 링크 설치도 새 설치 실행이 필요하며, 그 전에는 소스 변경의 영향을 받을 수 있다.

## 검증과 출처

```sh
npm ci --ignore-scripts
npm test
```

개발 의존성은 실제 pi와 pi-subagents를 고정해 통합 검사에 사용한다. 제품 설치에는 포함할 필요가 없다. 회귀 검사는 설정·개인 지침 보존과 전환을 확인하고, 통합 검사는 실제 pi CLI에 실제 플러그인을 설치해 작업자 실행 경로를 확인한다. 로컬 endpoint 검증을 상용 모델의 답변 품질 평가로 설명하지 않는다.

[변경 이력](CHANGELOG.md) · [참고 자료와 차용 고지](REFERENCES.md)

`agent/upstream/`과 `plans/`는 과거 자료이며 실행·설치 대상이 아니다. 원격 설정·commit·push는 설치기 동작에 포함되지 않는다.
