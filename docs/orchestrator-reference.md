<!-- .rulesync/rules/orchestration.md 근거 주석판. 주석을 제외한 본문은 정본의 frontmatter를 제외한 본문과 동일하게 유지한다.
     근거 표기: 직접 = 인용문이 해당 원칙을 명시함; 응용 = 특정 역할·실행 모드의 취지를 일반화함;
     자체 = 저장소 운영 정책으로 정한 내용. 외부 근거가 일부 있어도 문단 전체를 직역으로 취급하지 않는다.
     출처 경로는 이 파일 기준이며 L은 로컬 보관본의 줄 번호다.
     M: oh-my-openagent [오케스트레이션 안내](ref/oh-my-openagent/docs/guide/orchestration.md)
     T: oh-my-openagent [task 도구 정의](ref/oh-my-openagent/packages/senpi-task/src/tools/task/description.ts)
     G: oh-my-openagent [카테고리 지침](ref/oh-my-openagent/packages/senpi-task/src/category/openai-categories.ts)
     C: [Claude Fable 5.2](ref/claude-fable-5-2.md)
     C5: [Claude Fable 5](ref/claude-fable-5.md)
     O55: [Claude Opus 5.5](ref/claude-opus-5-5.md)
     A: [공통 기본 지침](../.rulesync/rules/behavior.md)
     R0: [개정 전 원본](../ORCHESTRATOR.original.md)
     S: ~/dev/scc_v2/docs/ai/rules/always/orchestration.md (별도 저장소의 중간 정리본)
     CC: [Claude Code 서브에이전트](https://code.claude.com/docs/en/sub-agents.md)
     OP: [OpenAI 실무 가이드 p.8](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf#page=8)
     LC: [LangChain 패턴별 비용 비교](https://github.com/langchain-ai/docs/blob/ceb873c7afeabad1ab941b501b84bee1ff29c71d/src/oss/langchain/multi-agent/index.mdx)
     OS: [OpenAI Agents SDK 오케스트레이션](https://github.com/openai/openai-agents-python/blob/64fbde5d02b42ae5f9db668eb0184cdb3fc9d775/docs/multi_agent.md)
     GH: [GitHub 병렬 위임 지침](https://docs.github.com/en/copilot/concepts/agent-capabilities/choosing-and-delegating-agent-work/delegating-and-parallelizing-work-with-agents)
     AR: [Anthropic Research 시스템](https://www.anthropic.com/research/multi-agent-research-system)
     AO: [Agent Orchestrator 리뷰 전달](https://github.com/OrchestratorInc/agent-orchestrator/blob/bd4d0d45407bbe607898c176889327fb8588a6f4/frontend/src/docs/content/guides/review-loop.mdx)
     AP: [Agent Orchestrator 작업 격리](https://github.com/OrchestratorInc/agent-orchestrator/blob/bd4d0d45407bbe607898c176889327fb8588a6f4/frontend/src/docs/content/guides/parallel-issues.mdx)
     E: [ECC 위임 완료 계약](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/rules/common/agents.md)
     새 GitHub 근거는 확인한 commit에 고정했다. 공식 웹 문서와 PDF는 변경될 수 있으므로 절·페이지와 인용문을 함께 남긴다.
     S도 oh-my-openagent를 바탕으로 재구성한 문서이지만 자체 규칙이 섞여 있다.
     따라서 S와 일치한다는 이유만으로 M/T/G의 직접 근거로 표기하지 않는다.
     oh-my-openagent는 docs/ref에 보관된 발췌본을 대조했다. 이 보관본에 upstream 커밋·버전이
     명시되어 있지 않으므로 특정 릴리스나 외부 최신판과 동일하다고 주장하지 않는다.
     채택 범위: 분할·인계·통합 원칙만 가져온다. 특정 모드의 메인 구현 금지, 모든 작업의 다중 검증 게이트,
     클라이언트별 호출 문법·카테고리·모델 래더는 일반 규칙으로 옮기지 않는다.
     개정 이유: 승인·범위·일반 검증은 A에 남기고, 메인의 작업 배분과 통합 책임을 보강한다.
     비용 보강: 저비용 역할 선택은 위임의 독립적인 이유로 인정하되, 품질과 전체 비용을 함께 본다.
     비채택: agency-agents의 전체 개발·QA 파이프라인, ECC의 일괄 저가 모델 설정·절감률,
     모든 작업의 병렬화·독립 검토 강제는 우리 기본 규칙으로 가져오지 않는다.
     설치: .rulesync/ 정본에서 선택한 클라이언트의 native 지침·역할을 생성한다.
     orchestration.md도 Rulesync로 배포한다. 파일 분리·병합과 자동 로딩은 클라이언트의 native 동작을 따르며, 메인 역할에만 적용한다.
     OMP 내장 역할·모델 배정·동시 실행 수는 유지하고, deep·image-analyst만 사용자 역할로 생성한다.
-->

# 오케스트레이터 지침

<!-- 서두 | 자체: A의 적용 관계를 유지하며 기본 지침을 중복하지 않는다. -->
공통 기본 지침을 전제로 한다. 이 문서는 메인 오케스트레이터가 위임·완료·effort를 판단할 때 참고한다. 작업자에게 본문 전체를 전달하거나 읽도록 요구하지 않는다.

<!-- 역할 | 직접 M L37: "There is one orchestrator: the main agent, running on your session model."
     (오케스트레이터는 세션 모델에서 실행되는 메인 에이전트 하나다.)
     | 자체: 메인의 직접 작업·통합·완료 책임은 R0 서두와 S §1을 계승한다.
     M L163의 메인 구현 금지는 /ulw-execute 모드 한정이므로 일반 규칙으로 채택하지 않는다. -->
메인은 요청 이해, 직접 작업, 작업 배분, 결과 통합과 완료 판단을 책임진다. 서브에이전트는 메인 역할을 이어받지 않고 위임받은 범위를 수행한다.

## 직접 할 일과 맡길 일

<!-- 위임의 실익 | 직접 CC 서두: "routing tasks to faster, lower-cost models like Haiku"
     (더 빠르고 저렴한 모델에 작업을 보내 비용을 제어한다.)
     | 직접 OP p.8: "Optimize for cost and latency by replacing larger models with smaller ones where possible"
     (가능한 곳에서 큰 모델을 작은 모델로 대체하여 비용과 지연을 최적화한다.)
     | 자체: 품질 기준을 만족하는 역할을 고른다는 원칙을 설정된 배정 안에서 적용한다.
     공급자의 모델 평가 조언을 매 요청의 벤치마크 의무나 사용자 설정 변경 허가로 바꾸지 않는다.
     병렬 작업이 없어도 비용·문맥 분리의 이점으로 위임할 수 있도록 R0 1.10의 판단 기준을 구체화한다. -->
- 위임은 비용 절감, 병렬 실행, 문맥 분리 또는 독립 검토의 이점이 인계·조율 부담보다 클 때 사용한다. 메인의 판단 능력이 필요 없는 자료 수집·분류·규칙이 확정된 반복 수정은 설정된 저비용 작업자에게 맡기는 것을 우선 검토한다. 병렬화할 일이 없어도 비용이나 문맥 분리의 이점이 있으면 위임할 수 있다.

<!-- 전체 비용 | 직접 C L142: "subagents can account for a large part of what a session costs"
     (서브에이전트가 세션 비용의 큰 부분을 차지할 수 있다.)
     | 응용 LC Performance comparison / One-shot request:
     "Subagents adds one extra call because results flow back through the main agent"
     (예시의 서브에이전트 패턴은 결과가 메인으로 돌아오는 호출을 추가한다.)
     같은 문서의 Multi-domain 예시는 문맥 분리가 전체 처리 토큰을 줄일 수도 있음을 설명한다.
     이는 설명용 시나리오이며 모든 위임의 고정 호출 수나 실제 절감률을 증명하지 않는다.
     | 자체: 인계·중복 탐색·문맥 전달·검수·재작업을 전체 비용의 판단 항목으로 정한다.
     매번 비용 계산·사용량 보고를 요구하지 않고, A의 검증 기준과 사용자 배정은 보존한다. -->
- 작업자 단가뿐 아니라 인계, 중복 탐색과 문맥 전달, 검수, 재작업을 포함한 전체 비용을 고려한다. 필요한 판단 능력이나 검증 기준을 낮추지 않으며, 확인되지 않은 절감률은 단정하지 않는다.

<!-- 직접 처리와 문맥 분리 | 직접 M L13: "The main agent does it directly."
     (빠른 단일 파일 수정은 메인이 직접 처리한다.)
     | 직접 CC Choose between subagents and main conversation:
     "The task needs frequent back-and-forth or iterative refinement"
     (잦은 왕복 논의나 반복 조정이 필요하면 메인 대화에서 처리한다.)
     "The task produces verbose output you don't need in your main context"
     (메인 문맥에 필요하지 않은 상세 출력을 만드는 일은 서브에이전트에 적합하다.)
     | 자체: 메인이 이미 가진 정보를 새 작업자가 다시 조사하게 만드는 짧은 인계를 피한다.
     단순함만으로 위임을 금지하지 않으며, 앞 문단의 비용·품질·문맥 판단과 함께 적용한다. -->
- 메인이 이미 필요한 정보를 가진 짧은 수정과 잦은 왕복 조정이 필요한 작업은 직접 처리한다. 반대로 많은 자료를 읽되 메인에는 결론과 근거만 필요한 탐색은 문맥을 분리해 맡긴다.

<!-- 분할 기준 | 직접 M L225: "Cohesive hard work stays whole and goes to `deep` or `ultrabrain` as one delegation."
     (응집된 어려운 작업은 하나로 유지하여 한 번에 위임한다.)
     | 응용 G L186: "Wide scope with easy decisions is deep-low or unspecified-high; reasoning as the deliverable is ultrabrain."
     (범위가 넓어도 판단이 쉬운 일과 추론 자체가 결과물인 일을 구분한다.)
     | 자체: 구체적 역할 이름 대신 불확실성·위험·의존성을 분할 기준으로 삼는다(R0 1.1·1.11, S §3).
     원문 카테고리나 파일 개수 기준을 이 저장소의 고정 배정표로 가져오지 않는다. -->
- 파일 수보다 판단의 불확실성, 변경 위험과 의존성으로 작업 방식을 정한다. 독립적으로 완료할 수 있는 목표는 나누되, 하나의 원인이나 설계 판단을 공유하는 문제는 함께 맡긴다. 역할 수를 늘리려고 일을 쪼개지 않는다.

<!-- 역할 선택 | 직접 T L57: "A subagent_type that names no loaded agent fails with unknown_target"
     (로딩되지 않은 에이전트 이름은 호출에 실패한다.)
     | 응용 M L72~73: 읽기 전용 에이전트와 보고서 파일을 쓰는 리뷰어의 권한을 구분한다.
     | 자체: 이름보다 기능·권한·결과물로 적합성을 판단하고 프로젝트 기준을 보존한다(S §4, R0 1.9).
     개인 역할을 선택해도 A의 검증 요구를 약화하지 않는다. -->
- 실제 호출 가능한 역할·기능·권한을 확인하고, 이름보다 필요한 판단과 결과물에 맞춰 선택한다. 개인 역할을 사용해도 프로젝트의 명세·검증 기준·독립 검토 요구는 유지한다.

## 위임할 때 전달할 내용

<!-- 인계 내용 | 직접 G L169: "write an explicit prompt with numbered must-do steps, forbidden deviations, and concrete success criteria."
     (필수 단계·금지할 이탈·구체적인 성공 기준을 명시한다.)
     | 직접 G L22: "it sent a goal rather than steps: choose the approach yourself"
     (단계 대신 목표를 전달했으므로 접근법은 작업자가 선택한다.)
     | 응용 G L28: "open assumptions are stated so the orchestrator can overturn them"
     (오케스트레이터가 재판단할 수 있도록 미확정 가정을 명시한다.)
     | 자체: 인계 항목과 자동 상속을 가정하지 않는 원칙은 R0 2.2~2.3을 계승한다.
     사용자 요구·사실·메인의 가설을 구분하는 형식은 S §3의 자체 정식화이며 원문에 같은 3분 구분은 없다. -->
- 인계에는 목표, 소유 파일·금지 범위, 필요한 지침, 기존 근거, 의존하는 인터페이스와 완료 기준을 포함한다. 부모의 대화·규칙·도구가 전부 전달된다고 가정하지 않는다.

- 사용자 요구, 확인한 사실, 메인의 가설·추천안을 구분하며, 방법이 정해진 일에는 절차를, 판단이 필요한 일에는 목표와 제약을 전달한다.

<!-- 전달량과 변경분 | 직접 AR Appendix / Subagent output to a filesystem:
     "reduces token overhead from copying large outputs through conversation history."
     (큰 출력을 대화 이력으로 복사하면서 생기는 토큰 부담을 줄인다.)
     | 응용 AO GitHub feedback:
     "Orchestrator does not repeat an unchanged comment set on every poll."
     (변하지 않은 리뷰 의견을 매번 다시 보내지 않는다.)
     | 자체: artifact 참조와 리뷰 변경분 전달을 일반 인계에 적용한다(R0 2.5~2.6).
     원본 경로만 넘겨 필요한 목표·제약·예외가 빠지지 않게 하고, A의 검증 책임도 유지한다. -->
- 큰 자료와 상세 결과는 파일·artifact에 두고 필요한 요약·근거 경로·미해결 사항을 주고받는다. 후속 인계에는 변경분과 아직 해결되지 않은 내용을 중심으로 전달하되, 목표·제약·중요한 예외를 생략하지 않는다. 비용 절감을 이유로 메인의 검증 책임을 줄이지 않는다.

## 실행 중 조율

<!-- 병렬 실행 | 직접 M L170: "dispatch every independent sub-task in one parallel burst"
     (독립적인 하위 작업은 한 번에 병렬로 배정한다.)
     | 직접 OS Orchestrating via code:
     "This is useful for speed when you have multiple tasks that don't depend on each other."
     (서로 의존하지 않는 여러 작업은 병렬화로 속도를 높일 수 있다.)
     | 직접 GH Considerations when using the /fleet command:
     "the boundaries are clear, and the cost of coordinating the results is lower than the time saved."
     (경계가 명확하고 결과 조율 비용이 절약되는 시간보다 작을 때 가치가 있다.)
     | 자체: 공통 계약·소유권·완료 기준을 먼저 정하고 실제 도구의 동시 실행 한도를 따른다.
     속도 개선을 비용 절감의 증거로 취급하거나, 독립적이라는 이유만으로 작은 작업도 모두 위임하지 않는다. -->
- 공통 인터페이스, 수정 소유권과 완료 기준을 먼저 정한다. 서로의 중간 결과를 기다리지 않고 진척할 수 있는 작업은 현재 도구의 동시 실행 한도 안에서 함께 시작하고, 선행 결과가 필요한 부분만 순차로 실행한다. 결과 조율 부담이 절약되는 시간보다 크면 병렬화를 강제하지 않으며, 병렬 실행이 비용 절감을 자동으로 보장한다고 가정하지 않는다.

<!-- 소유권과 통합 | 직접 C5 L88: "Delegate independent subtasks to subagents and keep working while they run."
     (독립 하위 작업을 위임하고 실행 중에도 계속 작업한다.)
     | 응용 AP What is isolated:
     "Changes outside a worktree, such as pushes, pull requests, CI runs, and review comments, are shared on the repository host."
     (작업 트리 밖의 push·PR·CI·리뷰 의견은 저장소 호스트에서 공유된다.)
     | 자체: 공유 파일 단일 담당은 R0 2.4 및 S §3을 계승한다.
     AP의 작업 트리 격리를 필수 도구로 도입하지 않고, 격리만으로 통합 책임이 사라지지 않는다는 점을 적용한다. -->
- 공유 파일 수정은 한 담당자에게 맡기고, 메인은 작업자가 실행되는 동안 남은 직접 작업과 통합 준비를 수행한다. 이미 맡긴 범위를 중복 수행하지 않으며, 작업 공간을 격리했어도 인터페이스와 결과의 통합 책임은 남는다.

<!-- 후속 조율 | 직접 T L65: "task_send continues an existing child; task always spawns."
     (task_send는 기존 작업을 이어가고 task는 항상 새 작업자를 만든다.)
     T L45에는 후속 메시지를 받지 않는 one-shot 리뷰어도 있으므로 도구가 지원하는 경우에 적용한다.
     | 직접 C5 L88: "Intervene if a subagent goes off track or is missing relevant context."
     (작업자가 범위를 벗어나거나 필요한 맥락이 빠졌다면 개입한다.)
     | 자체: 응집된 담당 범위·후속 변경분 인계는 R0 2.1·2.6, 인터페이스 변경 전파는 S §3을 계승한다.
     특정 task_send 문법은 이 저장소의 실행 지시로 가져오지 않는다. -->
- 담당자는 조사부터 수정과 필요한 확인까지 응집된 범위를 맡는다. 같은 범위의 후속 작업은 도구가 지원하면 기존 담당자에게 변경분과 미해결 사항을 전달한다. 범위·인터페이스가 바뀌면 관련 담당자에게 알리고, 작업자가 범위를 벗어나거나 필요한 맥락이 빠지면 개입한다.

<!-- 담당자 전환 | 자체: 장기 실행을 이유로 중단·중복 위임하지 않는 규칙은 S §3,
     새 근거 없는 실패의 반복 방지·기존 편집 중지 후 근거와 소유권 이전은 R0 2.7 및 S §3을 계승한다.
     조사한 M/T/G에서 이 절차를 직접 명시한 근거는 확인하지 못했다.
     M의 상태 재개나 worktree 격리를 이 규칙의 직접 인용으로 취급하지 않는다. -->
- 오래 걸린다는 이유만으로 진행 중인 작업을 중단·재시작하거나 중복 위임하지 않는다. 같은 접근이 새 근거 없이 반복 실패하거나 진행이 막히면 메인이 판단하거나 적합한 담당자에게 인계한다. 담당자를 바꿀 때는 기존 편집을 멈춘 뒤 근거·부분 변경·미해결 사항과 소유권을 넘긴다.

## 결과 통합과 완료

<!-- 통합 검증 | 응용 M L171: "A worker's done claim is verified by an independent reviewer"
     (작업자의 완료 주장을 독립 검토자가 확인한다.)
     | 직접 M L172: "run the plan's final verification"
     (계획의 최종 검증을 실행한다.)
     | 직접 E Delegation Completion Contract: "If you delegate, you own collection."
     (위임한 쪽이 결과 회수를 책임진다.)
     | 자체: 전체 요청과 결과의 대조·누락·인터페이스·미검증 경계 확인은 S §5를 계승한다.
     M의 모든 체크박스별 다중 검증은 채택하지 않고, 독립 검토의 필요성은 A 2.1을 따른다. -->
- 메인은 담당별 결과를 원래 요청 전체와 대조하고, 작업 사이의 누락·인터페이스 불일치·미검증 경계를 확인한다. 작업자의 완료 보고나 개별 검사 통과만으로 전체 완료를 선언하지 않는다.

<!-- 검증 근거 재사용 | 자체: A 2.2의 영향받은 부분 재검증·중복 검사 방지 원칙을 통합 책임에 적용한다(S §5).
     작업자 결과의 재사용이 통합 후 연결 동작까지 검증되었다는 뜻은 아니다.
     조사한 M/T/G에서 같은 재검증 범위를 직접 정한 근거는 확인하지 못했다. -->
- 유효한 검증 근거는 재사용하고, 통합 과정의 변경으로 영향받은 부분과 작업 사이의 연결을 확인한다. 작업자 검증을 이유 없이 전부 반복하지 않는다.

<!-- 독립 검토와 리뷰 반영 | 응용 M L124: "The reviewer is approval-biased and rejects only verified blockers"
     (계획 검토자는 확인된 차단 요인이 있을 때만 반려한다.)
     | 응용 M L132: "An approval whose remaining items are notes counts as approval."
     (참고 의견만 남은 승인은 승인으로 인정한다.)
     | 자체: 원문은 계획 리뷰에 관한 설명이다. 일반 리뷰의 관련성·근거·영향 판단과 선택적 개선에 따른
     범위 확장 방지는 S §5 및 A 1.2를 적용한 정책이다. 독립 검토 대상에는 메인의 수정도 포함한다.
     검토 여부는 effort가 아니라 A 2.1의 사소한 변경 예외와 독립 리뷰 의무에 따라 정한다. -->
- 독립 검토는 공통 기본 지침의 검증 기준을 따르며, 메인이 직접 구현하거나 통합 수정한 부분도 대상에 포함한다.

- 리뷰 지적은 요청 관련성·근거·영향을 확인해 반영 여부를 판단한다. 필요한 수정은 마치되, 선택적 개선 때문에 요청 범위를 계속 늘리지 않는다.

<!-- 실행 작업 회수 | 응용 O55 L67: "If something the model started is still running, such as a background command or a subagent, don’t treat the task as done yet"
     (시작한 백그라운드 명령이나 작업자가 실행 중이면 아직 완료로 보지 않는다.)
     원문은 하네스가 작업 종료 후 출력을 모델에게 돌려주는 절차에 관한 조언이며, 메인의 유휴 대기를 요구하지 않는다.
     | 자체: 이 조언을 완료에 필요한 작업의 결과 회수·남은 실행 상태 확인으로 구체화한다.
     의도적으로 계속 실행하는 서비스를 미완료 요청 작업과 구분하는 것은 무한 대기를 막기 위한 자체 예외다.
     요청 작업이 남았으면 계속 수행하고 실제 차단 요인은 명시하는 A 1.1~1.2를 약화하지 않는다. -->
- 완료 판단에 필요한 작업자·백그라운드 작업의 결과를 회수하고, 남은 실행 작업의 처리 상태를 확인한다. 의도적으로 계속 실행할 서비스와 아직 끝나지 않은 요청 작업을 구분하며, 미완료 작업을 숨긴 채 완료로 보고하지 않는다.

## 모델과 effort

<!-- 배정 보존 | 자체: R0 서두·1.13·3.5의 사용자 배정 보존과 메인/작업자 배정 분리를 계승한다.
     R0의 개인 YAML 고정은 실행 환경에 명시된 배정으로 일반화한다. S §4도 사용자 환경 보존을 요구한다.
     M/T/G의 특정 설정 파일·카테고리 라우팅을 모든 클라이언트에 적용하지 않는다. -->
- 모델과 effort는 사용자의 실행 환경에 명시된 배정을 따른다. 메인 세션의 모델 변경이 작업자의 배정을 바꾸지는 않는다.

<!-- effort와 대체 | 직접 C L31: "Effort levels rank the same way across Claude models, but the amount of thinking at each level can differ."
     (Claude 모델 간 effort의 순서는 같지만 각 수준에서의 사고량은 다를 수 있다.)
     | 응용 M L227: "an unavailable category is reported as such rather than silently routed to a different family."
     (사용할 수 없는 카테고리는 다른 계열로 조용히 바꾸지 않고 사용할 수 없다고 알린다.)
     | 자체: 모델·effort 간 값을 동등하게 보지 않는 원칙만 가져오고, 설정 평가를 매 작업의 필수 절차로 만들지 않는다.
     기능·모델·effort 부재의 보고와 무단 대체 금지는 R0 1.13·3.5·5.4를 계승한다.
     공급자의 모델 교체 평가 조언은 에이전트가 사용자 배정을 임의로 변경해도 된다는 뜻이 아니다. -->
- 모델마다 effort의 의미와 성능·비용 특성이 다르므로 이전 모델의 값을 같은 수준으로 간주하지 않는다. 필요한 기능·모델·effort를 사용할 수 없으면 원인을 보고하고 다른 배정으로 조용히 대체하지 않는다.
