# 참고 자료와 출처

## 실행 환경

- [OMP task와 작업자 실행](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/tools/task.md)
- [OMP 에이전트 발견·설정 우선순위](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/task-agent-discovery.md)
- [OMP 모델 역할·순환·태그 설정](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/settings.md#models): `modelRoles`, `cycleOrder`, `modelTags`, `enabledModels`, `defaultThinkingLevel`의 의미와 병합 규칙.
- [OMP 모델 카탈로그와 프리셋](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/models.md)
- [OMP 모델 해석과 인증 fallback 구현](https://github.com/can1357/oh-my-pi/blob/v18.12.1/packages/coding-agent/src/config/model-resolver.ts)
- [pi 설정 경로와 사용자 지침](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/configuration.md)
- [pi 설정 참조](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md)
- [pi 모델 선택과 Ctrl+P 순환 범위](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md): `defaultProvider`·`defaultModel`·`defaultThinkingLevel`·`enabledModels`와 `/scoped-models`의 의미.
- [pi 확장 API](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
- [pi 공식 서브에이전트 예제](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent)

OMP에서는 내장 역할을 그대로 사용한다. pi 실행은 기존 `nicobailon/pi-subagents`에 맡기고 OMP 일반 역할의 대응 정의만 설치한다. 자체 확장·runner 코드는 제공하지 않는다. `main` 문서의 변경을 검증 없이 적용하지 않는다.

선택기·순환 목록의 역할 구성과 `modelTags` 항목의 `hidden` 처리는 `packages/coding-agent/src/config/model-roles.ts`를 기준으로 확인했다. 역할을 숨기면 선택기 목록에서 빠질 뿐 역할 해석과 실행은 그대로이며, 정의되지 않은 모델 종류 역할은 해당 역할의 내장 우선순위를 쓴다.

## OMP 역할 원본과 pi 이식

기준은 OMP `v18.12.1`, commit `291e055836c210f314af3f73f53244e8e9d09de8`이다. 실제 binary export, 역할별 대응 범위, 보존한 반환 의미와 변경한 runtime 문법은 [출처 기록](agent/upstream/oh-my-pi/PROVENANCE.md)에 있다. 일반 역할 5개의 원본과 [MIT 고지](agent/upstream/oh-my-pi/LICENSE)를 보존하며, 생성된 pi 역할과 함께 고지 사본을 설치한다.

이 차용은 아래의 `code-yeongyu/oh-my-openagent` 운영 아이디어 참고와 별개다. OMP의 MIT 고지를 다른 프로젝트나 이 저장소 전체의 라이선스로 확대하지 않는다. 이미지·고난도 추가 역할은 독립적으로 작성한 정의다.

## pi 서브에이전트 선택 근거

공식 단일 표준이 지정되어 있다는 근거는 찾지 못했다. 공식 예제는 확장 API 참고 구현이며, 배포된 플러그인과 같은 설정·기능 계약으로 취급하지 않는다.

2026-10-19에 확인한 npm의 직전 한 달 집계 기간은 2026-09-19~2026-10-18이다.

| 후보 | npm 다운로드 | 판단 |
|---|---:|---|
| [`pi-subagents`](https://api.npmjs.org/downloads/point/last-month/pi-subagents) (`nicobailon`) | 572,984 | 기본 지원 대상으로 선택했다. |
| [`@tintinweb/pi-subagents`](https://api.npmjs.org/downloads/point/last-month/@tintinweb/pi-subagents) | 34,762 | 다른 패키지이며 현재 변환 대상이 아니다. |
| [`pi-simple-agents`](https://api.npmjs.org/downloads/point/last-month/pi-simple-agents) | 1,715 | 별도 구현이며 현재 변환 대상이 아니다. |

다운로드는 사용자 수나 품질 보증이 아니며 재설치·CI·의존성 사용도 포함할 수 있다. [공식 Pi 패키지 목록](https://pi.dev/packages/pi-subagents)에 등록된 점, [저장소](https://github.com/nicobailon/pi-subagents)의 유지보수와 역할·모델·thinking·작업자 관리 계약을 함께 고려했다. 조회 당시 GitHub 지표는 3,962 stars, 816 forks였고 npm 최신 버전은 0.79.1이었다. 이를 “공식 업계 표준”이라고 단정하지 않는다.

변환에 사용한 고정 버전 문서:

- [0.79.1 에이전트·frontmatter](https://cdn.jsdelivr.net/npm/pi-subagents@0.79.1/docs/agents.md)
- [0.79.1 모델·thinking 우선순위](https://cdn.jsdelivr.net/npm/pi-subagents@0.79.1/docs/models.md)
- [0.79.1 native configuration](https://cdn.jsdelivr.net/npm/pi-subagents@0.79.1/docs/configuration.md)
- [0.79.1 subagent·workflow 호출](https://cdn.jsdelivr.net/npm/pi-subagents@0.79.1/docs/tool-reference.md)

## 운영 정책의 참고 자료

주 레퍼런스는 [Oh My OpenAgent](https://github.com/code-yeongyu/oh-my-openagent)다. 초기 참고 revision은 `1abeb9dfaa6d8bc2ec442127e3434dfb1390046c`다.

- [Orchestration Guide](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/docs/guide/orchestration.md): 작은 작업의 직접 처리, 사용자 세션 모델 유지, 작업 유형별 배정을 참고했다.
- [Task description](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/packages/senpi-task/src/tools/task/description.ts): 새 작업과 기존 작업자 후속 지시를 구분하는 원칙을 참고했다.
- [OpenAI category prompts](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/packages/senpi-task/src/category/openai-categories.ts): 단순 작업에는 명확한 절차, 어려운 작업에는 목표·제약을 전달하고 작업자가 결과까지 책임지는 원칙을 참고했다.
- [Manifesto](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/docs/manifesto.md): 불필요한 사용자 개입과 반복 조사를 줄이는 방향을 참고했다.

조율만 하는 메인, 고정된 다중 검증 단계, 전용 명령·hook·오케스트레이션 엔진은 가져오지 않았다. 이 절의 Oh My OpenAgent에서는 운영 아이디어를 참고했으며 원문 프롬프트·코드를 복사하거나 번역해 배포하지 않는다. 해당 프로젝트의 [Sustainable Use License](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/LICENSE.md)를 MIT로 취급하지 않는다. 위 OMP 역할의 고정 버전 차용과 구분한다.

비용·품질·캐시 정책의 추가 참고 revision은 `b78527c13f79548f8c655020bf63906912f1fd4a`다. 해당 [manifesto](https://github.com/code-yeongyu/oh-my-openagent/blob/b78527c13f79548f8c655020bf63906912f1fd4a/docs/manifesto.md), [모델·역할 선택](https://github.com/code-yeongyu/oh-my-openagent/blob/b78527c13f79548f8c655020bf63906912f1fd4a/docs/guide/agent-model-matching.md), [캐시 설정 설명](https://github.com/code-yeongyu/oh-my-openagent/blob/b78527c13f79548f8c655020bf63906912f1fd4a/docs/reference/configuration.md#L1256-L1296)을 참고했다. 당시 계획과 리뷰 기록은 [완료된 계획 문서](plans/cost-quality-policy.md)에 보존한다.

캐시 사실관계는 [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)과 [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)을, 작업 분할과 문맥 인계는 [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)를 보조 자료로 사용했다. 캐시 적중·품질 향상·비용 절감의 실측을 주장하지 않는다.

## 보존된 차용 원본

`agent/upstream/agency-agents/`에는 이전 구성에서 사용한 원본과 MIT 고지를 보존한다. 기준 revision은 `f99f6aa910a442b0197b768ce0ea7751e35e2060`이다. 현재 실행 프롬프트의 기반이 아니며 설치하지 않는다. 이 디렉터리의 라이선스는 그 차용 원본에 대한 것으로, 저장소 전체의 라이선스 지정으로 해석하지 않는다.

참고 자료의 갱신은 수동으로 검토한다. 설치 시 외부 프롬프트를 자동 다운로드해 실행 지침을 바꾸지 않는다.
