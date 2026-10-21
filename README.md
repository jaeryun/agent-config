# Agent Config

**OMP의 내장 에이전트 이름·기능을 그대로 사용하고, 개인 모델 정책과 추가 역할을 관리하며, pi에도 대응 역할을 적용하는 설정 저장소다.**

실행은 OMP의 네이티브 `task`와 기존 [`nicobailon/pi-subagents`](https://github.com/nicobailon/pi-subagents)에 맡긴다. 자체 실행기·스케줄러를 만들지 않으며 기본 역할을 일괄 비활성화하거나 이름을 바꾸지 않는다.

## AI에게 설치 맡기기

```text
https://github.com/jaeryun/agent-config 를 내 환경에 적용해 줘.
README.md와 INSTALL.md를 읽고 OMP인지 pi인지 실제 런타임을 확인해.
기존 개인 설정과 인증을 보존해.
현재 프로필의 provider에 등록된 모델을 직접 조회하고, 역할별 후보를 비교해 줘.
비용·구독 한도·지연·품질·이미지 지원·지원 effort의 근거와 미확인 항목을 구분해.
내 사용 목적과 비용/계정 제약을 인터뷰하고, 역할별 provider/model과 effort 배정안을 보여 줘.
내가 동의한 배정만 config.local.yaml에 반영해. 예제를 추천 구성으로 간주하지 마.
메인은 시작 기본값이 될 첫 항목과 Ctrl+P 순서를 정한 모델 목록으로 합의해.
작업자에는 실제 등록된 provider/model과 지원 effort를 직접 적고, 자동 선택에 맡기는 값은 쓰지 마.
OMP에서는 내장 역할을 덮어쓰지 말고 모델·effort 배정만 연결해.
pi에서는 기존 nicobailon/pi-subagents에 대응 역할을 등록해.
저가 비전 후보가 없으면 같은 모델을 재사용해 해결됐다고 하지 말고 대안을 나와 정해.
특정 브라우저나 도구에 역할을 한정하지 마.
dry-run 후 합의한 설정을 적용하고, 허용한 호출·비용 범위에서 실제 역할 출처·모델·effort·도구 로딩을 확인해.
실제 모델 호출까지 검증했는지와 미확인 항목을 구분해서 보고해 줘.
```

지원 대상은 **OMP**와 **pi + npm:pi-subagents**다. 다른 동명 플러그인은 같은 계약으로 취급하지 않는다. AI용 전체 절차는 [INSTALL.md](INSTALL.md)에 있다.

### 설치 AI가 모델을 정하는 순서

1. **환경 조회:** OMP는 `omp models --json`, pi는 `pi --list-models` 등 해당 버전의 native 조회로 현재 프로필의 후보를 수집한다. 등록·인증 준비·실제 호출 성공을 구분하며, 사용자가 모델 목록을 다시 작성하게 하지 않는다.
2. **사용자 인터뷰:** 기존 배정을 보여 주고 사용 목적, 품질/지연 우선순위, 구독·종량제 사용 범위와 추가 지출 허용 여부를 확인한다. 이미 정한 조건은 다시 묻지 않는다.
3. **역할별 비교:** 가능한 후보 2~3개의 정확한 `provider/model`, 지원 기능·effort, 비용 근거와 단점을 비교한다. 같은 모델 이름이라도 provider가 다르면 별도로 확인한다. 모델 이름이나 추정 가격만으로 순위를 정하지 않는다.
4. **배정안 합의:** 모든 역할의 현재 값과 제안 값을 표로 보여 준다. 메인은 시작 기본값과 Ctrl+P 순서가 되는 목록으로 합의하고, 작업자는 고정 배정으로 합의한다. 동의한 선택만 개인 YAML에 저장하며, 후보가 없거나 답을 받지 못한 항목은 임의로 채우지 않는다.
5. **적용 확인:** 합의한 범위에서 설치·실행을 확인한다. fallback이나 effort 변경을 성공으로 처리하지 않으며, 호출하지 않은 모델은 실행 미검증으로 보고한다.

구체적인 역할별 선정 기준과 인터뷰 절차는 [INSTALL.md의 모델 비교·인터뷰](INSTALL.md#2-등록-모델-비교와-사용자-인터뷰)를 따른다. **설치 AI의 필수 절차이며, 셸 설치기에 자동 추천이나 인터뷰 엔진을 추가한 것은 아니다.**

## 역할 구성

| 역할 | OMP | pi |
|---|---|---|
| `task` | 내장 범용 작업자 | OMP 기반 대응 정의. 허용된 범위에서 재위임할 수 있다. |
| `sonic` | 내장 기계적 작업자 | 정해진 변환·자료 수집을 담당한다. |
| `scout` | 내장 읽기 전용 탐색 | 검색 대안·조사 깊이·상세 보고 완결성을 유지한다. |
| `reviewer` | 내장 코드 리뷰, scout 위임 | 패치 결함·소비자 routing·심각도·위치·판정을 검토한다. scout 위임을 허용한다. |
| `security-reviewer` | 내장 보안 리뷰 | 비신뢰 데이터, source-to-sink, 방어·근거·검토 범위를 확인한다. |
| `seance` | 기존 native 과거 세션 상담 기능 | 이식하지 않는다. 프롬프트만으로 같은 기능이라고 주장하지 않는다. |
| `deep` | 추가 사용자 역할 | 원인·설계 판단이 어려운 구현을 끝까지 담당한다. |
| `image-analyst` | 추가 저가 비전 역할 | 같은 목적의 사용자 역할이다. |

OMP의 내장 5개 역할을 사용자 파일로 덮어쓰지 않는다. 내장 프롬프트·도구·출력 스키마·재위임 기능은 OMP가 소유한다. pi용 일반 역할은 OMP **18.12.1**의 의미를 바탕으로 작성했으며, [원본·버전·MIT 고지](agent/upstream/oh-my-pi/PROVENANCE.md)를 보존한다. pi의 반환·통신 문법은 기존 플러그인 계약을 사용한다.

다른 사용자·프로젝트 정의와 플러그인의 나머지 내장 역할은 임의로 삭제하거나 비활성화하지 않는다. 프로젝트·사용자 override 때문에 실제 출처가 달라질 수 있으므로 설치 후 확인한다.

## 저가 비전 역할

`image-analyst`는 특정 도구 전담 전문가가 아니라 **이미지·화면 처리량이 많은 작업의 비용을 분리하는 작업자**다.

- 메인이 비전을 지원하지 않으면 이미지 설명·OCR·관찰 근거를 제공한다.
- 메인이 비전을 지원해도 반복적인 이미지 비교·문서 이미지·화면/UX 순회는 위임할 수 있다. 단발성 이미지는 지원 모델이 직접 처리할 수 있다.
- 주어진 도구로 필요한 읽기·캡처·허용된 상호작용과 점검을 수행한다. Playwright는 가능한 사용 예이지 필수 의존성이나 역할 범위가 아니다.
- 메인에는 과업별 결과·미확인 항목·필요한 증거 경로를 전달한다. 모든 원본 이미지와 로그를 메인이 다시 소비하게 만들지 않는다.
- 시각적 관찰과 기능 성공 증거를 구분하고, 요청한 범위를 비용 때문에 생략하지 않는다. 더 비싼 모델로 조용히 fallback하지 않는다.

모델·effort는 설치 인터뷰로 합의해 개인 YAML에 정확한 값으로 명시한다. 예제의 모델 id와 effort는 한 개인 배포의 현재 등록 값을 구조 예시로 쓴 초안일 뿐, 이미지 지원·적정 effort·더 낮은 비용을 보장하지 않는다. **비용 분리를 위해 사용하기 전에는 실제 가용한 이미지 지원 모델과 비용 근거를 확인해야 한다.** 저가 후보가 없으면 현재 이미지 모델 사용, 해당 배정 보류, 승인 후 provider 추가 중 가능한 대안을 사용자와 정한다.

## 파일과 설정 원본

```text
agent/AGENTS.md                    # 메인의 작업 배분·완료 정책
agent/agents/{task,sonic,...}.md    # 일반 역할 5개는 pi용 OMP 대응 정의
agent/agents/deep.md               # 양쪽에 설치하는 추가 역할
agent/agents/image-analyst.md      # 양쪽에 설치하는 저가 비전 역할
agent/upstream/oh-my-pi/           # 고정 원본·출처·MIT 고지
config.example.yaml               # 공개 v3 구조 예제
config.local.yaml                 # 개인 YAML; gitignore
.local/                           # 개인 정의·비공개 백업; gitignore
scripts/install.sh                # 설정 변환·설치·제거 진입점
```

[`config.example.yaml`](config.example.yaml)은 추천 배정이 아닌 구조 예제다. 개인 파일이 없을 때만 작성용 초안으로 복사하고 설치 인터뷰 결과를 반영한다. **YAML 버전은 3**이며 설치기가 원본을 자동 수정하지 않는다.

```yaml
version: 3
concurrency: 3
agents:
  orchestrator:
    description: Coordinate and complete the requested work.
    definition: agent/AGENTS.md
    models:
      - model: openai-codex/gpt-6.1-sol
        effort: high
      - model: opencode-go/deepseek-flash
        effort: high
  task:
    description: General-purpose worker.
    definition: agent/agents/task.md
    model: opencode-go/deepseek-flash
    effort: high
    spawns:
      pi: "*"
    tools:
      pi: [read, bash, edit, write, grep, find, ls]
```

위 id는 한 배포의 현재 등록 값을 구조 예시로 쓴 것이며 추천 구성이 아니다.

### 메인 모델 선택과 Ctrl+P

- `agents.orchestrator.models`는 **순서 있는 목록**이다. 첫 항목이 새 세션의 시작 모델·effort다.
- Ctrl+P는 이 목록만 순환하며 **현재 세션의 메인 모델·effort만** 바꾼다. 선택은 세션에만 적용되고 설정 파일·작업자 배정·다른 사용자의 override를 다시 쓰지 않는다(native 기본 `persist=false`). 작업자는 메인 모델을 따라가지도 않는다.
- OMP는 각 항목을 `provider/model [effort]` 형태의 사람이 읽는 슬롯으로 만들고 YAML 순서대로 순환시킨다. 내장 model role 이름은 picker에서 숨겨진다.
- 설치기는 OMP 내장 15개 model role에 남아 있던 기존 배정을 제거하고 숨김 `default`만 첫 항목으로 다시 지정해 시작값을 공급한다. 예전 저장소가 만들던 `deep`·`review` alias도 제거 대상이다. 다른 비관리 값이 `@역할`·`pi/역할`·`*` 같은 alias로 참조하면 그 배정은 숨김으로 유지하고 stdout에 보고한다. 정리는 값 단위로 소유되므로 제거 시 기록된 이전 값이 복원된다.
- **숨김은 비활성화가 아니다.** 시작 기본값, 내부 helper의 자동 선택, 별도 소유 alias 소비자는 계속 동작하며 이 저장소는 내장 역할·task agent를 삭제하거나 끄지 않는다.
- pi는 새 세션의 시작 provider·model·thinking을 첫 항목에서 정하고 같은 목록을 Ctrl+P 순환 범위로 쓴다. 재개한 세션은 그 세션이 기록한 모델을 복원한다. pi의 순환 범위는 모델 단위라 같은 모델의 두 effort를 구분하지 못하므로, 메인 목록에 같은 모델을 두 번(어느 effort든) 나열하면 하나를 조용히 버리지 않고 실패한다. OMP는 같은 모델의 서로 다른 effort를 허용한다.

### 모델·effort

- 메인·작업자 모두 정확한 `provider/model-id`와 구체적인 effort를 명시한다. effort는 `off`·`minimal`·`low`·`medium`·`high`·`xhigh`·`max` 중 해당 클라이언트가 지원하는 값을 쓴다.
- `inherit`·`native`·`@alias`·glob(`*`, `?`, `[]`)·`:effort` 접미사가 붙은 모델은 메인·작업자 모두 거부한다. 메인 `models` 목록에 같은 model+effort 항목을 두 번 쓰면 거부한다. 작업자는 각자 별도 정의이므로 여러 역할이 같은 모델·effort를 써도 된다.
- 각 필드는 공통 문자열 또는 `{omp: 값, pi: 값}`으로 지정할 수 있다. 인증 정보는 넣지 않는다.
- OMP **내장 이름**의 배정은 `task.agentModelOverrides.<name>`에 연결한다. native 프롬프트·도구·출력 계약은 그대로 두며 `tools.omp`·`spawns.omp`는 거부한다.
- `orchestrator`는 `description`·`definition`·`models`만 받는다. `model`·`effort`·`tools`·`spawns`·`extensions`를 쓰면 v3 전환 안내와 함께 거부한다.

### 정의·도구·재위임

- `definition`은 YAML 디렉터리 안의 상대 Markdown 경로다. OMP 내장 이름에서는 **pi용 정의**로만 사용한다.
- 내장 역할의 `tools.omp`·`spawns.omp`는 거부한다. native 도구·권한을 덮어쓰거나 설정을 조용히 무시하지 않기 위해서다.
- 추가 역할에는 `tools.omp`·`tools.pi`를 지정한다. pi extension/MCP 도구는 실제 제공되는 이름과 필요한 extension을 확인한다.
- `spawns`는 환경별 `"*"` 또는 역할 이름 배열이다. 기본은 빈 배열이다. pi에서 grant가 있으면 네이티브 재위임 도구와 allowlist를 함께 연결하며 runtime depth/정책 제한은 유지한다.
- `extensions: {pi: ["./.local/browser-extension.ts"]}`로 이미 존재하는 자식용 extension을 지정할 수 있다. 경로는 YAML 기준으로 해석한다. 빈 배열은 ambient extension 비활성화이며 provider까지 빠질 수 있으므로 주의한다. 이 저장소가 extension을 다운로드하거나 구현하지 않는다.
- 개인 YAML이 모델·effort 배정의 원본이다. 기존 pi `subagents.agentOverrides`·`agentOverridesByProvider`나 OMP `task.disabledAgents`가 생성 정의와 충돌하면 조용히 덮어쓰지 않고 중단하며, 생성된 설정·정의 파일을 직접 수정하면 재설치 때 외부 변경으로 보고된다.

## 적용 방식

| 항목 | OMP | pi + pi-subagents |
|---|---|---|
| 메인 지침 | `AGENTS.md` 관리 구역 | `AGENTS.md` 관리 구역 |
| 메인 모델 선택 | `models` 순서대로 생성한 슬롯과 `cycleOrder` | `defaultProvider`·`defaultModel`·`defaultThinkingLevel`·`enabledModels` |
| 일반 역할 | 내장 정의 유지 | `agents/*.md`에 대응 정의 설치 |
| 추가 역할 | `extensions/agent-config/agents/*.md` | `agents/*.md` |
| 명시 모델 배정 | `task.agentModelOverrides` | `model`·`thinking` frontmatter |
| concurrency | `task.maxConcurrency` | native run의 `globalConcurrencyLimit`·`parallel.concurrency` |

OMP의 batch·async·재귀 깊이·effort 노출·advisor/prewalk/LSP 옵션은 강제하지 않는다. 기존 설치 manifest가 관리한 값이면 기록된 이전 값으로 복구한다. 이름을 유지하므로 기존 account pool·model scope 같은 이름별 정책을 임의로 옮기지 않는다. 설치기는 OMP의 `enabledModels`를 설정하지 않는다. 메인 선택 목록으로 좁히면 메인 풀 밖 모델을 쓰는 작업자(image-analyst 등)까지 제한될 수 있기 때문이다.

지원 확인 기준은 OMP 18.12.1, pi 1.3.0 + pi-subagents 0.79.1이다. pi plugin은 0.79.x 중 0.79.1 이상을 확인하며, 다른 패치·OS까지 실행 검증했다고 주장하지 않는다. OMP의 native 모델 fallback·effort 조정 가능성도 남으므로 실제 resolved 값을 확인해야 한다.

## 설치·갱신·제거

```sh
npm ci --omit=dev --ignore-scripts
# 개인 파일이 없을 때만 복사하고 환경에 맞게 편집한다.
cp config.example.yaml config.local.yaml

./scripts/install.sh --client omp --dry-run
./scripts/install.sh --client omp
```

pi는 같은 프로필에 지원 플러그인이 설치되어 있어야 한다. 기존 호환 설치는 재사용한다.

```sh
pi install npm:pi-subagents@0.79.1
./scripts/install.sh --client pi --dry-run
./scripts/install.sh --client pi
```

`--client`는 필수다. 대상은 `--agent-dir` > `PI_CODING_AGENT_DIR` > `~/.omp/agent` 또는 `~/.pi/agent` 순서다. git/local plugin 설치는 `--pi-subagents-dir`로 실제 패키지 루트를 지정한다. 이 옵션은 실제 pi 로딩 등록을 대신하지 않는다.

v1·v2 YAML과 이전 설치의 전환은 [INSTALL.md](INSTALL.md#기존-구성에서-v3로-전환)에 설명한다. 개인 YAML·정의를 수정하면 재설치하고 새 세션을 연다. 생성된 파일을 원본 대신 수정하지 않는다. 설치 후 Ctrl+P 목록이 YAML 순서와 같은지, 작업자 배정이 그대로인지 [확인](INSTALL.md#5-실제-적용-확인)한다.

```sh
./scripts/install.sh --client pi --uninstall --dry-run
./scripts/install.sh --client pi --uninstall
```

제거는 관리 파일과 설정만 원복하며 플러그인·인증·세션을 지우지 않는다. 백업·충돌·중단 복구의 범위는 설치 안내를 따른다.

## 검증과 출처

```sh
npm ci --ignore-scripts
npm test
```

개발 의존성의 실제 pi와 pi-subagents를 사용해 역할 실행·권한·이미지 전달·extension 실패를 검증한다. 모델 응답은 로컬 endpoint로 제어하며, 이를 실제 상용 모델의 판단 품질 평가나 비용 절감 실측으로 설명하지 않는다.

[변경 이력](CHANGELOG.md) · [참고 자료](REFERENCES.md) · [현재 구현 계획](plans/custom-agent-cutover.md)

과거 내장 비활성화·이름 변경 계획의 리뷰는 `plans/reviews/`에 역사적 기록으로 남긴다. 현재 구현의 승인이나 실행 검증을 대신하지 않는다. 설치기가 commit/push를 수행하지는 않는다.
