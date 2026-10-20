# AI 설치 안내

지원 대상은 OMP와 pi + `nicobailon/pi-subagents`다. **OMP 내장 역할은 그대로 사용하고, pi에 대응 정의를 설치한다.** 기본 에이전트를 비활성화하거나 이름을 바꾸지 않는다. 별도 실행기·스케줄러·플러그인을 만들지 않는다.

**모델 배정은 설치 AI가 현재 환경을 조사하고 사용자와 합의하는 절차다.** 공개 YAML은 구조 예제이지 추천 모델 구성이나 즉시 적용할 기본값이 아니다. 아래 모델 비교·인터뷰를 마치기 전에 예제를 그대로 설치하거나 기존 개인 배정을 변경하지 않는다. CLI 설치기는 합의된 YAML을 변환할 뿐, 인터뷰·모델 추천·capability 검증을 자동 수행하지 않는다.

## 1. 대상과 현재 상태 확인

1. 실제 세션과 실행 파일로 클라이언트를 식별한다. PATH에 OMP와 pi가 모두 있다고 임의로 선택하지 않는다.
2. 대상 agent 디렉터리를 확인한다. 우선순위는 `--agent-dir` > `PI_CODING_AGENT_DIR` > `~/.omp/agent` 또는 `~/.pi/agent`다. 두 도구가 같은 환경변수를 쓰므로 경로만으로 클라이언트를 추정하지 않는다.
3. Node.js 22 이상과 npm이 필요하다. pi 자체의 더 높은 Node.js 최소 조건도 충족한다. 저장소가 없다면 사용자 소유 위치에 clone하고, 기존 checkout의 사용자 변경은 보존한다.
4. 기존 사용자 지침, 설정·모델·역할 override, 프로젝트의 동명 정의와 설치 manifest를 확인한다. 인증 파일 내용은 출력하거나 저장소에 복사하지 않는다.
5. pi에서는 `pi list`, 패키지 metadata와 활성 도구로 정확한 plugin identity를 확인한다. 지원 패키지는 `pi-subagents`이며 `@tintinweb/pi-subagents`, 공식 subagent 예제 등은 다른 구현이다. 지원 확인 범위는 0.79.x 중 0.79.1 이상, 실제 실행 확인은 pi 1.3.0 + pi-subagents 0.79.1이다. 다른 버전을 자동 교체하지 않는다.

지원 plugin이 없을 때는 같은 프로필에서 공식 설치 방식을 사용한다. 이미 설치된 호환 plugin은 재사용한다.

```sh
pi install npm:pi-subagents@0.79.1
```

이후의 profile 환경변수도 동일해야 한다. 설치기는 plugin을 다운로드하거나 활성화하지 않는다. 다른 plugin을 제거·교체하거나 인증·권한을 넓혀야 한다면 사용자 결정이 필요하다.

## 2. 등록 모델 비교와 사용자 인터뷰

### 2.1 현재 환경에서 후보 수집

사용자에게 모델 목록을 적어 달라고 하기 전에 설치 AI가 **대상 클라이언트의 같은 프로필·작업 디렉터리·provider extension·설정 overlay**에서 조회한다. `--agent-dir`는 이 저장소 설치기의 옵션이며 아래 CLI에 그대로 전달하지 않는다. 해당 클라이언트의 프로필 또는 `PI_CODING_AGENT_DIR`를 맞춘다. OMP와 pi를 함께 설치하면 각각 조회한다.

```sh
# OMP: 설치된 버전의 조회 옵션을 먼저 확인한다.
omp models --help
omp models --json

# pi: 설치된 버전의 조회 옵션을 먼저 확인한다.
pi --help
pi --list-models
```

- OMP 18.12.1의 JSON은 `models` 배열에 `provider`, `id`, `selector`, `input`, `reasoning`, `thinking`, context/output 한도와 cost metadata를 제공한다. 필드가 없거나 다른 버전이면 실제 출력과 해당 버전 문서를 따른다.
- pi에서는 native 모델 목록과 provider extension의 등록 정보를 사용한다. 목록에 없는 capability는 해당 provider/클라이언트의 공식 문서에서 확인한다. `/subagents-models`는 역할 배정 점검용이며 전체 provider 모델 목록을 대신하지 않는다.
- **카탈로그 등록, 인증 준비, 실제 호출 성공은 별개다.** 인증 상태는 credential을 노출하지 않는 native 상태 조회로 확인한다. pi 1.3.0은 `pi auth check`의 `--provider`, `--no-refresh`, `--json`을 지원한다. `--credentials`, token 출력·export 명령, 인증 파일 전체 출력은 사용하지 않는다. 상태 조회가 없으면 인증 준비 상태를 미확인으로 남긴다.
- 목록이 비어 있거나 필요한 provider가 없으면 프로필과 extension 로딩을 먼저 확인한다. 그래도 후보가 없으면 필요한 로그인/등록을 설명하고 해당 배정을 보류한다. 다른 클라이언트의 목록을 가져다 쓰거나 임의의 모델 ID를 만들지 않는다. 새 provider·유료 계정 추가는 사용자 승인 없이 진행하지 않는다.
- 정확한 `provider/model-id`를 비교 단위로 삼는다. 같은 이름의 모델도 provider에 따라 기능·한도·가격·reasoning 처리가 다를 수 있다. 이름에 `flash`, `mini`, `pro` 등이 있다는 이유만으로 빠름·저렴함·고성능을 단정하지 않는다.

### 2.2 사용자에게 운영 조건 확인

조회한 provider와 기존 역할 배정을 짧게 보여 준 뒤, 대화나 설정에서 이미 확인된 답은 재질문하지 않는다. 다음 중 **사용자만 결정할 수 있는 조건**을 묶어서 인터뷰한다. 질문 도구가 있으면 사용하고 없으면 일반 대화로 진행한다.

1. **비용·계정 범위:** 현재 구독/정액 계정 안에서만 사용할지, 기존 종량제 API도 사용할지, 추가 지출을 허용할지 확인한다. 추가 지출을 허용하면 예산과 실제 검증 호출의 허용 범위도 확인한다.
2. **작업과 우선순위:** 주로 하는 작업, 응답 지연과 판단 품질 중 우선할 것, 이미지 작업 빈도, 민감한 코드를 보낼 수 없는 provider가 있는지 확인한다. 실제 선택이 달라지는 항목만 질문한다.
3. **기존 선택의 유지 범위:** 현재 메인 모델 선택을 유지할지, 작업자 중 고정할 배정이 있는지 확인한다. 명시적으로 정한 기존 배정을 새 추천이라는 이유만으로 교체하지 않는다.

“모델을 무엇으로 할까요?”라고 목록 선정 책임을 사용자에게 넘기지 않는다. 반대로 사용자 답을 받지 않은 채 비용·계정 제한이나 품질 우선순위를 가정하지 않는다.

### 2.3 역할별 후보와 effort 비교

아래 기준으로 가용 후보를 추린다. 역할 이름은 요구 작업을 나타낼 뿐 특정 모델 계열이나 고정 effort를 의미하지 않는다.

| 역할 | 후보를 비교할 기준 |
|---|---|
| `orchestrator` | 직접 구현, 작업 분해, 결과 통합과 도구 사용의 안정성을 본다. 현재 세션 선택 유지를 우선 제안하되 사용자 의사를 확인한다. |
| `task` | 일반 구현과 검증을 끝까지 수행할 능력, 도구 호출 안정성, 필요한 재위임 수행 능력을 본다. |
| `sonic` | 정해진 변환의 정확성과 지시 준수를 충족하는 후보 중 지연·비용을 비교한다. 역할 이름만으로 최저 effort를 강제하지 않는다. |
| `scout` | 검색 도구 사용, 긴 코드/문서의 이해, 출처·누락·불확실성을 보고하는 능력을 본다. |
| `deep` | 불명확한 원인, 설계 대안과 불변 조건을 다루는 추론·구현 능력을 우선한다. |
| `reviewer` | 패치와 주변 코드 이해, 소비자 영향과 실제 결함의 구분, 오탐 억제를 본다. |
| `security-reviewer` | 신뢰 경계와 source-to-sink 추적, 악용 조건과 근거를 검토하는 능력을 본다. 이름만으로 보안 전문성을 보장하지 않는다. |
| `image-analyst` | **이미지 입력 지원**과 필요한 도구 사용을 먼저 확인한다. OCR·화면 비교 등 실제 과업 적합성과 부모 대비 비용/사용 한도를 비교한다. |

각 역할에 유효한 후보가 여럿이면 2~3개를 추천·대안으로 제시하고, 하나뿐이면 그 사실을 밝힌다. 같은 후보군은 묶어서 설명하되 모든 역할의 최종 배정은 개별 행으로 보여 준다. OMP 전용 `seance`는 기본적으로 기존 native 선택을 유지한다.

비교표에는 다음 내용을 포함한다.

- 정확한 provider/model, 기존 배정과의 차이, 역할에 맞는 이유와 단점.
- 이미지 입력, 필요한 도구 호출, context/output 한도, 해당 provider에서 지원하는 effort. **`reasoning: true`만으로 모든 effort를 지원한다고 해석하지 않는다.** 두 클라이언트의 지원 범위를 각각 확인하고 `high`를 모델 간 동일한 계산량·품질로 취급하지 않는다.
- 비용과 지연의 근거. API 가격은 단위·입출력·캐시 조건과 확인 날짜/출처를 함께 적는다. 구독은 사용 한도·추가 과금 여부를 별도로 비교하며 API 단가를 구독 청구액으로 환산하지 않는다. 카탈로그의 가격 0 또는 누락을 무료로 해석하지 않는다.
- **확인된 사실 / 출처에 기반한 적합성 판단 / 미확인 항목**을 구분한다. 로컬 metadata와 provider 공식 문서를 우선하고, 품질·지연 비교에 다른 자료를 쓰면 모델 버전과 과업 차이를 밝힌다. 근거가 없으면 순위·절감률을 만들어 내지 않는다.

effort는 모델과 함께 추천한다. 미지원 수준을 설치기에 넣고 런타임이 알아서 낮출 것이라고 기대하지 않는다. 비추론 모델도 해당 클라이언트가 지원하는 비추론 설정을 확인한다. 확인할 수 없는 조합은 확정하지 말고 검증 또는 보류 대상으로 표시한다.

저가 이미지 모델이 없으면 사용자에게 **현재 이미지 지원 모델을 비용 절감 주장 없이 사용 / 해당 역할 배정 보류 / 승인 후 provider 추가** 중 실제 가능한 선택을 제시한다. 이미지 미지원 부모의 `inherit`를 비전 해결책으로 제안하지 않는다. 배정 보류를 기존 native·사용자 역할의 자동 삭제나 비활성화로 처리하지 않는다.

### 2.4 배정안 합의 후 개인 YAML 작성

최종 표는 `역할 | 클라이언트 | 현재 배정 | 제안 provider/model 또는 유지 정책 | effort | 근거·미확인 항목`으로 제시한다. `native`나 `inherit`를 유지하면 가능한 범위에서 실제로 어떤 모델을 선택하는지도 보여 주고, 세션/설정 변경에 따라 바뀐다는 점을 설명한다.

사용자가 표를 승인하거나 명시적으로 위임한 선택 범위 안에서만 확정한다. 사용자가 일부를 변경하면 영향을 받는 행만 다시 합의한다. 답을 받을 수 없는 무인 실행에서는 미합의 배정을 적용하지 않고 후보와 필요한 결정을 반환한다. 매번 모든 질문을 반복하지 않으며, 이후 재설치는 기존 합의를 보존하고 후보 소멸·비용 정책 변경 등 달라진 항목만 확인한다.

합의한 뒤 기존 개인 YAML을 비공개 위치에 백업하고 변경한다. 양쪽 환경에서 같은 조합을 사용할 수 있을 때만 공통 문자열을 쓰고, 다르면 `{omp: 값, pi: 값}`으로 나눈다. API key·token이나 인터뷰 원문을 YAML에 넣지 않는다. 선택 이유와 검증 상태는 완료 보고에 남긴다.

## 3. 개인 설정 형식

```sh
npm ci --omit=dev --ignore-scripts
```

개발 의존성은 검사에 필요한 실제 pi/plugin이며 사용자 실행기를 바꾸는 것이 아니다. 기존 `config.local.yaml`을 우선하고, 없을 때만 `config.example.yaml`을 작성용 초안으로 복사한다. **초안의 `native`·`inherit`·`medium`은 모델 추천이 아니며 인터뷰 결과에 따라 유지 여부까지 확정해야 한다.** 개인 YAML과 `.local/`은 gitignore되어야 한다.

### 설정 버전 2

- `version: 2`, `concurrency`, `agents`를 사용한다. `orchestrator`는 필수이며 나머지 선언은 해당 역할의 설정/설치 대상이다. 선언하지 않은 native 역할까지 비활성화하지 않는다.
- `definition`은 YAML 디렉터리 안의 상대 Markdown 경로다. 절대 경로·`..`·외부로 향하는 링크는 허용하지 않는다. 개인 정의는 `.local/`에 둘 수 있다.
- `model`, `effort`는 공통 문자열 또는 `{omp: 값, pi: 값}`이다. 모델은 정확한 `provider/model-id`를 사용하고 effort를 문자열에 합치지 않는다. 인증 정보는 넣지 않는다.
- 메인은 두 값을 모두 `inherit`로 두어 기존 시작 설정을 보존하거나 둘 다 명시한다. 실행 중인 모델 선택을 강제로 바꾸지 않는다.

### OMP 내장 역할

`task`, `sonic`, `scout`, `reviewer`, `security-reviewer`, `seance`는 내장 이름이다.

- `model: native`, `effort: native`는 기존 native model role/override와 effort를 그대로 둔다. **현재 부모 모델 상속과 다른 의미**다.
- 명시적 배정은 모델과 effort를 함께 지정한다. `task.agentModelOverrides.<name>`에 연결한다. `native`와 명시적 값, 또는 `inherit`를 섞지 않는다.
- `definition`과 `tools.pi`는 pi 대응 정의용이며 OMP에는 설치하지 않는다. `tools.omp`와 `spawns.omp`는 native 기능을 덮어쓰는 의미이므로 거부한다.
- seance는 OMP에 남기며 fake pi 정의를 만들지 않는다. pi에 적용하는 YAML에는 seance를 선언하지 않는다. 기본 예제는 seance를 관리하지 않으므로 OMP의 기존 설정이 그대로 남는다.
- native 프롬프트·도구·출력 schema·nested spawn policy는 OMP가 소유한다. installer는 batch·async·재귀 깊이·effort 노출·LSP·advisor/prewalk를 일괄 강제하지 않는다.

### 추가 역할과 pi 대응 정의

- deep과 image-analyst 등 추가 역할은 양쪽에 사용자 정의로 설치한다. OMP custom 모델 `inherit`는 부모 모델을 사용하지만 effort는 명시해야 한다.
- pi 모델 `inherit`는 부모 모델을 선택하고 effort `inherit`는 native `thinking`을 생략한다. `subagents.defaultThinking` 또는 역할 override가 해당 의미와 충돌하면 먼저 조정한다.
- `tools`는 실제 제공되는 도구의 환경별 목록이다. pi에서는 extension/MCP 도구의 공급자가 자식에도 로딩되는지 확인한다. 빈 pi 도구 목록이 native defaults로 확대될 수 있으므로 비어 있지 않은 목록을 사용한다.
- `spawns: {pi: "*"}`는 허용된 범위의 일반 위임, `spawns: {pi: [scout]}`는 scout만 위임하는 설정이다. OMP custom은 `spawns.omp`를 사용한다. 생략 시 추가 역할의 재위임은 허용하지 않는다. 네이티브 depth·capability 제한을 완화하지 않는다.
- pi grant는 `allowNestedSubagents`와 explicit 도구 allowlist의 `subagent`를 함께 설정한다. 비어 있지 않은 역할 목록만 native `allowedAgents`에 기록한다. OMP의 출력 schema를 pi `output` 필드에 복사하지 않는다. pi의 그 필드는 출력 파일 경로다.

기존 extension을 자식에 명시적으로 연결해야 한다면 다음처럼 선언한다.

```yaml
extensions:
  pi:
    - ./.local/browser-extension.ts
```

경로는 YAML 기준으로 해석해 존재하는 절대 경로로 설치한다. 파일 또는 plugin이 허용하는 디렉터리다. 미설치 도구를 가정하거나 이 저장소가 새 extension을 작성하지 않는다. `extensions: {pi: []}`는 ambient extension을 끈다는 뜻이며 provider extension까지 사라질 수 있다. 실제 자식 로딩을 확인한다.

### 저가 비전 배정

- image-analyst에는 실제 가용한 저가 이미지 입력 모델과 적절한 effort를 고른다. 예제의 inherit는 bootstrap 값이지 이미지 지원·더 낮은 가격의 보장이 아니다. 같은 고가 모델을 상속해 놓고 비용이 분리됐다고 보고하지 않는다.
- 메인이 비전을 지원해도 반복적인 이미지/화면 처리량이 많으면 위임할 수 있다. 단발성 이미지는 메인이 직접 처리할 수 있다.
- 특정 도구나 브라우저로 한정하지 않는다. 실제 제공된 도구와 권한 안에서 읽기·캡처·필요한 조작을 수행하고 결과·미확인 항목·증거 경로를 전달한다. 모든 원본과 로그를 메인에 재주입하지 않는다.
- 기능 부재나 불확실성을 숨기거나 더 비싼 모델로 조용히 전환하지 않는다. 검수 범위를 줄여 비용을 아끼지 않는다.

## 기존 구성에서 v2로 전환

1. **개인 YAML을 비공개 위치에 백업한다.** 원본 모델·effort·개인 정의 경로를 기록하되 공개 문서에 credential을 넣지 않는다. installer가 source YAML을 자동 변경한다고 가정하지 않는다.
2. `version`을 2로 바꾸고 내장 5개 역할의 `tools.omp`를 제거한다. definition은 pi용으로 유지한다. 기존의 명시적 모델·effort 값은 그대로 둔다.
3. 기존 v1의 내장 `inherit`를 아무 설명 없이 `native`로 치환하지 않는다. 기존 routing을 그대로 쓰려면 native/native를, 특정 모델을 사용하려면 명시적 pair를 선택한다. 부모 선택의 자동 상속과 같은 동작이라고 설명하지 않는다.
4. pi task의 `spawns.pi: "*"`, reviewer의 `spawns.pi: [scout]` 등 필요한 native 대응 grant를 확인한다. 개인 도구 정책을 보존하고, 명시적으로 필요한 권한만 부여한다. 읽기 전용 reviewer의 bash 사용은 diff 조회 정책이지 기술적인 쓰기 sandbox가 아니다.
5. 같은 설치 대상과 private state를 사용해 dry-run/reinstall한다. 기존 manifest가 소유한 OMP 내장 동명 파일만 제거하고, 이전에 강제했던 native 옵션은 기록된 before 값으로 복구한다. 다른 사용자 파일이나 외부 수정이 있으면 중단한다.
6. manifest보다 오래된 symlink 설치는 알려진 repo 링크만 처리한다. 원래 값의 소유 기록이 없는 설정을 “이전 installer가 바꿨을 것”이라고 추정해 reset하지 않는다. 필요한 복원은 사용자 설정과 이력을 대조해 승인된 범위에서 처리한다.

설치 manifest는 기존 버전 1 형식을 유지해 이전 기록을 읽는다. YAML 버전 1은 명시적인 전환 안내와 함께 거부한다. source 편집과 OMP/pi 두 대상은 하나의 원자적 트랜잭션이 아니므로 부분 적용 상태를 구분해서 보고한다.

## 4. 적용

2절에서 합의한 배정만 적용한다. dry-run 성공은 모델 선택의 적합성·인증·가격·effort 지원을 확인했다는 뜻이 아니다. 미합의 항목은 보류하고 적용 가능한 범위를 사용자에게 명확히 알린다.

```sh
./scripts/install.sh --client omp --dry-run
./scripts/install.sh --client omp

# 대상이 pi인 경우
./scripts/install.sh --client pi --dry-run
./scripts/install.sh --client pi
```

표준 npm plugin은 `<agent-dir>/npm/node_modules/pi-subagents`에서 확인한다. git/local 설치라면 `--pi-subagents-dir /absolute/package/root`를 지정한다. 이 경로 확인은 실제 pi의 패키지 활성화를 대신하지 않는다. `--config`와 `--agent-dir`를 지정했다면 dry-run과 실제 적용에 같은 옵션을 쓴다.

기존 지침은 `AGENTS.md` 관리 구역만 갱신한다. 생성 파일·설정의 무관한 값은 보존하고 충돌을 무시하지 않는다. 설치 결과는 복사본이므로 source 변경 뒤 다시 설치하고 새 세션을 열어야 한다.

## 5. 실제 적용 확인

### OMP

- 내장 task/scout/reviewer 등의 실제 출처가 `bundled`인지 확인한다. 프로젝트·사용자·다른 extension의 동명 정의가 우선할 수 있으므로 실제 작업 디렉터리에서 확인한다. 다른 사용자 정의를 임의로 삭제하지 않는다.
- 추가 역할은 `<agent-dir>/extensions/agent-config/agents/`와 해당 extension 경로 등록으로 로딩한다. OMP 18.12.1의 기본 사용자 역할 발견은 `PI_CODING_AGENT_DIR`과 다를 수 있어 이 방식을 사용한다.
- native batch·재귀·출력·통신 계약을 그대로 따른다. 일괄적인 재위임 금지나 특정 batch 입력 모양을 강제하지 않는다. seance·Vibe 등 native 기능을 disable/rename하지 않는다.
- native 모델 fallback과 thinking 조정 가능성은 남는다. 명시적 요청과 실제 resolved model/effort가 다르면 적용 성공으로 보고하지 않는다.

### pi + pi-subagents

- `/subagents-doctor`, `/subagents-models`, `subagent({action:"list", options:{agentScope:"user", capabilities:true}})` 등으로 실제 정의와 오류를 확인한다. plugin 자체의 내장 역할 목록을 전부 끄지 않는다. 같은 이름의 사용자 대응 정의는 내장보다 우선한다.
- 도구는 native `subagent`이며 필요하면 `subagents_enable`로 활성화한다. 단일 호출은 `{agent, task, async:false, options:{context:"fresh"}}` 형태다. context는 문맥 문자열이 아니라 fresh/fork 등의 선택값이다.
- 병렬·체인·상태·steer/resume는 설치된 plugin의 workflow 계약을 따른다. OMP 통신 URI나 이전 자체 adapter의 입력을 사용하지 않는다.
- project/provider/role override와 modelScope·depth·capability ceiling을 확인한다. installer가 기존 제한을 풀거나 해당 기능을 새로 구현하지 않는다.

### 완료 보고

클라이언트·plugin 버전, YAML·대상 경로, 역할 출처, 합의한 배정과 선택 이유, 요청/실제 모델·effort, 기존 설정 보존과 백업 위치, 미확인 항목을 구분해 보고한다. 사용자와 합의한 호출·비용 범위에서 실제 읽기 전용 작업과 필요한 이미지 입력을 실행해 결과 반환을 확인한다. 검증용 입력에는 비밀이나 민감한 코드를 넣지 않는다.

모델·effort·provider가 합의와 다르거나 이미지/도구 입력에 실패하면 해당 배정의 검증 실패로 보고한다. 임의의 다른 모델로 성공할 때까지 반복하지 않고 원인과 대안을 설명해 변경 배정을 합의한다. 실호출을 허용하지 않은 경우 파일 설치와 로딩까지만 확인하고 **실행 미검증**으로 보고한다. 소규모 호출 성공을 역할 전체의 품질 검증으로 확대하지 않는다.

비용이 드는 상용 모델 요청과 로컬 endpoint 검증은 다르다. 파일 설치·정의 로딩·도구 실행·모델의 판단 품질을 혼동하지 않는다. 실제 모델 호출을 하지 않았다면 그렇게 명시하며 비용 절감률을 실측한 것처럼 쓰지 않는다.

## 갱신과 제거

```sh
./scripts/install.sh --client pi --uninstall --dry-run
./scripts/install.sh --client pi --uninstall
```

OMP는 `--client omp`를 사용한다. 제거에는 source YAML이나 plugin 패키지가 필요하지 않다. 설치기가 관리한 파일·지침 구역·설정만 원복하고 plugin·인증·세션은 유지한다. 수정된 managed 값은 자동 덮어쓰지 않는다.

상태와 백업은 `${XDG_STATE_HOME:-$HOME/.local/state}/agent-config/<대상 경로 해시>/`에 있다. `journal.json`이 원본 백업과 대상 파일을 연결한다. SIGKILL·전원 장애의 자동 원복은 보장하지 않는다. 남은 잠금은 owner 프로세스 종료와 실제 파일·백업을 확인한 뒤 처리한다. 비공개 백업과 빈 디렉터리는 남을 수 있다.

설치기 자체는 Git 원격 설정·commit·push를 수행하지 않는다.
