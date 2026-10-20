# Agent Config

**OMP의 내장 에이전트 이름·기능을 그대로 사용하고, 개인 모델 정책과 추가 역할을 관리하며, pi에도 대응 역할을 적용하는 설정 저장소다.**

실행은 OMP의 네이티브 `task`와 기존 [`nicobailon/pi-subagents`](https://github.com/nicobailon/pi-subagents)에 맡긴다. 자체 실행기·스케줄러를 만들지 않으며 기본 역할을 일괄 비활성화하거나 이름을 바꾸지 않는다.

## AI에게 설치 맡기기

```text
https://github.com/jaeryun/agent-config 를 내 환경에 적용해 줘.
README.md와 INSTALL.md를 읽고 OMP인지 pi인지 실제 런타임을 확인해.
기존 개인 설정과 인증을 보존하고 config.local.yaml을 준비해 줘.
OMP에서는 내장 역할을 덮어쓰지 말고 모델·effort 배정만 연결해.
pi에서는 기존 nicobailon/pi-subagents에 대응 역할을 등록해.
저가 비전 역할에는 내 환경에서 사용할 수 있는 저가 이미지 지원 모델을 배정해.
특정 브라우저나 도구에 역할을 한정하지 마.
dry-run 후 적용하고, 실제 역할 출처·모델·effort·도구 로딩을 확인해.
실제 모델 호출까지 검증했는지와 미확인 항목을 구분해서 보고해 줘.
```

지원 대상은 **OMP**와 **pi + npm:pi-subagents**다. 다른 동명 플러그인은 같은 계약으로 취급하지 않는다. AI용 전체 절차는 [INSTALL.md](INSTALL.md)에 있다.

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

모델·effort는 개인 YAML에서 고른다. 예제의 `inherit`는 환경 중립적인 시작값일 뿐, 이미지 지원이나 더 낮은 비용을 보장하지 않는다. **비용 분리를 위해 사용하기 전에는 실제 사용할 수 있는 저가 비전 모델을 명시해야 한다.**

## 파일과 설정 원본

```text
agent/AGENTS.md                    # 메인의 작업 배분·완료 정책
agent/agents/{task,sonic,...}.md    # 일반 역할 5개는 pi용 OMP 대응 정의
agent/agents/deep.md               # 양쪽에 설치하는 추가 역할
agent/agents/image-analyst.md      # 양쪽에 설치하는 저가 비전 역할
agent/upstream/oh-my-pi/           # 고정 원본·출처·MIT 고지
config.example.yaml               # 공개 v2 예제
config.local.yaml                 # 개인 YAML; gitignore
.local/                           # 개인 정의·비공개 백업; gitignore
scripts/install.sh                # 설정 변환·설치·제거 진입점
```

[`config.example.yaml`](config.example.yaml)을 개인 파일이 없을 때만 복사한다. **YAML 버전은 2**이며 설치기가 원본을 자동 수정하지 않는다.

```yaml
version: 2
concurrency: 3
agents:
  orchestrator:
    description: Coordinate and complete the requested work.
    definition: agent/AGENTS.md
    model: inherit
    effort: inherit
  task:
    description: General-purpose worker.
    definition: agent/agents/task.md
    model: {omp: native, pi: inherit}
    effort: {omp: native, pi: inherit}
    spawns:
      pi: "*"
    tools:
      pi: [read, bash, edit, write, grep, find, ls]
```

### 모델·effort

- OMP **내장 역할**의 `native`/`native`는 기존 native routing과 effort를 보존한다. 현재 부모 모델 상속과 같지 않다. 명시적 배정은 정확한 `provider/model-id`와 effort를 함께 지정한다. `task.agentModelOverrides.<name>`에 연결하며 역할 정의는 바꾸지 않는다.
- OMP **추가 역할**의 모델 `inherit`는 부모 모델을 사용한다. effort는 명시해야 한다.
- pi의 `model: inherit`는 활성 부모 모델을 사용하며, `effort: inherit`는 thinking을 생략한다. 기존 `subagents.defaultThinking`이나 역할 override와 충돌하면 자동 무시하지 않고 조정이 필요하다고 보고한다.
- 메인은 모델·effort를 둘 다 `inherit`로 유지하거나 둘 다 명시한다. 명시적 값은 새 세션의 시작 설정이다.
- 각 필드는 공통 문자열 또는 `{omp: 값, pi: 값}`으로 지정할 수 있다. 인증 정보는 넣지 않는다.

### 정의·도구·재위임

- `definition`은 YAML 디렉터리 안의 상대 Markdown 경로다. OMP 내장 이름에서는 **pi용 정의**로만 사용한다.
- 내장 역할의 `tools.omp`·`spawns.omp`는 거부한다. native 도구·권한을 덮어쓰거나 설정을 조용히 무시하지 않기 위해서다.
- 추가 역할에는 `tools.omp`·`tools.pi`를 지정한다. pi extension/MCP 도구는 실제 제공되는 이름과 필요한 extension을 확인한다.
- `spawns`는 환경별 `"*"` 또는 역할 이름 배열이다. 기본은 빈 배열이다. pi에서 grant가 있으면 네이티브 재위임 도구와 allowlist를 함께 연결하며 runtime depth/정책 제한은 유지한다.
- `extensions: {pi: ["./.local/browser-extension.ts"]}`로 이미 존재하는 자식용 extension을 지정할 수 있다. 경로는 YAML 기준으로 해석한다. 빈 배열은 ambient extension 비활성화이며 provider까지 빠질 수 있으므로 주의한다. 이 저장소가 extension을 다운로드하거나 구현하지 않는다.

## 적용 방식

| 항목 | OMP | pi + pi-subagents |
|---|---|---|
| 메인 지침 | `AGENTS.md` 관리 구역 | `AGENTS.md` 관리 구역 |
| 일반 역할 | 내장 정의 유지 | `agents/*.md`에 대응 정의 설치 |
| 추가 역할 | `extensions/agent-config/agents/*.md` | `agents/*.md` |
| 명시 모델 배정 | `task.agentModelOverrides` | `model`·`thinking` frontmatter |
| concurrency | `task.maxConcurrency` | native run의 `globalConcurrencyLimit`·`parallel.concurrency` |

OMP의 batch·async·재귀 깊이·effort 노출·advisor/prewalk/LSP 옵션은 강제하지 않는다. 기존 설치 manifest가 관리한 값이면 기록된 이전 값으로 복구한다. 이름을 유지하므로 기존 account pool·model scope 같은 이름별 정책을 임의로 옮기지 않는다.

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

v1 YAML과 이전 설치의 전환은 [INSTALL.md](INSTALL.md#기존-구성에서-v2로-전환)에 설명한다. 개인 YAML·정의를 수정하면 재설치하고 새 세션을 연다. 생성된 파일을 원본 대신 수정하지 않는다.

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
