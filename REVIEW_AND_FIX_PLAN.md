# posture-guard-web 종합 리뷰 및 개선 계획 (2026-02-18)

## 1) 분석 범위
- 대상: `src`, `public`, `server`, `e2e`, `vite.config.js`, `playwright.config.js`, `eslint.config.js`, `package*.json`
- 방법: 정적 리뷰 + 테스트 게이트 + E2E 회귀 + 서비스 동작 점검

## 2) 현재 게이트 상태
- [x] `npm run lint`
- [x] `npm run test:run`
- [x] `npm run build`
- [x] `npx playwright test` (206개 통과)

## 3) 수정 항목 체크리스트

### P0 안정성/품질
- [x] E2E 카메라 권한 거부 경로의 결정성 확보
  - 근거: `e2e/error-handling.spec.js`
  - 조치: 권한 거부 테스트에서 `getUserMedia`를 `NotAllowedError`로 강제 주입
- [x] 로컬 린트 블록 제거 및 임시 스크립트 정리
  - 근거: `e2e/fixtures/base.js`
  - 조치: 사용되지 않는 `eslint-disable` 제거
- [x] 임시 디버그 산출물 삭제
  - 삭제: `e2e/.tmp-debug.spec.js`, `tmp-check.js`, `tmp-check.cjs`, `devserver.err`, `tmp-devserver.err`

### P1 기능/회귀
- [x] CSS 주입 정책 경고 해소
  - 조치: CSP에서 `frame-ancestors` 삭제 (meta CSP 정책 항목에서만 의미 있는 값이 아님)
  - 파일: `index.html`
- [x] 모바일/접근성/캘리브레이션 경로 회귀 정리 반영 후 재검증
  - 근거: `e2e/accessibility.spec.js`, `e2e/error-handling.spec.js`, `e2e/navigation.spec.js`, `e2e/posture-detection.spec.js`

### P2 운영/보안 가시성(이전 단계에서 반영)
- [x] 서비스 워커 캐시/오프라인 동작 보강 (`public/sw.js`)
- [x] WebSocket Relay 메시지 크기/등록 상태/보안 검증 보강 (`server/websocket-relay.js`)
- [x] E2E 기반 카메라/센서/상태 플로우 정합성 정비 (`e2e/fixtures/base.js` 등)
- [x] 릴레이 및 앱 상태 정리 경로에 대한 테스트/로직 정합성 강화
  - 관련: `src/App.jsx`, `src/hooks/useWatchConnection.js`, `src/hooks/useMediaPipe.js`

## 4) 잔여 권고(완료 기준은 사용자 승인 후 다음 릴리즈로 반영)
- [ ] CSP `unsafe-inline` 완전 제거 (현재는 스타일 인젝션 지원을 위해 유예)
  - 후보: 빌드 산출물 CSS 분리 전략 또는 nonce/해시 기반 정책 적용
- [ ] Playwright 결과 산정용 정리
  - 결과 리포트 보관 정책(`playwright-report/`, `test-results/`) 문서화
- [ ] 서버/브라우저 정책 변경점에 대한 운영 SOP 문서화

## 5) 체크 완료 상태 요약
- 현재: **회귀 3대 게이트 빌드/단위/E2E 모두 통과**, 임시 디버그 산출물 정리 완료
- 위험: CSP 정책은 기능 안정성과 보안 균형 관점에서 후속 단계에서 정밀 재설계 필요
