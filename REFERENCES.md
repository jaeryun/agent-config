# 참고 자료와 출처

## 실행 환경

- [OMP task와 작업자 실행](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/tools/task.md)
- [OMP 에이전트 발견·설정 우선순위](https://github.com/can1357/oh-my-pi/blob/v18.12.1/docs/task-agent-discovery.md)
- [OMP 모델 해석과 인증 fallback 구현](https://github.com/can1357/oh-my-pi/blob/v18.12.1/packages/coding-agent/src/config/model-resolver.ts)
- [pi 설정 경로와 사용자 지침](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/configuration.md)
- [pi 설정 참조](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md)
- [pi 확장 API](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
- [pi 공식 서브에이전트 예제](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent)

pi 어댑터는 공식 확장 API와 별도 CLI 프로세스를 사용한다. 공식 예제의 전체 UI·체인·에이전트 발견 체계를 가져오지 않는다. 이 저장소의 YAML로 생성한 역할만 실행하고, OMP의 내부 통신 프로토콜을 pi에 흉내 내지 않는다. `main` 링크의 문서는 변할 수 있으므로 실제 지원 판단은 설치된 버전과 실행 확인을 기준으로 한다.

## 운영 정책의 참고 자료

주 레퍼런스는 [Oh My OpenAgent](https://github.com/code-yeongyu/oh-my-openagent)다. 초기 참고 revision은 `1abeb9dfaa6d8bc2ec442127e3434dfb1390046c`다.

- [Orchestration Guide](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/docs/guide/orchestration.md): 작은 작업의 직접 처리, 사용자 세션 모델 유지, 작업 유형별 배정을 참고했다.
- [Task description](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/packages/senpi-task/src/tools/task/description.ts): 새 작업과 기존 작업자 후속 지시를 구분하는 원칙을 참고했다.
- [OpenAI category prompts](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/packages/senpi-task/src/category/openai-categories.ts): 단순 작업에는 명확한 절차, 어려운 작업에는 목표·제약을 전달하고 작업자가 결과까지 책임지는 원칙을 참고했다.
- [Manifesto](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/docs/manifesto.md): 불필요한 사용자 개입과 반복 조사를 줄이는 방향을 참고했다.

조율만 하는 메인, 고정된 다중 검증 단계, 전용 명령·hook·오케스트레이션 엔진은 가져오지 않았다. 운영 아이디어를 참고해 프롬프트를 작성했으며 원문 프롬프트·코드를 복사하거나 번역해 배포하는 구성이 아니다. 참고 프로젝트의 [Sustainable Use License](https://github.com/code-yeongyu/oh-my-openagent/blob/1abeb9dfaa6d8bc2ec442127e3434dfb1390046c/LICENSE.md)를 MIT로 취급하지 않는다.

비용·품질·캐시 정책의 추가 참고 revision은 `b78527c13f79548f8c655020bf63906912f1fd4a`다. 해당 [manifesto](https://github.com/code-yeongyu/oh-my-openagent/blob/b78527c13f79548f8c655020bf63906912f1fd4a/docs/manifesto.md), [모델·역할 선택](https://github.com/code-yeongyu/oh-my-openagent/blob/b78527c13f79548f8c655020bf63906912f1fd4a/docs/guide/agent-model-matching.md), [캐시 설정 설명](https://github.com/code-yeongyu/oh-my-openagent/blob/b78527c13f79548f8c655020bf63906912f1fd4a/docs/reference/configuration.md#L1256-L1296)을 참고했다. 당시 계획과 리뷰 기록은 [완료된 계획 문서](plans/cost-quality-policy.md)에 보존한다.

캐시 사실관계는 [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)과 [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)을, 작업 분할과 문맥 인계는 [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)를 보조 자료로 사용했다. 캐시 적중·품질 향상·비용 절감의 실측을 주장하지 않는다.

## 보존된 차용 원본

`agent/upstream/agency-agents/`에는 이전 구성에서 사용한 원본과 MIT 고지를 보존한다. 기준 revision은 `f99f6aa910a442b0197b768ce0ea7751e35e2060`이다. 현재 실행 프롬프트의 기반이 아니며 설치하지 않는다. 이 디렉터리의 라이선스는 그 차용 원본에 대한 것으로, 저장소 전체의 라이선스 지정으로 해석하지 않는다.

참고 자료의 갱신은 수동으로 검토한다. 설치 시 외부 프롬프트를 자동 다운로드해 실행 지침을 바꾸지 않는다.
