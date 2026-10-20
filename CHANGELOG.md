# 변경 이력

## 2026-10-20 · 설치 AI의 모델 비교와 사용자 인터뷰

### 변경

- 설치 AI가 대상 프로필의 등록 모델을 직접 조회하고 역할별 후보를 비교한 뒤, 비용·계정·작업 우선순위와 기존 배정 유지 범위를 사용자에게 확인하도록 INSTALL 절차를 추가했다.
- 모든 역할의 provider/model과 effort를 표로 제안하고 합의한 값만 개인 YAML에 반영한다. 무인 실행에서 미합의 값을 적용하거나 기존 배정을 임의로 교체하지 않는다.
- 이미지·도구 입력, 모델별 effort 지원, context 한도, API 가격과 구독 한도, 적합성 근거와 미확인 항목을 구분한다. 비전 후보 부재·모델 목록 부재·실행 검증 실패의 처리도 명시했다.
- README의 설치 요청문과 공개 YAML 주석을 수정했다. 공개 예제는 추천 배정이 아닌 인터뷰 전 초안이며, 셸 설치기가 자동 추천·인터뷰·capability 검증을 제공하는 것은 아니다.

### 확인 범위

- 실제 OMP 18.12.1의 `omp models --json`에서 모델 목록과 이미지 입력·thinking·가격 metadata를 확인했다.
- 실제 pi 1.3.0의 `--list-models`를 실행해 가용 모델이 없는 경우의 응답을 확인했고, native help에서 credential을 출력하지 않는 인증 확인 옵션을 확인했다.
- 공개 YAML로 OMP와 pi 설치 dry-run이 각각 성공했으며 대상 디렉터리가 생성되지 않았음을 확인했다. 개인 YAML과 전역 설치는 변경하지 않았다.
- 이번 변경은 설치 AI의 절차와 예제 설명이다. 사용자 인터뷰의 자동 수행, 상용 모델의 품질·비용 비교, 유료 모델 호출을 검증한 것은 아니다.

## 2026-10-20 · OMP 내장 보존, pi 역할 이식, 저가 비전 작업자

### 변경

- OMP의 내장 task/sonic/scout/reviewer/security-reviewer를 덮어쓰던 파일 생성을 중단했다. 기존 manifest가 관리한 동명 파일을 제거하고 강제했던 batch/async/재귀/effort/advisor/prewalk/LSP 설정을 기록된 이전 값으로 복구한다. native seance와 다른 사용자 역할을 비활성화하지 않는다.
- YAML v2에서 OMP 내장 `native`/`native`는 기존 routing을 보존하고, 명시적 model/effort는 네이티브 override에 연결한다. custom 역할의 부모 상속과 구분했다. 기존 개인 모델·effort 배정은 비공개 백업 후 전부 유지했다.
- pi 일반 역할 5개를 OMP 18.12.1의 실제 계약을 기준으로 보강했다. 내장 source와 MIT 고지를 보존하며, OMP 전용 yield/schema는 pi의 의미 있는 텍스트 결과로 바꿨다. task의 위임과 reviewer의 scout 위임을 native 권한으로 연결한다.
- deep과 image-analyst는 추가 역할로 유지했다. image-analyst는 이미지 미지원 메인 보완 및 이미지·화면 처리량이 많은 과업의 비용 분리를 위한 저가 비전 작업자다. 특정 도구를 필수로 하거나 모든 이미지 처리를 전담시키지 않는다.
- pi 자식용 기존 extension 경로를 선언할 수 있게 했다. 필요 도구·provider의 실제 로딩을 확인하며, 이 저장소가 새로운 browser/QA 실행기를 제공하지 않는다.

### 실행 확인

- `npm test`: **26개 통과**. 설치·원복·v1 거부·native routing 보존·이전 managed 대체 파일 제거·무관한 account/tier 정책 보존과 실제 pi/plugin 통합을 포함한다.
- 실제 OMP 18.12.1의 task/scout/reviewer 결과 출처가 `bundled`였고, 명시 모델·effort로 파일을 읽어 결과를 반환했다. batch=false, enableEffort=true, maxRecursionDepth=3, async=false인 기존 profile 설정이 설치 후에도 유지됐다.
- 별도 OMP smoke에서 `native` task가 부모의 main/medium 대신 기존 role routing의 task/low를 사용함을 확인했다. 추가 image-analyst는 `user` 출처의 별도 vision/low 모델로 이미지 입력을 받아 텍스트 결과를 반환했다.
- 실제 pi 1.3.0 + pi-subagents 0.79.1에서 task의 재위임 도구, reviewer의 허용된 scout 실행과 금지된 task 실행 차단을 확인했다. 통합 중 explicit tools allowlist에 native subagent 도구도 필요함을 발견해 spawn grant 변환에 반영했다.
- 실제 pi image-analyst가 별도 vision/low 모델에서 이미지 입력을 받았고, 이미지 지원 부모에게 원본이 재주입되지 않는 것을 확인했다. 자식 extension 초기화/필수 도구 실패는 다른 모델로 우회하지 않고 실패했다.
- 검증 환경은 macOS arm64와 격리된 임시 디렉터리, 로컬 OpenAI-compatible endpoint다. 실제 클라이언트·plugin·도구·이미지 전송을 사용했지만 모델 응답은 결정적 검증용 응답이다. 상용 모델의 이미지 판단 품질·자율 위임 판단·비용 절감률을 측정한 것은 아니다. 사용자 전역 재설치는 수행하지 않았다.


## 2026-10-19 · 기존 pi-subagents로 전환

### 수정

- 자체 `agent_config_task` 실행 어댑터와 전용 TypeScript 설정을 삭제했다. pi의 실행은 기존 `nicobailon/pi-subagents`에 맡긴다.
- pi 설치 결과를 플러그인의 `<agent-dir>/agents/*.md`로 변경하고, `model`·`thinking`·`tools` 등 실제 frontmatter 계약에 맞췄다. OMP 문맥 문자열과 pi `options.context` 선택값을 구분하고 기존 플러그인의 workflow·작업자 관리 기능을 사용하도록 했다.
- 지원 플러그인과 버전을 설치 전 확인한다. 표준 npm 경로를 자동 확인하고 git/local 설치에는 `--pi-subagents-dir`를 제공한다. 다른 동명 플러그인이나 미지원 버전을 자동 교체하지 않는다.
- concurrency는 플러그인 config의 관련 leaf만 관리한다. 기존 플러그인 설정과 나중에 추가한 설정을 보존한다. 상충하는 역할 override·thinking 기본값은 무시하거나 삭제하지 않고 보고한다.
- 이전 설치 상태가 소유한 자체 확장 파일은 재설치 때 제거한다. 알 수 없거나 변경된 파일은 덮어쓰지 않으며 기존 pi-subagents 패키지는 유지한다.
- 공식 표준이라는 근거 없는 표현 대신 공식 패키지 목록·npm 지표·실제 기능 계약을 조사해 지원 대상을 선택하고 [근거](REFERENCES.md#pi-서브에이전트-선택-근거)를 기록했다.

### 확인 범위

- macOS arm64에서 `@earendil-works/pi-coding-agent` **1.3.0**과 실제 `pi-subagents` **0.79.1**을 사용했다.
- `npm test` **13개 통과**: OMP/pi 설정 보존, 플러그인 미설치 거부, override 충돌 거부, 기존 자체 실행기 제거·원복 경계, 네이티브 플러그인 통합 실행을 확인했다.
- 통합 검사는 실제 pi CLI로 실제 플러그인을 설치·로딩하고 네이티브 `subagent`를 호출했다. `scout`은 부모 모델·medium을 상속했고, `task`는 명시한 다른 모델·high로 실제 `read` 도구를 실행해 파일 내용을 부모로 반환했다. 읽기 전용 scout에 쓰기·셸 도구가 없는 것과 작업자의 재위임 도구가 없는 것도 확인했다.
- 초기 통합 검사에서 플러그인이 YAML inline 빈 배열을 `allowedAgents` 이름으로 해석하는 문제를 발견했다. 지원되지 않는 중복 선언을 제거하고 `allowNestedSubagents: false`와 명시적 도구 목록으로 재위임 금지를 표현한 뒤 실행 경로가 통과했다.
- 별도 임시 프로필에서 공식 `pi install npm:pi-subagents@0.79.1`, 설치기의 표준 npm 경로 자동 확인, 실제 `/subagents-models` 명령의 역할 조회도 확인했다.
- 로컬 OpenAI-compatible endpoint의 결정적 응답으로 모델·effort 전달과 도구 실행을 확인했다. 상용 모델 호출, 답변 품질, 이미지 정책 준수, 모든 plugin 기능이나 다른 OS·버전의 검증은 아니다. 사용자 전역 환경은 변경하지 않았다.

## 2026-10-19 · 이전 자체 어댑터 구성 (폐기)

아래 pi 검증 기록은 자체 어댑터에 대한 과거 기록이다. 기존 pi-subagents 플러그인 호환성이나 현재 지원 버전의 근거가 아니다.

### 구성과 설치

- 프로젝트의 중심을 메인 오케스트레이터와 서브에이전트 정의로 명확히 하고 지원 범위를 OMP·pi로 제한했다.
- 메인 1개와 작업자 7개를 저장소가 소유한다. 기존 OMP 내장 역할에 의존하던 일반 구현·기계적 작업·탐색·리뷰 정의를 추가했다.
- 공개 `config.example.yaml`과 gitignore된 `config.local.yaml`을 분리했다. 기존 개인 작업자 모델·effort는 로컬 YAML로 옮겼고 OMP 전용 `agent/config.yml`은 제거했다.
- 설치기는 명시적 `--client`, YAML 검증, 기존 지침 관리 구역 병합, 설정 키 단위 병합, 백업, 재설치, 제거를 지원한다. 실시간 소스 링크 대신 변환된 복사본을 설치한다.
- pi에는 실제 별도 CLI 프로세스를 실행하는 `agent_config_task` 확장을 추가했다. 부모 모델·effort 상속, 명시적 역할별 선택, 동시 실행 제한, 오류·취소 전파, 텍스트 결과 반환을 처리한다.
- OMP 작업자의 live effort 상속은 네이티브 설정으로 표현할 수 없어 명시적 effort를 요구한다. 인증 fallback·미지원 effort 조정은 OMP 런타임의 한계로 문서화했다.
- OMP 18.12.1의 사용자 역할 탐색이 `PI_CODING_AGENT_DIR`을 따르지 않는 문제를 실제 실행에서 확인했다. 역할을 전용 확장 패키지에 생성하고 그 경로만 등록해 프로필·사용자 지정 설치 경로에서도 로딩되도록 했다. 다른 확장 목록 변경은 보존한다.
- README, AI용 INSTALL 안내, 참고 자료를 분리했다. 이전 설치 기록과 계획 문서는 현재 설치 계약과 구분한다.

### 실행 확인

- macOS arm64, Node.js 26.0.0에서 격리된 임시 사용자 디렉터리를 사용했다. 실제 사용자 전역 설치·인증·원격 저장소는 변경하지 않았다.
- 일반 pi `@mariozechner/pi-coding-agent` 0.73.1과 `@earendil-works/pi-coding-agent` 1.3.0에서 실제 CLI가 확장을 로딩하고 두 작업자를 실행했다. 작업자의 실제 `read` 도구가 임시 파일을 읽고 그 결과가 메인에 반환됐다.
- 로컬 검증용 OpenAI-compatible endpoint에서 부모 상속 `parent:medium`과 명시적 작업자 `worker:high` 요청을 관측했다. 작업자 도구 목록에는 재위임 도구가 없었다.
- OMP 18.12.1에서도 네이티브 `task`가 저장소의 `scout`·`task` 정의를 로딩하고 실제 파일을 읽는 경로를 확인했다. 결과의 역할 출처가 `bundled`가 아닌 `user`였고, 실제 모델·effort가 각각 `smoke/parent:medium`, `smoke/worker:high`였다. print-mode smoke에는 동기 task 설정 overlay를 사용했다.
- 두 pi 버전에서 미지원 `max`를 지정한 배치를 실패로 반환하고, 사전 확인에 실패한 배치의 작업자가 하나도 실행되지 않는 것을 확인했다.
- `npm test`의 설치기 행동 회귀 검사 8개가 통과했다. 기존 지침·설정·추가 확장 보존, dry-run 무변경, 미존재 정의 거부, OMP effort 상속 거부, 수정된 관리 파일 원복 거부, 독립 소유 upstream 링크 보존, 작업자를 모두 제거하는 pi 설정을 확인했다.
- Node 타입 환경을 설정한 뒤 pi 어댑터의 TypeScript LSP 진단에 오류가 없었다.
- 외부 유료 모델 호출이나 모델 답변 품질 평가는 수행하지 않았다. 로컬 endpoint의 결정적 응답은 실행 경로 검증용이며 제품 기능이나 fallback으로 포함되지 않는다.

## 2026-10-16

- 조사·검토와 구현의 완료 경계를 구분했다. 통상적 작업의 재승인과 승인되지 않은 파괴적 작업의 확인을 구분했다.
- 검사를 고정 횟수로 지시하지 않고 유효한 증거 재사용과 변경에 따른 재검증을 명시했다.
- 당시 OMP RPC 로딩을 확인했다. 이는 모델 행동이나 비용 절감의 실측이 아니며 현재 설치기의 검증 기록도 아니다.

## 2026-10-13

- 품질·완료 기준을 유지하면서 조사·인계·재작업을 포함한 총비용을 줄이는 정책을 통합했다.
- 세션 재사용과 provider prompt cache를 구분하고, 관측되지 않은 사용량·과금 추정을 금지했다.
- 당시 계획·리뷰·실행 범위는 [완료된 계획 기록](plans/cost-quality-policy.md)에 보존한다.

## 2026-10-10

- Agency Agents의 고정 역할·인계 양식 대신 로컬 운영 정책을 작성했다.
- 메인의 직접 작업과 사용자 모델 선택을 유지하고, 고난도 구현용 `deep`과 이미지 전담 역할을 정리했다.
- 당시 OMP 18.4.10에서 링크 설치·재설치·설정 보존·RPC 로딩을 확인했다. 이 기록은 폐기된 OMP 전용 설치기에 대한 것으로 새 설치기의 보증이 아니다.
