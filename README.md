# Agent Config

**메인 오케스트레이터와 전문 서브에이전트의 역할·행동·협업 체계를 정의하고, 개인 YAML을 기준으로 OMP와 pi에 적용하는 저장소다.**

에이전트 정의는 이 저장소가 소유한다. 모델·effort·활성 역할·개인 정의 경로는 gitignore된 `config.local.yaml`에서 관리한다. OMP나 pi의 설정 파일은 원본이 아니라 설치 결과물이다. 새로운 AI 클라이언트나 범용 오케스트레이션 엔진을 만드는 프로젝트는 아니다.

## AI에게 설치 맡기기

사용하는 **OMP 또는 pi**에 다음 요청을 전달한다.

```text
https://github.com/jaeryun/agent-config 를 내 환경에 설치해 줘.
README.md와 INSTALL.md를 읽고 현재 클라이언트가 OMP인지 pi인지 확인해.
기존 config.local.yaml이 있으면 사용하고, 없으면 예제를 바탕으로
내 사용 가능 모델과 선택을 반영해 작성해 줘.
기존 지침·인증·무관한 설정을 보존하고 dry-run 후 설치해.
새 세션의 지침·역할·도구 로딩을 확인하고, 실제 모델 호출 여부와
요청한 모델·effort가 적용됐는지를 구분해서 보고해 줘.
다른 모델이나 클라이언트로 임의 대체하지 마.
```

설치 AI가 따를 전체 계약은 [INSTALL.md](INSTALL.md)에 있다. 지원 환경은 **OMP와 pi 두 가지뿐**이다. 다른 클라이언트를 추측해서 지원하거나 OMP 설치기를 pi 디렉터리에 실행하지 않는다.

## 에이전트 구성

| 역할 | 책임 |
|---|---|
| `orchestrator` | 요청 이해, 직접 작업 또는 위임 판단, 작업 분배, 결과 통합, 최종 완료를 책임진다. |
| `task` | 기존 설계와 관례를 따르는 일반 구현을 조사부터 확인까지 담당한다. |
| `sonic` | 규칙과 예외가 정해진 기계적 변경·자료 수집을 담당한다. |
| `scout` | 위치를 모르는 코드와 자료를 읽기 전용으로 탐색한다. |
| `deep` | 원인이 불명확한 결함과 설계 판단이 필요한 구현을 담당한다. |
| `reviewer` | 정확성·호환성 결함을 읽기 전용으로 검토한다. |
| `security-reviewer` | 인증·인가·secret·외부 입력 경계를 읽기 전용으로 검토한다. |
| `image-analyst` | 원본 이미지를 관찰하고 텍스트 결과와 증거 경로만 반환한다. |

메인은 조율만 하지 않는다. 작은 작업은 직접 처리하고, 위임은 불확실성·위험·독립성과 실제 이익을 기준으로 결정한다. 작업자는 재위임하지 않으며, 메인이 통합과 완료를 책임진다. 모든 작업에 전문가 팀이나 고정 리뷰 단계를 요구하지 않는다.

## 원본과 개인 설정

```text
agent/
  AGENTS.md                  # 공통 메인 오케스트레이터 정의
  agents/*.md                # 공통 서브에이전트 7개 정의
  upstream/agency-agents/    # 이전 차용 원본·라이선스 기록; 설치하지 않음
config.example.yaml          # 공개 설정 예제
config.local.yaml            # 개인 모델·effort·정의 매핑; gitignore
.local/                      # 개인 정의 파일; gitignore
adapters/pi/index.ts         # pi의 별도 프로세스 위임 어댑터
scripts/install.sh           # OMP/pi 설치 진입점
INSTALL.md                   # AI용 설치·확인·원복 계약
```

`config.example.yaml`을 `config.local.yaml`로 복사한 뒤 사용한다. 별도의 YAML을 `--config`로 지정할 수도 있다. 아래는 역할 한 개의 설정 예시이며 전체 설치에는 `orchestrator`와 필요한 작업자를 포함한다.

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

- `definition`은 YAML 디렉터리 안의 상대 Markdown 경로다. 절대 경로, `..`, 디렉터리 밖을 가리키는 링크는 허용하지 않는다. 개인 역할을 추가하거나 `.local/`의 정의로 바꿀 수 있다. 클라이언트 전용 frontmatter는 원본에 넣지 않는다.
- `model`은 `inherit` 또는 정확한 `provider/model-id`다. `effort`는 별도 필드이며 `inherit`, `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` 중에서 지원되는 값을 선택한다.
- `model`·`effort`에는 `{omp: 값, pi: 값}`을 지정할 수 있다. provider ID나 지원 수준이 다를 때 사용한다.
- 메인의 모델·effort는 둘 다 `inherit`로 유지하거나 둘 다 명시한다. 명시적 메인 설정은 새 세션의 시작값으로 적용하며, 실행 중인 세션을 강제로 바꾸지 않는다.
- 작업자 모델의 `inherit`는 활성 메인 모델을 사용한다. **OMP 작업자의 effort는 명시해야 한다.** pi는 effort도 활성 메인에서 상속할 수 있다. 예제의 `medium`은 사용자 모델에 맞게 검토할 시작값이지 모든 모델의 지원 보장이 아니다.
- API key·OAuth token은 YAML에 넣지 않는다. 각 클라이언트의 인증 저장소를 사용한다.
- `config.local.yaml`과 `.local/`은 공개하지 않는다. 공통 정의와 설치 코드는 Git으로 관리한다. 설치 결과를 편집해도 원본 YAML로 역동기화되지는 않는다.

## 두 환경에서의 실행

| 항목 | OMP | pi |
|---|---|---|
| 메인 지침 | 사용자 `AGENTS.md` 관리 구역 | 사용자 `AGENTS.md` 관리 구역 |
| 작업자 정의 | `extensions/agent-config/agents/*.md`로 변환하고 확장 경로 등록 | 확장 옆 `config.json`으로 변환 |
| 호출 | 네이티브 `task` | `agent_config_task` 확장 |
| 실행 | OMP가 관리 | 같은 pi 실행 파일의 별도 프로세스 |
| 후속 작업 | OMP의 작업자 통신·재개 기능 | 이전 결과를 전달하는 새 호출 |
| 동시 실행 | `task.maxConcurrency` | 확장 전체의 동시 실행 제한 |
| 작업자 effort | 명시적 설정 | 명시적 설정 또는 활성 부모 상속 |

실제 실행 확인 버전은 OMP 18.12.1, pi 0.73.1(`@mariozechner`)·1.3.0(`@earendil-works`)이다. macOS arm64에서 확인했으며 Linux·Windows와 다른 버전은 이번 실행 검증에 포함하지 않았다. 설치 AI는 사용자의 실제 버전에서 로딩과 실행을 확인해야 한다.

pi는 서브에이전트를 기본 제공하지 않으므로 이 저장소가 필요한 위임 어댑터를 설치한다. 다른 서브에이전트 패키지를 임의로 선택하지 않는다. 작업자는 기본 도구만 사용하며 부모의 확장·skill·템플릿을 자동 상속하지 않는다. 따라서 OMP의 `agent://` 통신이나 부모의 브라우저 기능까지 동일하게 제공한다고 가정하지 않는다.

**모델·effort 확인은 설치와 별개다.** pi 작업자 어댑터는 등록 모델과 지원 effort를 검사하고 요청한 모델과 다른 응답을 실패로 처리한다. OMP 18.12.1의 네이티브 런타임은 인증 실패 시 모델 fallback, 미지원 effort 조정을 할 수 있다. 두 클라이언트의 메인 시작 설정도 네이티브 capability 처리를 따르므로 실제 로딩값을 확인해야 한다. 설치기는 이러한 런타임 동작을 차단한다고 주장하지 않는다.

## 직접 설치하기

Node.js 22 이상, npm과 대상 클라이언트가 필요하다. pi 자체가 더 높은 Node.js 최소 버전을 요구하면 그 조건도 충족해야 한다.

```sh
npm ci --ignore-scripts
cp config.example.yaml config.local.yaml
# config.local.yaml을 자신의 모델·effort에 맞게 편집한다.

./scripts/install.sh --client omp --dry-run
./scripts/install.sh --client omp
# pi 환경에서는 --client pi를 사용한다.
```

기존 `config.local.yaml`이 있으면 복사 명령으로 덮어쓰지 않는다. 대상 경로는 `--agent-dir` > `PI_CODING_AGENT_DIR` > `~/.omp/agent` 또는 `~/.pi/agent` 순서다. `--client`는 필수다.

- 기존 사용자 지침을 보존하며 이 저장소의 관리 구역만 갱신한다.
- 관리하는 설정만 병합하고 인증 파일과 무관한 개인 설정은 건드리지 않는다.
- 변경 파일의 비공개 백업과 설치 상태를 남기며, 재설치 시 동일한 결과물을 불필요하게 교체하지 않는다.
- dry-run은 대상·설치 상태를 변경하지 않는다. 충돌하는 사용자 변경은 조용히 덮어쓰지 않는다.
- 프롬프트·YAML을 바꾸면 다시 설치하고 새 세션을 연다. 설치 파일은 복사본이므로 checkout 변경이 자동으로 전역 지침을 바꾸지 않는다.

제거와 원복은 같은 클라이언트·대상 경로에 `--uninstall`을 사용한다. 자세한 절차와 충돌 처리는 [설치 안내](INSTALL.md#갱신과-제거)를 따른다.

## 이전 OMP 구성에서 전환

기존 `agent/config.yml`의 개인 모델 배정은 `config.local.yaml`로 옮긴다. 공개 예제에는 작성자의 모델을 고정하지 않는다. 기존 설정의 `tiny`·`commit` 같은 클라이언트 보조 role은 이 저장소의 작업자 정의가 아니므로 새 설치기가 임의로 관리하지 않는다.

이전 설치는 저장소 파일에 대한 심볼릭링크를 사용했다. 새 설치로 전환하기 전까지는 기존 링크가 남아 있으므로 소스 변경의 영향을 받을 수 있다. 새 설치기는 알려진 저장소 링크를 처리하되, 설치만으로 다른 사용자 소유 역할이나 규칙을 무조건 지우지 않는다. 실제 사용자 전역 환경의 마이그레이션은 별도 설치 실행이 필요하다.

## 확인과 기록

```sh
npm test
```

설치기 회귀 검사는 임시 디렉터리에서 기존 지침·설정 보존, dry-run, 원복 충돌 등을 확인한다. 실제 클라이언트 검증과 provider 호출 여부는 [변경 이력](CHANGELOG.md)에 구분해서 기록한다. 지침 로딩만으로 모델의 작업 품질·정책 준수·비용 절감을 입증했다고 주장하지 않는다.

설계 근거와 차용 원본의 고지는 [참고 자료](REFERENCES.md)에 있다. `plans/`는 과거 완료 기록이며 현재 설치 안내를 대신하지 않는다. 원격 설정·commit·push는 설치 동작에 포함되지 않는다.
