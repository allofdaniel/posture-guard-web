# Posture Guard Web

실시간 AI 기반 자세 교정 웹 애플리케이션입니다. MediaPipe를 활용하여 웹캠으로 사용자의 자세를 분석하고, 나쁜 자세가 감지되면 알림을 제공합니다.

## 주요 기능

- **실시간 자세 감지**: MediaPipe Pose Landmarker를 사용한 33개 관절점 추적
- **다중 카메라 뷰 지원**: 정면, 측면, 대각선, 후면 뷰 자동 감지
- **맞춤형 기준 설정**: 사용자의 바른 자세를 기준점으로 캘리브레이션
- **진동/소리 알림**: 나쁜 자세 유지 시 커스터마이징 가능한 알림
- **세션 통계**: 바른 자세 시간, 나쁜 자세 시간, 알림 횟수 추적
- **세션 기록**: 최근 30개 세션 히스토리 저장
- **휴식 알림**: 설정된 간격으로 스트레칭 알림
- **PWA 지원**: 오프라인 사용 및 앱 설치 가능

## 기술 스택

- **Frontend**: React 19, Vite 7
- **AI/ML**: MediaPipe Tasks Vision
- **PWA**: Service Worker, Web App Manifest
- **Testing**: Vitest, React Testing Library
- **Hosting**: Firebase Hosting

## 시작하기

### 요구사항

- Node.js 18+
- npm 9+

### 설치

```bash
npm install
```

### 개발 서버

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

### 테스트

```bash
# 테스트 실행 (watch 모드)
npm test

# 테스트 실행 (단일 실행)
npm run test:run

# 커버리지 리포트
npm run test:coverage
```

### 배포

```bash
npm run deploy
```

## 프로젝트 구조

```
src/
├── components/        # React 컴포넌트
│   ├── Modal.jsx
│   ├── Header.jsx
│   ├── LoadingScreen.jsx
│   ├── InstallPrompt.jsx
│   ├── ErrorBoundary.jsx
│   └── ...
├── hooks/             # 커스텀 훅
│   └── usePWAInstall.js
├── utils/             # 유틸리티 함수
│   ├── format.js      # 시간/날짜 포맷팅
│   ├── storage.js     # 로컬 스토리지 관리
│   ├── audio.js       # 오디오/진동 관리
│   └── camera.js      # 카메라 관련 유틸
├── constants/         # 상수 정의
│   └── landmarks.js   # MediaPipe 랜드마크, 임계값
├── test/              # 테스트 설정
│   └── setup.js
├── App.jsx            # 메인 앱 컴포넌트
├── App.css            # 스타일
└── main.jsx           # 엔트리 포인트

public/
├── sw.js              # Service Worker
├── manifest.json      # PWA 매니페스트
└── icons/             # 앱 아이콘
```

## 자세 감지 임계값

| 뷰 모드 | 측정 항목 | 임계값 |
|---------|-----------|--------|
| 정면 | 어깨 처짐 | 0.035 |
| 정면 | 어깨 너비 | 0.12 |
| 정면 | 어깨 기울기 | 0.02 |
| 정면 | 고개 숙임 | 0.04 |
| 측면 | 거북목 | 0.04 |
| 측면 | 척추 굽음 | 0.05 |

## 브라우저 지원

- Chrome 80+
- Edge 80+
- Safari 14+
- Firefox 75+

## 라이선스

MIT License
