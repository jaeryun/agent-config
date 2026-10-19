# AI 설치 안내

지원 환경은 **OMP**와 **pi + nicobailon/pi-subagents**다. 이 저장소는 역할·모델·effort 설정을 변환한다. 서브에이전트를 실행하는 코드를 작성·복사하지 않으며, 이미 있는 실행 환경을 다른 플러그인으로 조용히 대체하지 않는다.

## 1. 실제 실행 환경 확인

1. 현재 세션의 런타임 정보와 실행 파일·버전으로 OMP 또는 pi인지 확인한다. 두 실행 파일이 모두 있어도 PATH 순서로 결정하지 않는다.
2. 대상 agent 디렉터리를 확인한다. `--agent-dir` > `PI_CODING_AGENT_DIR` > 기본값 순서이며, 기본값은 `~/.omp/agent` 또는 `~/.pi/agent`다. 두 도구가 같은 환경변수를 쓰므로 경로만으로 클라이언트를 추정하지 않는다.
3. 기존 `AGENTS.md`, 역할 정의, 설정과 프로젝트별 override를 확인한다. 인증 정보는 출력하거나 저장소로 복사하지 않는다.
4. pi에서는 `pi list`와 설치된 패키지의 `package.json`, 현재 활성 도구를 확인한다. 지원 패키지의 정확한 이름은 **`pi-subagents`**, 저장소는 **`nicobailon/pi-subagents`**다. 공식 예제나 scoped 동명 패키지를 같은 구현으로 취급하지 않는다.
5. 현재 변환 계약은 pi-subagents **0.79.x 중 0.79.1 이상**을 대상으로 한다. 이 버전의 peer 요구사항에는 `@earendil-works/pi-ai >=0.86.1`이 포함된다. 이전 `@mariozechner` pi와의 호환성을 주장하지 않는다. 다른 조합은 지원 자료를 확인하거나 사용자에게 필요한 버전 선택을 설명한다.

지원 플러그인이 없으면 현재 프로필에서 다음 공식 설치 방식을 사용한다. 기존 호환 설치는 재사용한다. 다른 플러그인이 설치되어 있으면 자동 제거·교체하지 않고 충돌과 필요한 선택을 설명한다. 설치기는 플러그인을 다운로드하거나 로딩하지 않는다.

```sh
pi install npm:pi-subagents@0.79.1
```

`PI_CODING_AGENT_DIR`로 프로필을 바꿨다면 이 명령과 이후 설치 명령 모두 같은 환경에서 실행한다. 모델 인증은 기존 pi 로그인·provider 설정을 사용한다.

## 2. 저장소와 개인 YAML 준비

- 아직 없다면 사용자가 관리할 위치에 `https://github.com/jaeryun/agent-config`를 clone한다. 기존 checkout의 사용자 변경을 덮어쓰지 않는다.
- Node.js 22 이상과 npm이 필요하다. pi의 더 높은 최소 Node.js 요구사항도 충족한다. `npm ci --omit=dev --ignore-scripts`로 설정 변환 의존성만 설치한다. 개발 의존성의 pi와 플러그인은 테스트용이며 사용자 실행기를 교체하는 것이 아니다.
- 기존 `config.local.yaml`을 우선한다. 없을 때만 `config.example.yaml`에서 복사한다. 개인 정의는 gitignore된 `.local/`에 둘 수 있다.
- `agents`의 `orchestrator`는 필수다. 다른 역할은 추가·제거할 수 있다. 정의 경로는 YAML 디렉터리 안의 상대 Markdown 경로여야 하며, 절대 경로·`..`·외부로 향하는 링크는 거부한다.
- `model`은 정확한 `provider/model-id` 또는 `inherit`다. effort를 모델 문자열에 합치지 않는다. `effort`는 별도로 지정한다. 두 필드 모두 `{omp: 값, pi: 값}` 형태로 환경별 값을 지정할 수 있다.
- 메인은 모델·effort를 둘 다 `inherit`로 유지하거나 둘 다 명시한다. 명시적 값은 새 세션의 시작 설정이지 실행 중인 선택을 강제로 바꾸는 기능이 아니다.
- 작업자 `model: inherit`는 활성 부모 모델을 뜻한다. OMP 작업자 effort는 명시해야 한다. pi 작업자의 effort 상속은 native `thinking` 필드를 생략하는 방식이다.
- pi 사용자 설정에 `subagents.defaultThinking`이 있으면 effort 상속과 충돌하므로 먼저 해결한다. 사용자 `agentOverrides`·`agentOverridesByProvider`에 같은 역할이 있으면 정의보다 우선하므로 설치기가 중단한다. 무작정 지우지 말고 사용자 설정과 YAML의 의도를 맞춘다. 작업 디렉터리의 프로젝트 override는 별도로 확인한다.
- 사용할 수 없는 모델·effort를 다른 값으로 바꾸지 않는다. `/subagents-models`와 실제 실행 결과로 요청값과 유효값을 대조한다. provider ID가 클라이언트마다 다르면 YAML의 환경별 매핑에 명시한다.
- 읽기 전용 역할의 도구 권한을 임의로 넓히지 않는다. 모델의 이미지 입력 지원과 필요한 브라우저 도구도 별도로 확인한다. 지침과 도구 목록은 호스트 전체에 대한 보안 sandbox가 아니다.

## 3. dry-run과 설치

```sh
./scripts/install.sh --client omp --dry-run
./scripts/install.sh --client omp
```

pi 환경에서는 다음을 사용한다.

```sh
./scripts/install.sh --client pi --dry-run
./scripts/install.sh --client pi
```

표준 `pi install npm:pi-subagents` 설치는 `<agent-dir>/npm/node_modules/pi-subagents/package.json`으로 확인한다. git/local 설치에서는 설치된 패키지 루트를 지정한다.

```sh
./scripts/install.sh --client pi \
  --pi-subagents-dir /absolute/path/to/pi-subagents \
  --config ./config.local.yaml \
  --agent-dir /absolute/profile/agent --dry-run
```

확인한 옵션 그대로 `--dry-run`만 빼고 설치한다. 명시한 플러그인 경로는 패키지 확인용이며 실제 pi의 로딩 등록을 대신하지 않는다. `pi list`와 새 세션에서 활성화를 확인한다. 패키지 파일이 있다고 도구까지 로딩됐다고 보고하지 않는다.

설치기는 기존 `AGENTS.md`의 관리 구역과 관련 설정만 갱신한다. 생성된 파일을 원본 대신 편집하지 않는다. 충돌 시 설치 보호 검사를 우회하지 말고 원본과 사용자 변경을 조정한다.

## 4. 환경별 적용 계약

### OMP

- `<agent-dir>/extensions/agent-config/agents/*.md`에 역할을 만들고 해당 패키지 경로를 OMP `extensions`에 등록한다. OMP 18.12.1의 사용자 역할 탐색은 `PI_CODING_AGENT_DIR`을 그대로 따르지 않아 이 등록이 필요하다.
- 모델은 네이티브 selector, effort는 `thinkingLevel`과 selector suffix에 반영한다. 기존 상충하는 관리 대상 model override는 관리 기록을 남겨 제거하고 원복할 수 있게 한다.
- 호출은 네이티브 `task`를 사용한다. 작업자 통신과 재개도 OMP에 맡긴다.
- OMP 런타임은 인증 실패 시 모델 fallback 또는 미지원 effort 조정을 할 수 있다. 파일 렌더링만으로 강제 적용을 보장하지 않는다. 실제 역할 출처와 resolved model·effort가 다르면 성공으로 보고하지 않는다.

### pi + pi-subagents

- `<agent-dir>/agents/<name>.md`에 플러그인이 읽는 Markdown/frontmatter를 만든다. `model`, `thinking`, `tools`, 프로젝트 문맥·skill 상속, 재위임 금지 등을 네이티브 필드로 표현한다.
- `effort: inherit`는 `thinking`을 생략한다. `model: inherit`는 해당 문자열을 명시해 플러그인의 전역 defaultModel보다 현재 부모 선택을 우선한다.
- `concurrency`는 `<agent-dir>/extensions/subagent/config.json`의 `globalConcurrencyLimit`와 `parallel.concurrency`에 반영한다. 해당 leaf만 관리하며 플러그인의 다른 설정과 사용자가 나중에 추가한 설정은 보존한다. 이는 **run 내부의 기본 동시 실행 제한**이며 별도 run 전체를 묶는 자체 스케줄러가 아니다.
- 도구는 기존 `subagent`다. `subagents_enable`만 보이면 먼저 활성화한다. 한 작업의 예시는 `subagent({agent:"scout", task:"목표와 맥락", async:false, options:{context:"fresh"}})`다.
- `context`는 `fresh`·`fork` 등의 선택값이다. OMP의 공유 문맥 문자열을 그대로 넣지 않는다. 인계 내용은 `task`에 담는다.
- 0.79.1의 기본 병렬·체인 실행은 plugin workflow의 `runs.run`·`runs.all`을 따른다. 이전 자체 어댑터의 `{context,tasks:[...]}`나 오래된 플러그인 입력을 재사용하지 않는다. `/subagents-guide tool-reference`와 설치된 버전의 workflow 문서를 읽는다.
- 비동기 실행, 진행 표시, 사용량, 결과 보관, 상태 조회·steer·resume·supervisor 기능은 플러그인이 제공한다. 실패를 우회하려고 `pi` subprocess 실행기를 새로 작성하지 않는다.
- 프로젝트 동명 정의·설정, plugin capability ceiling·modelScope 등은 유효 구성을 바꿀 수 있다. 이 저장소가 기존 제한을 풀거나 native 검증을 우회하지 않는다.

## 5. 완료 확인

1. **클라이언트·플러그인 로딩:** 새 세션에서 도구가 실제 제공되는지 확인한다. pi는 `/subagents-doctor`, `subagent({action:"list", options:{agentScope:"user", capabilities:true}})`로 역할과 오류를 확인한다.
2. **실효 설정:** `/subagents-models` 또는 해당 도구의 실제 role/model/effort 출력을 YAML과 비교한다. 사용자 정의가 내장 역할보다 우선하는지, 프로젝트 override가 있는지 확인한다.
3. **실행 경로:** 권한 범위 안에서 읽기 전용 작업을 한 번 위임해 실제 도구 사용과 결과 반환을 확인한다. 역할과 다른 모델·effort로 실행되면 적용 성공이 아니다.
4. **기존 환경 보존:** 사용자 지침·인증·다른 역할·플러그인 설정과 백업 위치를 확인한다.

설치 결과에는 클라이언트·플러그인 버전, YAML·대상 경로, 역할과 모델·effort, 확인한 항목과 미확인 항목을 구분해 적는다. 유료 모델 호출은 사용자의 권한 범위 안에서 수행한다. 파일 설치·로딩만 확인했다면 실제 모델 호출도 확인했다고 하지 않는다. 로컬 검증용 endpoint는 전송·실행 경로의 증거이지 상용 모델 품질이나 정책 준수의 증거가 아니다.

## 갱신과 제거

YAML·정의를 바꾸면 같은 대상에 재설치하고 새 세션을 연다. 이전 자체 pi 어댑터의 관리 기록이 있으면 기존 `extensions/agent-config/index.ts`와 `config.json`을 제거하고 네이티브 plugin 정의로 전환한다. 변경된 파일이나 소유 기록이 없는 파일은 자동 삭제하지 않는다. 충돌이 나면 백업과 내용을 확인한다.

```sh
./scripts/install.sh --client pi --uninstall --dry-run
./scripts/install.sh --client pi --uninstall
```

OMP 제거는 `--client omp`를 사용한다. 제거에는 플러그인 패키지나 로컬 YAML이 없어도 된다. 설치기가 관리한 역할·지침 구역·설정 leaf만 원복하며 pi-subagents 자체와 인증·세션은 제거하지 않는다. 제거 후에도 비공개 백업과 빈 디렉터리는 남을 수 있다.

설치 상태와 백업은 `${XDG_STATE_HOME:-$HOME/.local/state}/agent-config/<대상 경로 해시>/`에 있다. 백업 `journal.json`은 대상 파일과 번호별 원본을 연결한다. SIGKILL·전원 장애의 자동 복구는 보장하지 않는다. 잠금이 남아 있으면 `owner.json`의 프로세스 종료를 확인하고 실제 파일·백업을 대조한 뒤 정리한다.

원격 설정·commit·push는 설치에 포함되지 않는다.
