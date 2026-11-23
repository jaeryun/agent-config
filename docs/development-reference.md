<!-- .rulesync/rules/development.md 본문 주석판: frontmatter를 제외한 정본과 일치한다.
     출처에 명시된 규칙과 프로젝트에 맞춘 일반화를 구분한다. 출처의 존재는 지침 효과의 실증 근거가 아니다. -->

# 개발 지침

<!-- 1 | ECC search-first / Quick Mode: "Does this already exist in the repo? → `rg` through relevant modules/tests first" (관련 모듈·테스트에서 기존 구현을 먼저 찾는다)
     | https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/search-first/SKILL.md
     | ECC coding-style / DRY·YAGNI: "Introduce abstractions when repetition is real, not speculative" (추상화는 추측이 아니라 실제 중복이 있을 때 도입한다)
     | https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/rules/common/coding-style.md
     | 구분: 사전 탐색과 불필요한 추상화 억제는 명시적 지침이다. ECC는 적합성에 따라 Adopt·Extend·Build를 구분하므로 무조건 재사용을 요구하지 않는다. 새 의존성·설정을 현재 요구로 정당화한다는 문구는 프로젝트의 일반화다.
     | 이유: 기존 구현이 요구에 맞지 않거나 교체가 목적인 경우를 허용하면서 불필요한 구조 도입을 제한한다. -->
- **1.** 기존 구현과 관례를 먼저 확인하고, 현재 요구에 맞으면 활용한다. 새 추상화·의존성·설정은 현재 요구로 정당화할 수 있을 때만 추가한다.

<!-- 2 | gstack review / Enum & Value Completeness: "Trace it through every consumer" (각 소비자를 추적한다) · "Loosened acceptance breaks unchanged consumers" (입력 허용 확대는 수정하지 않은 소비자도 깨뜨릴 수 있다)
     | https://github.com/garrytan/gstack/blob/81fb9008351d29fccc3e146d860a9cda8c104a2d/review/checklist.md#enum--value-completeness
     | API Contract Specialist: "Changed field types (string → number, object → array)" (필드 타입 변경) · "Mobile apps that can't force-update: does the API still work for them?" (강제 업데이트할 수 없는 모바일 앱에서도 API가 동작하는가?)
     | https://github.com/garrytan/gstack/blob/81fb9008351d29fccc3e146d860a9cda8c104a2d/review/specialists/api-contract.md
     | 구분: enum·허용 입력의 소비 측 추적은 명시적 검토 규칙이며, 계약 변경 전반으로의 확대는 프로젝트의 일반화다. API 전문 검토는 조건부 체크리스트다.
     | 이유: 영향받는 경로를 빠뜨리지 않되, 모든 소비자의 수정·동시 배포나 불필요한 호환 계층을 요구하지 않는다. -->
- **2.** 계약을 바꾸면 영향받는 생산자·소비자를 추적하고, 호환성·전환 요구에 맞게 필요한 처리를 갱신한다.

<!-- 3 | Superpowers systematic-debugging: "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST" (수정 전에 원인을 조사한다)
     | https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/systematic-debugging/SKILL.md
     | ECC coding-style / Error Handling: "Never silently swallow errors" (오류를 조용히 삼키지 않는다)
     | https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/rules/common/coding-style.md#error-handling
     | 구분: 원인 조사와 오류 은폐 금지는 명시적 지침이다. Superpowers 원문은 긴급 상황에도 조사를 요구하며, 임시 완화와 근본 해결의 보고를 구분하는 문구는 프로젝트의 조정이다.
     | 이유: 증상 우회나 테스트 전용 편법으로 결함을 숨기지 않는다. 긴급 완화·계약상 fallback·상위 오류 처리기로 전달하는 방식까지 금지하지 않는다. -->
- **3.** 버그는 원인을 조사해 해결하고, 임시 완화를 근본 해결로 보고하지 않는다. 오류는 계약에 따라 처리·전달하며 실패를 숨기지 않는다.

<!-- 4 | Superpowers writing-good-tests / Principle 2: "mock the slow or external operation and keep what the test depends on real" (느리거나 외부에 있는 동작을 대체하고 테스트가 검증하는 부분은 실제로 유지한다)
     | "When arguments, call counts, or ordering are part of the contract, assert them" (인자·호출 횟수·순서가 계약의 일부이면 검증한다)
     | https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/test-driven-development/writing-good-tests.md
     | 구분: 동작·계약과 실제 검증 대상을 유지하라는 명시적 작성 지침을 종합했다. 해당 문서는 TDD 스킬의 참고문서이며, 전면 TDD·커버리지 비율까지 도입한 것은 아니다.
     | 이유: mock 자체만 확인하는 테스트를 피하되, 내부 시계·타이머 대역이나 필요한 화이트박스 검증, 계약상 상호작용 검증을 허용한다. 모든 테스트를 종단간 테스트로 만들라는 뜻이 아니다. -->
- **4.** 테스트는 검증 대상의 실제 코드로 동작·계약을 검증하고, 대역은 필요한 의존성에만 사용한다.

<!-- 5 | ECC testing / Troubleshooting Test Failures: "Fix implementation, not tests (unless tests are wrong)" (테스트가 잘못된 경우가 아니라면 구현을 수정한다)
     | https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/rules/common/testing.md
     | gstack review / Gate Integrity: "is it justified by a measurement or decision visible in this diff?" (변경에 나타난 측정이나 결정으로 정당화되는가?)
     | https://github.com/garrytan/gstack/blob/81fb9008351d29fccc3e146d860a9cda8c104a2d/review/checklist.md#gate-integrity
     | 구분: 통과를 위한 검증 무력화 방지와 잘못된 테스트 수정 허용을 종합했다. gstack의 매번 승인·기록 절차까지 전역화하지 않았다.
     | 이유: 실패 자체와 별개인 계약·측정·기준 오류를 변경 근거로 삼는다. 기준을 동결하거나 별도 리뷰어 승인을 추가로 요구하지 않으며, 범위·권한 변경은 기존 승인 지침을 따른다. -->
- **5.** 통과만을 위해 검증을 우회·약화하지 않는다. 기준 변경은 계약·측정·기준 오류 등 별도 근거로 정당화한다.
