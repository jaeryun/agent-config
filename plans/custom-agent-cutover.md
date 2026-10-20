# OMP 내장 역할 보존과 pi 대응 정의 구현 계획

상태: **최신 요구에 따른 구현·검증 완료**. OMP 내장 이름·프롬프트·기능을 유지하고 pi에 대응 정의를 설치했다. 이전의 내장 전체 비활성화·역할 이름 변경안은 폐기했다. 저가 비전 역할은 특정 도구에 종속시키지 않는다. 본 구현·문서 변경을 commit/push하며 사용자 전역 재설치는 수행하지 않는다.

## 1. 확정된 범위

- OMP의 task, sonic, scout, reviewer, security-reviewer는 내장 정의를 사용한다. 같은 이름의 레포 프롬프트를 OMP에 설치하지 않는다. seance도 OMP 네이티브 기능으로 남긴다.
- pi + nicobailon/pi-subagents에는 OMP 18.12.1을 기준으로 일반 역할 5개의 대응 정의를 설치한다. 이름과 역할별 판단 기준을 보존하고 도구·통신·반환 문법은 pi의 native 계약을 사용한다. OMP 세션 포크에 결합된 seance를 가짜 pi 역할로 만들지 않는다.
- deep과 image-analyst는 추가 사용자 정의 역할로 양쪽에 유지한다. 이름은 변경하지 않는다.
- OMP 역할별 프롬프트·도구·출력 스키마·재위임 기능을 덮어쓰지 않는다. 기존 설치가 강제한 recursion/batch/async/effort/advisor/prewalk/LSP 옵션은 소유 기록을 통해 이전 값으로 복구한다. 명시적 개인 모델·effort와 concurrency만 필요한 설정에 연결한다.
- 기본 에이전트 비활성화는 어느 클라이언트에도 추가하지 않는다. 다른 사용자·프로젝트 정의와 정책도 임의로 삭제하지 않는다. 충돌과 실제 우선순위는 명시적으로 확인한다.

## 2. 설정 계약과 이행

개인 YAML은 버전 2로 전환한다. 설치 manifest의 버전은 기존 1을 유지해 이미 설치된 파일·설정의 소유권과 원복 정보를 읽는다.

- OMP 내장 역할은 이름으로 식별한다. `definition`과 `tools.pi`는 pi 대응 정의에만 사용한다. 내장 역할의 `tools.omp`·`spawns.omp`는 허용하지 않아 조용히 무시되는 설정을 만들지 않는다.
- OMP 내장 역할의 `model: native`, `effort: native`는 기존 native 모델 routing/effort를 보존한다. 현재 부모 모델 상속과 같은 뜻으로 취급하지 않는다. 내장에 명시적으로 배정할 때는 정확한 모델과 effort를 함께 지정해 `task.agentModelOverrides.<name>`에 연결한다.
- custom 역할의 `inherit`는 기존 부모 모델 상속 의미를 유지한다. OMP custom effort는 명시적 값이 필요하다. pi의 `inherit`는 부모 모델·effort 상속이며 기존 defaultThinking 충돌 검사를 유지한다.
- 역할별 `spawns`를 환경별로 선언할 수 있다. OMP 내장 task의 재위임과 reviewer의 scout 위임을 변경하지 않으며, pi에서는 native allowNestedSubagents/allowedAgents로 연결한다. 추가 역할은 기본 재위임을 허용하지 않는다.
- pi 자식에 필요한 기존 extension을 명시할 수 있게 하되 자체 extension·runner는 생성하지 않는다. 해당 도구/확장의 실제 로딩과 권한을 검증한다.
- 버전 1 입력은 자동 추정하지 않고 전환 안내와 함께 거부한다. 이 checkout의 개인 YAML은 비공개 백업 후 모델·effort와 개인 선택을 보존하며 별도 편집한다. 설치기는 source-read-only를 유지한다.
- 기존 manifest가 관리한 OMP 내장 동명 파일만 제거한다. 그 외 파일·설정은 유지하고, 외부에서 변경된 managed 값은 충돌로 중단한다. uninstall도 임의의 내장 파일 복제를 되살리지 않는다.

## 3. 저가 비전 역할

- image-analyst는 저가 비전 작업자다. 특정 도구·브라우저·QA 방식으로 한정하지 않는다.
- 메인이 비전을 지원하지 않으면 이미지 설명·OCR·관찰 근거로 보완한다.
- 메인이 비전을 지원해도 많은 이미지·화면·상태를 반복 처리하는 과업은 비용 분리를 위해 맡길 수 있다. 단발성 이미지는 메인이 직접 처리할 수 있다.
- 작업자가 제공된 도구로 읽기·캡처·필요한 상호작용·관찰을 끝까지 수행하고, 메인에는 필요한 결과·불확실성·증거 경로를 전달한다. 모든 원본과 로그를 메인에 다시 주입하거나 전체 동선을 무조건 재실행하지 않는다.
- 관찰과 기능 성공 증거를 구분한다. 검수 범위·미확인 항목을 비용 때문에 숨기지 않는다. 운영 데이터 변경·결제·계정 삭제·제품 코드 수정 등은 권한 밖이다.
- 모델과 effort는 사용자 YAML 선택을 따른다. 사용할 수 없으면 보고하며 더 비싼 모델로 자동 전환하지 않는다. 비용 절감률은 근거 없이 보장하지 않는다.
- 메인 및 다른 작업자에 대한 일괄 원본 이미지 금지와 blanket 재위임 금지를 제거한다. 역할별·runtime별 권한과 실제 capability를 따른다.

## 4. 역할 기준과 출처

OMP 18.12.1의 실제 export와 고정 버전 source를 기준으로 pi용 정의를 작성한다. 차용한 원본과 MIT 라이선스 고지를 보존하고 자동 다운로드로 정의를 갱신하지 않는다.

- task/sonic: native 공통 작업 원칙과 역할 metadata의 차이를 유지한다.
- scout: 빈 검색의 대체 전략, 조사 깊이, 관련 경로·연결 구조, 요청된 상세 보고의 완결성을 유지한다.
- reviewer: 변경 패치의 근거 있는 결함, 소비자 측 routing 추적, 심각도·위치·트리거·영향과 판정을 보존한다. diff 조회용 도구와 scout 위임을 제공하되 읽기 전용 정책을 유지한다.
- security-reviewer: 비신뢰 자료 처리, 공격자 입력부터 sink까지 추적, 방어 확인, 근본 원인별 중복 제거, 검토/유보 범위를 보존한다.
- OMP의 output schema와 yield 프로토콜은 pi의 output 파일 필드로 잘못 복사하지 않는다. pi는 native 텍스트 결과로 같은 의미 항목을 반환한다.

## 5. 검증과 완료

- installer 행동 회귀: 기존 지침·무관한 설정·account/model 정책 보존, native 역할 파일 미생성, custom 역할 설치, 기존 managed override 제거, 모델 override/원복, 외부 수정 충돌, v1 입력 거부, main-only/role subset.
- 실제 OMP 18.12.1: 내장 task/scout/reviewer의 출처가 bundled로 유지되는지, native 기능 설정이 보존되는지, 명시 모델·effort와 실제 파일 읽기 결과가 일치하는지 확인한다.
- 실제 pi 1.3.0 + pi-subagents 0.79.1: 일반 역할·추가 역할의 발견, 모델·effort, role별 도구와 재위임 metadata, 실제 read 결과 반환을 확인한다.
- 저가 비전: 실제 이미지 read와 이미지 입력 전달, 별도 선택된 저가 모델 사용, 도구/extension 연결을 격리된 로컬 endpoint로 확인한다. 이 증거를 상용 모델의 판단 품질 평가로 설명하지 않는다.
- README·INSTALL·REFERENCE·변경 이력을 현재 계약에 맞춘다. 개인 YAML과 임시 artifacts는 commit에서 제외한다.
- commit/push 후 GitHub의 main commit을 확인한다. 실제 사용자 전역 설치는 별도 권한 범위다.

## 6. 이전 독립 리뷰의 적용 범위

이전 초안은 “내장 비활성화 + 역할 rename”을 목표로 했으며 Sol·Astra가 모두 REQUEST_CHANGES를 반환했다. [Sol 원본](reviews/custom-agent-cutover-sol.md), [Astra 원본](reviews/custom-agent-cutover-astra.md)은 그 초안의 기록이며 이 방향 전환을 승인한 리뷰가 아니다.

현재 방향에서는 native 이름을 보존하고 비활성화를 추가하지 않아 이름 blacklist 충돌·Vibe 우회·rename 후 account pool/model scope 누락 위험을 유발하지 않는다. 대신 이전 managed override를 걷어낼 때 사용자 소유권·정책을 보존하는지 확인한다. native schema와 pi output의 구분, 실제 실행과 품질 평가의 구분, source YAML과 두 대상의 비원자적 전환에 관한 지적은 계속 적용한다.

## 7. 실행 확인 기록

- YAML v2 및 기존 manifest 소유권 마이그레이션을 구현했다. 이 checkout의 개인 YAML은 `.local/`에 백업했고 모델·effort 값이 모두 보존됨을 확인했다.
- 실제 OMP 18.12.1에서 native 역할의 bundled 출처, 기존 task 설정 보존, native routing과 명시 override, custom 저가 비전 역할의 이미지 입력을 확인했다.
- 실제 pi 1.3.0 + pi-subagents 0.79.1에서 역할별 도구·모델·effort, task 위임 도구, reviewer→scout 허용 및 reviewer→task 거부, 저가 비전 입력·텍스트 반환, extension 실패 경로를 확인했다.
- 전체 회귀·통합 검사 26개가 통과했다. 모델 응답은 로컬 endpoint로 제어했으며 상용 모델 품질이나 절감률을 주장하지 않는다.
- 사용자 전역 설치는 하지 않았다. 버전과 실제 검증 경계는 [변경 이력](../CHANGELOG.md)에 기록했다.
