# agent-config 저장소 작업 안내

이 저장소는 개인 AI 에이전트 지침과 역할을 Rulesync 43.8.0으로 여러 클라이언트에 배포한다. 이 파일은 저장소 작업 안내이며 배포 정본이나 생성물이 아니다.

## 정본과 수정 범위

- `.rulesync/rules/behavior.md`: 메인·작업자 공통 지침. 이 저장소 작업에도 적용한다.
- `.rulesync/rules/development.md`: 메인·작업자 공통 개발 지침. 이 저장소 작업에도 적용한다.
- `.rulesync/rules/orchestration.md`: 메인의 위임·조율·통합·완료 판단 지침. 메인은 해당 작업 전에 읽는다.
- `.rulesync/subagents/*.md`: 공통 역할과 클라이언트별 메타데이터.
- `docs/agents-reference.md`, `docs/development-reference.md`, `docs/orchestrator-reference.md`: 각 지침의 근거 주석판. 지침을 수정하면 대응하는 본문과 주석도 갱신한다.
- `ORCHESTRATOR.original.md`, `docs/ref/`: 과거 원본과 참고 자료이며 배포 대상이 아니다.

설치된 파일을 직접 고치지 말고 정본을 수정한 뒤 Rulesync로 생성한다. 모델·effort·계정·권한·동시 실행 수 등 개인 설정은 요청 없이 변경하지 않는다. OMP에서는 `deep`, `image-analyst`만 사용자 역할로 생성하고 내장 역할은 유지한다.

## 생성과 확인

Node.js 22 이상에서 `npm ci --ignore-scripts`로 고정된 의존성을 설치한다. 배포에는 별도 설치기 없이 공식 CLI를 사용한다.

```sh
npx rulesync generate --global --output-roots "$HOME" --targets omp --features rules,subagents --dry-run
npx rulesync generate --global --output-roots "$HOME" --targets omp --features rules,subagents
npx rulesync generate --global --output-roots "$HOME" --targets omp --features rules,subagents --check
```

- 대상과 기능은 요청 범위에 맞춰 명시한다. 규칙만 수정했다면 `--features rules`를 사용한다.
- 배포 전 미리보기의 경로·경고를 확인한다. `--delete`로 개인 파일을 일괄 삭제하지 않는다.
- 저장소 루트에 클라이언트용 규칙을 생성하지 않는다. 특히 프로젝트 모드의 Codex 생성은 이 `AGENTS.md`를 덮어쓸 수 있다.
- 파일 분리·병합·로딩은 클라이언트별 Rulesync 표준을 따른다. 공통 설치 경로나 별도 시작 파일을 추가하지 않는다.
- 생성 정합성 확인을 실제 클라이언트 세션 검증으로 보고하지 않는다. 독립 리뷰 기준은 `behavior.md` 2.1항을 따른다.

클라이언트별 경로와 로컬 설정 사용법은 `README.md`를 참고한다.
