import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { usePWAInstall } from './hooks';
import { InstallPrompt } from './components';
import './App.css';

// 성능 설정
const DETECTION_FPS = 15; // 감지 FPS (60 -> 15로 감소)
const DETECTION_INTERVAL = 1000 / DETECTION_FPS;

// MediaPipe Pose Landmark indices
const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

const SMOOTHING_FACTOR = 0.85; // 높을수록 더 부드러움

// 카메라 각도: 'front' (정면), 'side' (측면), 'diagonal' (정측면/대각선), 'back' (후면)
// 각 각도별 임계값
const THRESHOLDS = {
  // 정면 뷰 임계값
  FRONT: {
    SHOULDER_DROP: 0.035,
    SHOULDER_WIDTH: 0.12,
    SHOULDER_TILT: 0.02,
    HEAD_DROP: 0.04,
  },
  // 측면 뷰 임계값
  SIDE: {
    HEAD_FORWARD: 0.04,
    SPINE_CURVE: 0.05,
    SHOULDER_DROP: 0.04,
  },
  // 정측면(대각선) 뷰 임계값 - 2D 기반 + Z축 보조 (Z축은 느슨하게)
  DIAGONAL: {
    SHOULDER_DROP: 0.045,      // 어깨 처짐 (더 느슨하게)
    SHOULDER_WIDTH: 0.12,      // 어깨 너비 변화 (더 느슨하게)
    SHOULDER_TILT: 0.025,      // 어깨 기울기 (더 느슨하게)
    HEAD_FORWARD: 0.04,        // 거북목 (더 느슨하게)
    HEAD_DROP: 0.05,           // 고개 숙임 (더 느슨하게)
    // Z축 지표 (매우 느슨하게 - 보조용)
    SPINE_ANGLE: 0.06,         // 척추 기울기 (더 느슨하게)
    SHOULDER_Z_DIFF: 0.08,     // 어깨 Z축 차이 (매우 느슨하게)
    HEAD_Z_FORWARD: 0.06,      // 머리 Z축 (매우 느슨하게)
    HIP_SHOULDER_RATIO: 0.12,  // 힙-어깨 비율 (더 느슨하게)
  },
  // 후면 뷰 임계값
  BACK: {
    SHOULDER_DROP: 0.035,
    SHOULDER_WIDTH: 0.12,
    SHOULDER_TILT: 0.02,
    HEAD_DROP: 0.05,
  },
  MIN_VISIBILITY: 0.5,
};

// 뷰 모드 한글명
const VIEW_MODE_LABELS = {
  front: '정면',
  side: '측면',
  diagonal: '정측면',
  back: '후면',
};

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastAlertTime = useRef(0);
  const streamRef = useRef(null);
  const smoothedLandmarksRef = useRef(null);
  const badPostureStartRef = useRef(null);
  const calibratedPoseRef = useRef(null);
  const isMonitoringRef = useRef(false);
  const guideBoxRef = useRef(null);
  const frameCountRef = useRef(0);
  const cameraAngleRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const ctxRef = useRef(null); // 캔버스 컨텍스트 캐싱
  const lastStatusRef = useRef('good'); // 상태 변경 시에만 업데이트
  const lastIssuesStrRef = useRef(''); // 이슈 변경 시에만 업데이트
  const detectLoopRef = useRef(null); // 감지 루프 함수 참조

  const [appState, setAppState] = useState('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('AI 모델 로딩 중...');
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [calibratedPose, setCalibratedPose] = useState(null);
  const [postureStatus, setPostureStatus] = useState('good');
  const [postureIssues, setPostureIssues] = useState([]);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [alertDelay, setAlertDelay] = useState(3);
  const [poseInGuide, setPoseInGuide] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(null);
  const [stats, setStats] = useState({
    goodTime: 0,
    badTime: 0,
    alerts: 0,
    issueCount: {}, // 각 이슈별 발생 횟수
  });
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(80); // 목표 퍼센트
  const [breakInterval, setBreakInterval] = useState(30); // 분 단위
  const [, setLastBreakTime] = useState(null);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [theme, setTheme] = useState('dark'); // 'dark' or 'light'
  const [alertSound, setAlertSound] = useState('beep'); // 'beep', 'chime', 'bell'
  const [alertVolume, setAlertVolume] = useState(0.5);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [, setIsPaused] = useState(false);
  const breakTimerRef = useRef(null);
  const sessionStartTimeRef = useRef(null);

  // PWA 설치 훅
  const { isInstallable, isInstalled, promptInstall, showIOSInstallGuide } = usePWAInstall();
  const lastIssuesRef = useRef([]);  // 이전 프레임 이슈 (중복 카운트 방지)
  const issueStartTimeRef = useRef({});  // 각 이슈별 시작 시간 (일시적 이슈 필터링)
  const postureTimelineRef = useRef([]);  // 자세 타임라인 기록

  // 설정 및 히스토리 로드 (초기 hydration - 마운트 시 한 번만 실행)
   
  useEffect(() => {
    try {
      const saved = localStorage.getItem('postureHistory');
      if (saved) {
        setSessionHistory(JSON.parse(saved));
      }
      // 설정 로드
      const settings = localStorage.getItem('postureSettings');
      if (settings) {
        const s = JSON.parse(settings);
        if (s.theme) setTheme(s.theme);
        if (s.alertSound) setAlertSound(s.alertSound);
        if (s.alertVolume !== undefined) setAlertVolume(s.alertVolume);
        if (s.dailyGoal) setDailyGoal(s.dailyGoal);
        if (s.breakInterval) setBreakInterval(s.breakInterval);
        if (s.sensitivity) setSensitivity(s.sensitivity);
        if (s.alertDelay) setAlertDelay(s.alertDelay);
      }
    } catch {
      console.log('Load failed');
    }
  }, []);
   

  // 설정 저장
  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('postureSettings', JSON.stringify({
        theme, alertSound, alertVolume, dailyGoal, breakInterval,
        sensitivity, alertDelay
      }));
    } catch {
      console.log('Settings save failed');
    }
  }, [theme, alertSound, alertVolume, dailyGoal, breakInterval, sensitivity, alertDelay]);

  useEffect(() => {
    saveSettings();
  }, [saveSettings]);

  // 테마 적용
  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  // 히스토리 저장
  const saveToHistory = (result) => {
    const newEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      ...result,
    };
    const updated = [newEntry, ...sessionHistory].slice(0, 30); // 최근 30개만 보관
    setSessionHistory(updated);
    try {
      localStorage.setItem('postureHistory', JSON.stringify(updated));
    } catch {
      console.log('History save failed');
    }
  };

  // 카메라 권한 및 지원 확인
  const checkCameraSupport = async () => {
    // mediaDevices API 지원 확인
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { supported: false, error: 'NOT_SUPPORTED', message: '이 브라우저는 카메라를 지원하지 않습니다.' };
    }

    // HTTPS 확인 (localhost 제외)
    const isSecure = window.location.protocol === 'https:' ||
                     window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      return { supported: false, error: 'NOT_SECURE', message: '카메라 사용을 위해 HTTPS 연결이 필요합니다.' };
    }

    // 권한 상태 확인 (지원하는 브라우저만)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permission = await navigator.permissions.query({ name: 'camera' });
        if (permission.state === 'denied') {
          return { supported: false, error: 'PERMISSION_DENIED', message: '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.' };
        }
      } catch {
        // permissions API 미지원 시 무시
      }
    }

    return { supported: true };
  };

  // 카메라 스트림 요청 (다양한 옵션 시도)
  const requestCameraStream = async () => {
    const constraints = [
      // 1순위: 이상적인 설정
      {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      },
      // 2순위: 단순 전면 카메라
      {
        video: {
          facingMode: 'user'
        }
      },
      // 3순위: 아무 카메라
      {
        video: true
      },
      // 4순위: 최소 해상도
      {
        video: {
          width: { min: 320 },
          height: { min: 240 }
        }
      }
    ];

    let lastError = null;

    for (const constraint of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraint);
        return { success: true, stream };
      } catch (err) {
        lastError = err;
        console.warn('카메라 옵션 시도 실패:', constraint, err.name);
      }
    }

    // 모든 시도 실패
    return { success: false, error: lastError };
  };

  // 카메라 에러 메시지 변환
  const getCameraErrorMessage = (error) => {
    if (!error) return '알 수 없는 오류가 발생했습니다.';

    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
      case 'NotReadableError':
      case 'TrackStartError':
        return '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.';
      case 'OverconstrainedError':
        return '요청한 카메라 설정을 지원하지 않습니다.';
      case 'SecurityError':
        return '보안 오류: HTTPS 연결이 필요합니다.';
      case 'AbortError':
        return '카메라 접근이 중단되었습니다.';
      case 'TypeError':
        return '잘못된 카메라 설정입니다.';
      default:
        return `카메라 오류: ${error.message || error.name || '알 수 없는 오류'}`;
    }
  };

  // MediaPipe 초기화 (GPU 실패 시 CPU 폴백)
  const initMediaPipe = async () => {
    setLoadingProgress('MediaPipe 초기화 중...');

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    setLoadingProgress('AI 모델 다운로드 중...');

    // GPU 먼저 시도, 실패하면 CPU로 폴백
    const delegates = ['GPU', 'CPU'];
    let lastError = null;

    for (const delegate of delegates) {
      try {
        console.log(`MediaPipe ${delegate} 모드 시도...`);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
            delegate: delegate
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        console.log(`MediaPipe ${delegate} 모드 성공`);
        return landmarker;
      } catch (err) {
        console.warn(`MediaPipe ${delegate} 모드 실패:`, err);
        lastError = err;
      }
    }

    throw lastError || new Error('MediaPipe 초기화 실패');
  };

  // MediaPipe 및 카메라 초기화
  useEffect(() => {
    const initPoseLandmarker = async () => {
      try {
        // 1. 카메라 지원 확인
        const cameraSupport = await checkCameraSupport();
        if (!cameraSupport.supported) {
          setCameraError(cameraSupport.message);
          setLoadingProgress(cameraSupport.message);
          setIsLoading(false);
          return;
        }

        // 2. MediaPipe 초기화
        poseLandmarkerRef.current = await initMediaPipe();

        // 3. 카메라 시작
        setLoadingProgress('카메라 시작 중...');
        const cameraResult = await requestCameraStream();

        if (cameraResult.success) {
          streamRef.current = cameraResult.stream;
          setCameraError(null);
          setIsLoading(false);
          setAppState('calibrating');
        } else {
          const errorMsg = getCameraErrorMessage(cameraResult.error);
          setCameraError(errorMsg);
          setLoadingProgress(errorMsg);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('초기화 실패:', err);
        const errorMsg = err.message || '초기화 실패. 페이지를 새로고침 해주세요.';
        setCameraError(errorMsg);
        setLoadingProgress(errorMsg);
        setIsLoading(false);
      }
    };

    initPoseLandmarker();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 카메라 재시도
  const retryCamera = async () => {
    setCameraError(null);
    setIsLoading(true);
    setLoadingProgress('카메라 재시도 중...');

    try {
      const cameraResult = await requestCameraStream();

      if (cameraResult.success) {
        streamRef.current = cameraResult.stream;
        setCameraError(null);
        setIsLoading(false);
        setAppState('calibrating');
      } else {
        const errorMsg = getCameraErrorMessage(cameraResult.error);
        setCameraError(errorMsg);
        setLoadingProgress(errorMsg);
        setIsLoading(false);
      }
    } catch (err) {
      const errorMsg = getCameraErrorMessage(err);
      setCameraError(errorMsg);
      setLoadingProgress(errorMsg);
      setIsLoading(false);
    }
  };

  const smoothLandmarks = (newLandmarks) => {
    if (!smoothedLandmarksRef.current) {
      smoothedLandmarksRef.current = newLandmarks.map(lm => ({ ...lm }));
      return smoothedLandmarksRef.current;
    }

    const smoothed = newLandmarks.map((lm, i) => {
      const prev = smoothedLandmarksRef.current[i];
      return {
        x: prev.x * SMOOTHING_FACTOR + lm.x * (1 - SMOOTHING_FACTOR),
        y: prev.y * SMOOTHING_FACTOR + lm.y * (1 - SMOOTHING_FACTOR),
        z: prev.z * SMOOTHING_FACTOR + lm.z * (1 - SMOOTHING_FACTOR),
        visibility: lm.visibility
      };
    });

    smoothedLandmarksRef.current = smoothed;
    return smoothed;
  };

  const isLandmarkValid = (lm) => {
    return lm && lm.visibility >= THRESHOLDS.MIN_VISIBILITY;
  };

  // 카메라 각도 자동 감지 (4가지: front, side, diagonal, back)
  // 완전한 정면이 아니면 정측면으로 분류
  const detectCameraAngle = (landmarks) => {
    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
    const leftEar = landmarks[LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
    const nose = landmarks[LANDMARKS.NOSE];
    const leftEye = landmarks[LANDMARKS.LEFT_EYE];
    const rightEye = landmarks[LANDMARKS.RIGHT_EYE];

    // 어깨 너비 계산
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

    // 양쪽 어깨 visibility 차이
    const leftShoulderVis = leftShoulder.visibility || 0;
    const rightShoulderVis = rightShoulder.visibility || 0;
    const shoulderVisibilityDiff = Math.abs(leftShoulderVis - rightShoulderVis);
    const avgShoulderVis = (leftShoulderVis + rightShoulderVis) / 2;

    // 양쪽 귀 visibility
    const leftEarVis = leftEar?.visibility || 0;
    const rightEarVis = rightEar?.visibility || 0;
    const leftEarVisible = leftEarVis >= THRESHOLDS.MIN_VISIBILITY;
    const rightEarVisible = rightEarVis >= THRESHOLDS.MIN_VISIBILITY;
    const bothEarsVisible = leftEarVisible && rightEarVisible;
    const noEarsVisible = !leftEarVisible && !rightEarVisible;
    const oneEarVisible = (leftEarVisible || rightEarVisible) && !bothEarsVisible;

    // 눈 visibility
    const leftEyeVis = leftEye?.visibility || 0;
    const rightEyeVis = rightEye?.visibility || 0;
    const leftEyeVisible = leftEyeVis >= THRESHOLDS.MIN_VISIBILITY;
    const rightEyeVisible = rightEyeVis >= THRESHOLDS.MIN_VISIBILITY;
    const bothEyesVisible = leftEyeVisible && rightEyeVisible;
    const noEyesVisible = !leftEyeVisible && !rightEyeVisible;

    // 코 visibility
    const noseVis = nose?.visibility || 0;
    const noseVisible = noseVis >= THRESHOLDS.MIN_VISIBILITY;

    // 코와 어깨 중심의 X 차이 (측면이면 코가 한쪽으로 치우침)
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const noseOffset = nose ? Math.abs(nose.x - shoulderCenterX) : 0;

    // ============ 판단 로직 ============

    // 1. 후면 (BACK): 코, 눈이 안 보이고, 귀도 거의 안 보이거나 뒤통수만 보임
    if (!noseVisible && noEyesVisible && noEarsVisible && avgShoulderVis > 0.5) {
      return 'back';
    }
    if (!noseVisible && noEyesVisible && avgShoulderVis > 0.6) {
      return 'back';
    }

    // 2. 순수 측면 (SIDE): 어깨 너비가 매우 좁고, 한쪽 귀만 보이거나, 어깨 visibility 차이가 큼
    const isPureSide =
      shoulderWidth < 0.10 ||
      (oneEarVisible && shoulderWidth < 0.15 && shoulderVisibilityDiff > 0.2) ||
      shoulderVisibilityDiff > 0.4;

    if (isPureSide) {
      return 'side';
    }

    // 3. 정면 (FRONT): 적절한 조건
    // - 어깨 너비가 충분히 넓어야 함 (0.22 이상)
    // - 양쪽 눈이 모두 잘 보여야 함
    // - 코가 어깨 중심 근처에 있어야 함
    // - 어깨 visibility 차이가 작아야 함
    const isPureFront =
      shoulderWidth >= 0.22 &&
      bothEyesVisible &&
      noseOffset < 0.06 &&
      shoulderVisibilityDiff < 0.15;

    if (isPureFront) {
      return 'front';
    }

    // 4. 그 외 모든 경우는 정측면 (DIAGONAL)
    return 'diagonal';
  };

  // 정면 뷰 자세 분석
  const analyzeFrontPosture = (landmarks, calibrated, sens) => {
    const issues = [];
    const debug = { viewMode: '정면' };

    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
    const nose = landmarks[LANDMARKS.NOSE];
    const leftWrist = landmarks[LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[LANDMARKS.RIGHT_WRIST];

    if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) {
      return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '정면' } };
    }

    const currentShoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const currentShoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

    // 1. 어깨 Y 변화 (처짐/웅크림)
    const shoulderYDiff = currentShoulderCenterY - calibrated.shoulderCenterY;
    const dropThreshold = THRESHOLDS.FRONT.SHOULDER_DROP * sens;

    debug.shoulderY = shoulderYDiff.toFixed(4);
    debug.shoulderYThreshold = dropThreshold.toFixed(4);

    if (shoulderYDiff > dropThreshold) {
      issues.push('자세 처짐');
    } else if (shoulderYDiff < -dropThreshold * 0.8) {
      issues.push('어깨 긴장');
    }

    // 2. 어깨 너비 변화 (앞으로 숙임)
    const widthRatio = currentShoulderWidth / calibrated.shoulderWidth;
    const widthThreshold = 1 - (THRESHOLDS.FRONT.SHOULDER_WIDTH * sens);

    debug.shoulderWidth = widthRatio.toFixed(3);
    debug.widthThreshold = widthThreshold.toFixed(3);

    if (widthRatio < widthThreshold) {
      issues.push('앞으로 숙임');
    }

    // 3. 어깨 기울기
    const tiltDiff = currentShoulderTilt - calibrated.shoulderTilt;
    const tiltThreshold = THRESHOLDS.FRONT.SHOULDER_TILT * sens;

    debug.shoulderTilt = tiltDiff.toFixed(4);
    debug.tiltThreshold = tiltThreshold.toFixed(4);

    if (tiltDiff > tiltThreshold) {
      issues.push('어깨 기울어짐');
    }

    // 4. 고개 숙임
    if (isLandmarkValid(nose) && calibrated.noseY !== null) {
      const headDrop = nose.y - calibrated.noseY;
      const headThreshold = THRESHOLDS.FRONT.HEAD_DROP * sens;

      debug.headDrop = headDrop.toFixed(4);
      debug.headThreshold = headThreshold.toFixed(4);

      if (headDrop > headThreshold) {
        issues.push('고개 숙임');
      }
    }

    // 5. 턱 괴기 감지 - 팔꿈치가 높이 올라오고 손목이 얼굴 근처에 있는지 확인
    const leftElbow = landmarks[LANDMARKS.LEFT_ELBOW];
    const rightElbow = landmarks[LANDMARKS.RIGHT_ELBOW];

    if (isLandmarkValid(nose)) {
      let chinResting = false;
      const shoulderY = currentShoulderCenterY;

      // 방법 1: 팔꿈치가 어깨보다 높으면 턱 괴기 가능성
      if (isLandmarkValid(leftElbow) && leftElbow.y < shoulderY + 0.05) {
        // 팔꿈치가 어깨 근처나 위에 있음
        if (isLandmarkValid(leftWrist) && leftWrist.y < shoulderY) {
          // 손목도 어깨보다 위에 있으면 턱 괴기
          chinResting = true;
          debug.leftElbowHigh = 'Y';
        }
      }

      if (isLandmarkValid(rightElbow) && rightElbow.y < shoulderY + 0.05) {
        if (isLandmarkValid(rightWrist) && rightWrist.y < shoulderY) {
          chinResting = true;
          debug.rightElbowHigh = 'Y';
        }
      }

      // 방법 2: 손목이 얼굴 근처에 직접 감지됨 (보조)
      const chinRestThreshold = 0.12;
      if (isLandmarkValid(leftWrist)) {
        const leftDist = Math.sqrt(
          Math.pow(leftWrist.x - nose.x, 2) + Math.pow(leftWrist.y - nose.y, 2)
        );
        debug.leftWristDist = leftDist.toFixed(3);
        if (leftDist < chinRestThreshold) {
          chinResting = true;
        }
      }

      if (isLandmarkValid(rightWrist)) {
        const rightDist = Math.sqrt(
          Math.pow(rightWrist.x - nose.x, 2) + Math.pow(rightWrist.y - nose.y, 2)
        );
        debug.rightWristDist = rightDist.toFixed(3);
        if (rightDist < chinRestThreshold) {
          chinResting = true;
        }
      }

      if (chinResting) {
        issues.push('턱 괴기');
      }
    }

    let status = 'good';
    if (issues.length >= 2) {
      status = 'bad';
    } else if (issues.length === 1) {
      status = 'warning';
    }

    return { status, issues, debug };
  };

  // 측면 뷰 자세 분석
  const analyzeSidePosture = (landmarks, calibrated, sens) => {
    const issues = [];
    const debug = { viewMode: '측면' };

    const nose = landmarks[LANDMARKS.NOSE];
    const leftEar = landmarks[LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];

    // 보이는 어깨와 귀 선택
    const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder :
                     isLandmarkValid(rightShoulder) ? rightShoulder : null;
    const ear = isLandmarkValid(leftEar) ? leftEar :
                isLandmarkValid(rightEar) ? rightEar : null;

    if (!shoulder) {
      return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '측면' } };
    }

    // 1. 거북목 체크 - 귀와 어깨의 X 위치 비교
    if (ear && calibrated.earShoulderX !== null) {
      const currentEarShoulderX = ear.x - shoulder.x;
      const xDiff = currentEarShoulderX - calibrated.earShoulderX;
      const forwardThreshold = THRESHOLDS.SIDE.HEAD_FORWARD * sens;

      debug.earShoulderX = currentEarShoulderX.toFixed(4);
      debug.calibratedEarShoulderX = calibrated.earShoulderX.toFixed(4);
      debug.xDiff = xDiff.toFixed(4);
      debug.forwardThreshold = forwardThreshold.toFixed(4);

      if (Math.abs(xDiff) > forwardThreshold) {
        issues.push('거북목');
      }
    }

    // 2. 어깨 Y 변화 (처짐)
    if (calibrated.shoulderY !== null) {
      const shoulderYDiff = shoulder.y - calibrated.shoulderY;
      const dropThreshold = THRESHOLDS.SIDE.SHOULDER_DROP * sens;

      debug.shoulderY = shoulderYDiff.toFixed(4);
      debug.shoulderYThreshold = dropThreshold.toFixed(4);

      if (shoulderYDiff > dropThreshold) {
        issues.push('자세 처짐');
      }
    }

    // 3. 코 위치로 머리 숙임 체크
    if (isLandmarkValid(nose) && calibrated.noseY !== null) {
      const headDrop = nose.y - calibrated.noseY;
      const headThreshold = THRESHOLDS.SIDE.SPINE_CURVE * sens;

      debug.headDrop = headDrop.toFixed(4);
      debug.headThreshold = headThreshold.toFixed(4);

      if (headDrop > headThreshold) {
        issues.push('고개 숙임');
      }
    }

    // 4. 귀-코 Y 관계로 머리 기울기 체크
    if (ear && isLandmarkValid(nose) && calibrated.earNoseY !== null) {
      const currentEarNoseY = ear.y - nose.y;
      const earNoseDiff = currentEarNoseY - calibrated.earNoseY;

      debug.earNoseY = currentEarNoseY.toFixed(4);
      debug.calibratedEarNoseY = calibrated.earNoseY.toFixed(4);

      if (Math.abs(earNoseDiff) > 0.03 * sens) {
        issues.push('머리 기울어짐');
      }
    }

    let status = 'good';
    if (issues.length >= 2) {
      status = 'bad';
    } else if (issues.length === 1) {
      status = 'warning';
    }

    return { status, issues, debug };
  };

  // 정측면(대각선) 뷰 자세 분석 - 머리/목 기반 분석
  const analyzeDiagonalPosture = (landmarks, calibrated, sens) => {
    const issues = [];
    const debug = { viewMode: '정측면' };

    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
    const nose = landmarks[LANDMARKS.NOSE];
    const leftEar = landmarks[LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
    const leftEye = landmarks[LANDMARKS.LEFT_EYE];
    const rightEye = landmarks[LANDMARKS.RIGHT_EYE];

    // 양쪽 어깨가 보이면 정면 방식도 사용
    const bothShouldersValid = isLandmarkValid(leftShoulder) && isLandmarkValid(rightShoulder);

    // 보이는 어깨와 귀 선택
    const mainShoulder = isLandmarkValid(leftShoulder) ? leftShoulder :
                         isLandmarkValid(rightShoulder) ? rightShoulder : null;
    const ear = isLandmarkValid(leftEar) ? leftEar :
                isLandmarkValid(rightEar) ? rightEar : null;
    const eye = isLandmarkValid(leftEye) ? leftEye :
                isLandmarkValid(rightEye) ? rightEye : null;

    if (!mainShoulder) {
      return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '정측면' } };
    }

    // ===== 머리/목 기반 분석 (정측면에서 핵심) =====

    // 1. 목 기울기 (귀-코 X축 관계) - 거북목 핵심 지표
    // 귀가 코보다 뒤에 있어야 정상, 앞으로 나가면 거북목
    if (ear && isLandmarkValid(nose) && calibrated.earNoseX !== undefined) {
      const currentEarNoseX = ear.x - nose.x;
      const earNoseXDiff = currentEarNoseX - calibrated.earNoseX;
      const neckThreshold = 0.025 * sens; // 귀가 상대적으로 앞으로 이동하면 거북목

      debug.earNoseX = currentEarNoseX.toFixed(4);
      debug.calibratedEarNoseX = calibrated.earNoseX.toFixed(4);
      debug.earNoseXDiff = earNoseXDiff.toFixed(4);
      debug.neckThreshold = neckThreshold.toFixed(4);

      // 귀가 코 대비 앞으로 나가면 (X차이가 줄어들면) 거북목
      if (Math.abs(earNoseXDiff) > neckThreshold) {
        issues.push('거북목');
      }
    }

    // 2. 머리 높이 변화 (귀 Y 위치) - 고개 숙임
    if (ear && calibrated.earY !== undefined) {
      const headDrop = ear.y - calibrated.earY;
      const headThreshold = THRESHOLDS.DIAGONAL.HEAD_DROP * sens;

      debug.earY = ear.y.toFixed(4);
      debug.calibratedEarY = calibrated.earY.toFixed(4);
      debug.headDrop = headDrop.toFixed(4);
      debug.headThreshold = headThreshold.toFixed(4);

      if (headDrop > headThreshold) {
        issues.push('고개 숙임');
      }
    } else if (isLandmarkValid(nose) && calibrated.noseY !== null) {
      // 귀가 안 보이면 코로 대체
      const headDrop = nose.y - calibrated.noseY;
      const headThreshold = THRESHOLDS.DIAGONAL.HEAD_DROP * sens;

      debug.headDrop = headDrop.toFixed(4);
      debug.headThreshold = headThreshold.toFixed(4);

      if (headDrop > headThreshold) {
        issues.push('고개 숙임');
      }
    }

    // 3. 머리 기울기 (귀-눈 Y축 관계)
    if (ear && eye && calibrated.earEyeY !== undefined) {
      const currentEarEyeY = ear.y - eye.y;
      const earEyeYDiff = Math.abs(currentEarEyeY - calibrated.earEyeY);
      const tiltThreshold = 0.02 * sens;

      debug.earEyeY = currentEarEyeY.toFixed(4);
      debug.calibratedEarEyeY = calibrated.earEyeY.toFixed(4);

      if (earEyeYDiff > tiltThreshold) {
        issues.push('머리 기울어짐');
      }
    }

    // ===== 상체 앞뒤 분석 (코-귀 관계 활용) =====

    // 4. 앞으로 굽힘 vs 뒤로 젖힘 - 코와 귀의 Y축 관계 변화로 판단
    // 앞으로 굽히면: 코가 귀보다 상대적으로 더 아래로 감 (코-귀 Y차이 증가)
    // 뒤로 젖히면: 코가 귀보다 상대적으로 더 위로 감 (코-귀 Y차이 감소)
    if (ear && isLandmarkValid(nose) && calibrated.noseEarYDiff !== undefined) {
      const currentNoseEarYDiff = nose.y - ear.y;
      const noseEarChange = currentNoseEarYDiff - calibrated.noseEarYDiff;
      const bendThreshold = 0.03 * sens;

      debug.noseEarYDiff = currentNoseEarYDiff.toFixed(4);
      debug.calibratedNoseEarYDiff = calibrated.noseEarYDiff.toFixed(4);
      debug.noseEarChange = noseEarChange.toFixed(4);
      debug.bendThreshold = bendThreshold.toFixed(4);

      // 양수: 코가 귀 대비 더 아래로 감 (앞으로 굽힘)
      // 음수: 코가 귀 대비 더 위로 감 (뒤로 젖힘)
      if (noseEarChange > bendThreshold) {
        issues.push('앞으로 굽힘');
      } else if (noseEarChange < -bendThreshold) {
        issues.push('뒤로 젖힘');
      }
    } else if (calibrated.shoulderY !== null || calibrated.shoulderCenterY !== null) {
      // 귀가 없으면 어깨 기반 (fallback)
      let shoulderYDiff;
      if (bothShouldersValid && calibrated.shoulderCenterY !== null) {
        const currentShoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        shoulderYDiff = currentShoulderCenterY - calibrated.shoulderCenterY;
      } else if (calibrated.shoulderY !== null) {
        shoulderYDiff = mainShoulder.y - calibrated.shoulderY;
      } else {
        shoulderYDiff = 0;
      }

      const dropThreshold = THRESHOLDS.DIAGONAL.SHOULDER_DROP * sens;
      debug.shoulderY = shoulderYDiff.toFixed(4);
      debug.shoulderYThreshold = dropThreshold.toFixed(4);

      if (shoulderYDiff > dropThreshold) {
        issues.push('자세 처짐');
      }
    }

    // 5. 어깨 너비 변화 (추가 앞으로 숙임 감지)
    if (bothShouldersValid && calibrated.shoulderWidth) {
      const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const widthRatio = currentShoulderWidth / calibrated.shoulderWidth;
      const widthThreshold = 1 - (THRESHOLDS.DIAGONAL.SHOULDER_WIDTH * sens);

      debug.shoulderWidth = widthRatio.toFixed(3);
      debug.widthThreshold = widthThreshold.toFixed(3);

      // 어깨 너비가 줄어들면 앞으로 숙인 것
      if (widthRatio < widthThreshold && !issues.includes('앞으로 굽힘')) {
        issues.push('앞으로 굽힘');
      }
    }

    // 6. 턱 괴기 감지 - 손목이 얼굴 근처에 있는지 확인
    const leftWrist = landmarks[LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[LANDMARKS.RIGHT_WRIST];

    if (isLandmarkValid(nose)) {
      const chinRestThreshold = 0.15;
      let chinResting = false;

      if (isLandmarkValid(leftWrist)) {
        const leftDist = Math.sqrt(
          Math.pow(leftWrist.x - nose.x, 2) + Math.pow(leftWrist.y - nose.y, 2)
        );
        debug.leftWristDist = leftDist.toFixed(3);
        if (leftDist < chinRestThreshold) {
          chinResting = true;
        }
      }

      if (isLandmarkValid(rightWrist)) {
        const rightDist = Math.sqrt(
          Math.pow(rightWrist.x - nose.x, 2) + Math.pow(rightWrist.y - nose.y, 2)
        );
        debug.rightWristDist = rightDist.toFixed(3);
        if (rightDist < chinRestThreshold) {
          chinResting = true;
        }
      }

      if (chinResting) {
        issues.push('턱 괴기');
      }
    }

    // ===== 최종 판정 =====
    let status = 'good';
    if (issues.length >= 2) {
      status = 'bad';
    } else if (issues.length === 1) {
      status = 'warning';
    }

    return { status, issues, debug };
  };

  // 후면 뷰 자세 분석
  const analyzeBackPosture = (landmarks, calibrated, sens) => {
    const issues = [];
    const debug = { viewMode: '후면' };

    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];

    if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) {
      return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '후면' } };
    }

    const currentShoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const currentShoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

    // 1. 어깨 Y 변화 (처짐)
    if (calibrated.shoulderCenterY !== null) {
      const shoulderYDiff = currentShoulderCenterY - calibrated.shoulderCenterY;
      const dropThreshold = THRESHOLDS.BACK.SHOULDER_DROP * sens;

      debug.shoulderY = shoulderYDiff.toFixed(4);
      debug.shoulderYThreshold = dropThreshold.toFixed(4);

      if (shoulderYDiff > dropThreshold) {
        issues.push('자세 처짐');
      }
    }

    // 2. 어깨 너비 변화
    if (calibrated.shoulderWidth) {
      const widthRatio = currentShoulderWidth / calibrated.shoulderWidth;
      const widthThreshold = 1 - (THRESHOLDS.BACK.SHOULDER_WIDTH * sens);

      debug.shoulderWidth = widthRatio.toFixed(3);
      debug.widthThreshold = widthThreshold.toFixed(3);

      if (widthRatio < widthThreshold) {
        issues.push('등 굽음');
      }
    }

    // 3. 어깨 기울기
    if (calibrated.shoulderTilt !== undefined) {
      const tiltDiff = currentShoulderTilt - calibrated.shoulderTilt;
      const tiltThreshold = THRESHOLDS.BACK.SHOULDER_TILT * sens;

      debug.shoulderTilt = tiltDiff.toFixed(4);
      debug.tiltThreshold = tiltThreshold.toFixed(4);

      if (tiltDiff > tiltThreshold) {
        issues.push('어깨 기울어짐');
      }
    }

    let status = 'good';
    if (issues.length >= 2) {
      status = 'bad';
    } else if (issues.length === 1) {
      status = 'warning';
    }

    return { status, issues, debug };
  };

  // 통합 자세 분석
  const analyzePosture = (landmarks, calibrated, sens) => {
    if (!landmarks || landmarks.length === 0 || !calibrated) {
      return { status: 'good', issues: [], debug: {} };
    }

    const angle = cameraAngleRef.current;

    switch (angle) {
      case 'side':
        return analyzeSidePosture(landmarks, calibrated, sens);
      case 'diagonal':
        return analyzeDiagonalPosture(landmarks, calibrated, sens);
      case 'back':
        return analyzeBackPosture(landmarks, calibrated, sens);
      case 'front':
      default:
        return analyzeFrontPosture(landmarks, calibrated, sens);
    }
  };

  // 오디오 컨텍스트 (모바일 호환)
  const audioContextRef = useRef(null);

  // 비프음 재생
  const playBeep = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (err) {
      console.log('Beep failed:', err);
    }
  }, []);

  const triggerAlert = useCallback(() => {
    const now = Date.now();
    if (now - lastAlertTime.current < 3000) return;

    lastAlertTime.current = now;
    setStats(prev => ({ ...prev, alerts: prev.alerts + 1 }));

    if (alertEnabled) {
      // 진동 (모바일)
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      // 소리 알림 (비프음) - 모바일 우선
      playBeep();

      // 브라우저 알림 (데스크톱)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('자세 교정 알림', {
            body: '자세를 바르게 해주세요!',
            icon: '/favicon.ico',
            tag: 'posture-alert',
            renotify: true,
            silent: true, // 시스템 알림음 비활성화 (우리 비프음 사용)
          });
        } catch {
          // 모바일에서 Notification 실패 무시
        }
      }
    }
  }, [alertEnabled, playBeep]);

  // 가이드 박스 그리기 - 더 미니멀하고 전문적인 디자인
  // eslint-disable-next-line no-unused-vars
  const drawGuideBox = (ctx, width, height, angle) => {
    const boxWidth = width * 0.92;
    const boxHeight = height * 0.92;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    guideBoxRef.current = { x: boxX, y: boxY, width: boxWidth, height: boxHeight };

    // 코너 라인만 그리기 (전문적인 느낌)
    const cornerLength = 30;
    const cornerRadius = 4;

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // 좌상단
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + cornerLength);
    ctx.lineTo(boxX, boxY + cornerRadius);
    ctx.arcTo(boxX, boxY, boxX + cornerRadius, boxY, cornerRadius);
    ctx.lineTo(boxX + cornerLength, boxY);
    ctx.stroke();

    // 우상단
    ctx.beginPath();
    ctx.moveTo(boxX + boxWidth - cornerLength, boxY);
    ctx.lineTo(boxX + boxWidth - cornerRadius, boxY);
    ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + cornerRadius, cornerRadius);
    ctx.lineTo(boxX + boxWidth, boxY + cornerLength);
    ctx.stroke();

    // 좌하단
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + boxHeight - cornerLength);
    ctx.lineTo(boxX, boxY + boxHeight - cornerRadius);
    ctx.arcTo(boxX, boxY + boxHeight, boxX + cornerRadius, boxY + boxHeight, cornerRadius);
    ctx.lineTo(boxX + cornerLength, boxY + boxHeight);
    ctx.stroke();

    // 우하단
    ctx.beginPath();
    ctx.moveTo(boxX + boxWidth - cornerLength, boxY + boxHeight);
    ctx.lineTo(boxX + boxWidth - cornerRadius, boxY + boxHeight);
    ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth, boxY + boxHeight - cornerRadius, cornerRadius);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerLength);
    ctx.stroke();

    // 중앙 십자선 (은은하게)
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);

    // 수직선
    ctx.beginPath();
    ctx.moveTo(width / 2, boxY + 20);
    ctx.lineTo(width / 2, boxY + boxHeight - 20);
    ctx.stroke();

    // 수평선 (어깨 위치)
    const shoulderGuideY = boxY + boxHeight * 0.45;
    ctx.beginPath();
    ctx.moveTo(boxX + 20, shoulderGuideY);
    ctx.lineTo(boxX + boxWidth - 20, shoulderGuideY);
    ctx.stroke();

    ctx.setLineDash([]);
  };

  // 캘리브레이션 기준 실루엣
  const drawCalibrationSilhouette = (ctx, calibrated, width, height) => {
    if (!calibrated) return;

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    if (calibrated.viewMode === 'side') {
      if (calibrated.shoulderX !== null) {
        const sx = calibrated.shoulderX * width;
        const sy = calibrated.shoulderY * height;
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
        ctx.stroke();

        if (calibrated.earX !== null) {
          const ex = calibrated.earX * width;
          const ey = calibrated.earY * height;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    } else if (calibrated.viewMode === 'diagonal') {
      // 정측면 기준선
      if (calibrated.leftShoulderX !== null && calibrated.rightShoulderX !== null) {
        const lsX = calibrated.leftShoulderX * width;
        const lsY = calibrated.leftShoulderY * height;
        const rsX = calibrated.rightShoulderX * width;
        const rsY = calibrated.rightShoulderY * height;

        ctx.beginPath();
        ctx.moveTo(lsX, lsY);
        ctx.lineTo(rsX, rsY);
        ctx.stroke();
      } else if (calibrated.shoulderX !== null) {
        const sx = calibrated.shoulderX * width;
        const sy = calibrated.shoulderY * height;
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    } else {
      // 정면/후면 기준선
      if (calibrated.leftShoulderX !== null) {
        const lsX = calibrated.leftShoulderX * width;
        const lsY = calibrated.leftShoulderY * height;
        const rsX = calibrated.rightShoulderX * width;
        const rsY = calibrated.rightShoulderY * height;

        ctx.beginPath();
        ctx.moveTo(lsX, lsY);
        ctx.lineTo(rsX, rsY);
        ctx.stroke();

        if (calibrated.noseX !== null) {
          const noseX = calibrated.noseX * width;
          const noseY = calibrated.noseY * height;
          const headRadius = Math.abs(rsX - lsX) * 0.3;

          ctx.beginPath();
          ctx.arc(noseX, noseY - headRadius * 0.2, headRadius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    }

    ctx.setLineDash([]);
  };

  // 자세 그리기 - 강한 블러 글로우 효과 (퍼지는 색상)
  const drawPoseSilhouette = (ctx, landmarks, width, height, status, angle) => {
    const getPoint = (index) => {
      const lm = landmarks[index];
      if (!lm || lm.visibility < 0.4) return null;
      return { x: lm.x * width, y: lm.y * height, z: lm.z, v: lm.visibility };
    };

    // 상태별 색상 - 글로우 효과용
    const glowColor = status === 'bad' ? '#EF4444' :
                      status === 'warning' ? '#FBBF24' : '#00DCFF';
    // 더 투명하게 해서 블러가 퍼지는 느낌
    const color = status === 'bad' ? 'rgba(239, 68, 68, 0.6)' :
                  status === 'warning' ? 'rgba(251, 191, 36, 0.6)' : 'rgba(0, 220, 255, 0.6)';
    const fillColor = status === 'bad' ? 'rgba(239, 68, 68, 0.2)' :
                      status === 'warning' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0, 220, 255, 0.2)';

    const nose = getPoint(LANDMARKS.NOSE);
    const leftEye = getPoint(LANDMARKS.LEFT_EYE);
    const rightEye = getPoint(LANDMARKS.RIGHT_EYE);
    const leftEar = getPoint(LANDMARKS.LEFT_EAR);
    const rightEar = getPoint(LANDMARKS.RIGHT_EAR);
    const leftShoulder = getPoint(LANDMARKS.LEFT_SHOULDER);
    const rightShoulder = getPoint(LANDMARKS.RIGHT_SHOULDER);
    const leftElbow = getPoint(LANDMARKS.LEFT_ELBOW);
    const rightElbow = getPoint(LANDMARKS.RIGHT_ELBOW);
    const leftHip = getPoint(LANDMARKS.LEFT_HIP);
    const rightHip = getPoint(LANDMARKS.RIGHT_HIP);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 강한 블러 글로우 - 여러 레이어로 퍼지는 효과
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 80; // 매우 강한 블러
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (angle === 'side') {
      // 측면 뷰 그리기
      const shoulder = leftShoulder || rightShoulder;
      const ear = leftEar || rightEar;
      const hip = leftHip || rightHip;
      const elbow = leftElbow || rightElbow;

      if (!shoulder) return;

      let headCenter = null;
      const headRadius = 35;

      if (nose) {
        headCenter = { x: nose.x, y: nose.y - headRadius * 0.3 };
      } else if (ear) {
        headCenter = { x: ear.x, y: ear.y };
      }

      if (headCenter) {
        // 머리 - 더 두꺼운 선과 강한 글로우
        ctx.beginPath();
        ctx.arc(headCenter.x, headCenter.y, headRadius + 10, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 20;
        ctx.stroke();

        // 목 - 두꺼운 선
        ctx.beginPath();
        ctx.moveTo(headCenter.x, headCenter.y + headRadius * 0.8);
        ctx.lineTo(shoulder.x, shoulder.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 30;
        ctx.stroke();
      }

      if (hip) {
        // 몸통 - 매우 두꺼운 선
        ctx.beginPath();
        ctx.moveTo(shoulder.x, shoulder.y);
        ctx.lineTo(hip.x, hip.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 40;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(shoulder.x, shoulder.y);
        ctx.lineTo(shoulder.x, Math.min(height * 0.9, shoulder.y + 150));
        ctx.strokeStyle = color;
        ctx.lineWidth = 40;
        ctx.stroke();
      }

      if (elbow) {
        // 팔 - 두꺼운 선
        ctx.beginPath();
        ctx.moveTo(shoulder.x, shoulder.y);
        ctx.lineTo(elbow.x, elbow.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 25;
        ctx.stroke();
      }

      // 어깨 관절
      ctx.beginPath();
      ctx.arc(shoulder.x, shoulder.y, 20, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

    } else {
      // 정면/정측면/후면 뷰 그리기
      if (!leftShoulder && !rightShoulder) return;

      // 최소한 한쪽 어깨가 있으면 그리기
      const hasLeft = !!leftShoulder;
      const hasRight = !!rightShoulder;

      let shoulderWidth, shoulderCenter;

      if (hasLeft && hasRight) {
        shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        shoulderCenter = {
          x: (leftShoulder.x + rightShoulder.x) / 2,
          y: (leftShoulder.y + rightShoulder.y) / 2
        };
      } else {
        const shoulder = leftShoulder || rightShoulder;
        shoulderWidth = 100; // 기본값
        shoulderCenter = { x: shoulder.x, y: shoulder.y };
      }

      // 머리
      let headCenter = null;
      let headRadius = shoulderWidth * 0.35;

      if (nose) {
        headCenter = { x: nose.x, y: nose.y - headRadius * 0.25 };
      } else if (leftEye && rightEye) {
        headCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
        headRadius = shoulderWidth * 0.3;
      } else if (leftEar || rightEar) {
        const ear = leftEar || rightEar;
        headCenter = { x: shoulderCenter.x, y: ear.y };
        headRadius = shoulderWidth * 0.28;
      }

      if (headCenter) {
        // 머리 - 더 크고 두꺼운 글로우
        ctx.beginPath();
        ctx.ellipse(headCenter.x, headCenter.y, headRadius * 0.9, headRadius * 1.1, 0, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 20;
        ctx.stroke();

        // 목 - 두꺼운 선
        ctx.beginPath();
        ctx.moveTo(headCenter.x, headCenter.y + headRadius * 0.7);
        ctx.lineTo(shoulderCenter.x, shoulderCenter.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = shoulderWidth * 0.25;
        ctx.stroke();
      }

      // 상체 - 더 넓고 두꺼운 글로우
      if (hasLeft && hasRight) {
        const bodyBottom = Math.min(height * 0.95, shoulderCenter.y + shoulderWidth * 0.8);

        ctx.beginPath();
        ctx.moveTo(leftShoulder.x - shoulderWidth * 0.15, leftShoulder.y);
        ctx.quadraticCurveTo(
          leftShoulder.x - shoulderWidth * 0.18,
          leftShoulder.y + (bodyBottom - leftShoulder.y) * 0.5,
          leftShoulder.x - shoulderWidth * 0.05,
          bodyBottom
        );
        ctx.lineTo(rightShoulder.x + shoulderWidth * 0.05, bodyBottom);
        ctx.quadraticCurveTo(
          rightShoulder.x + shoulderWidth * 0.18,
          rightShoulder.y + (bodyBottom - rightShoulder.y) * 0.5,
          rightShoulder.x + shoulderWidth * 0.15,
          rightShoulder.y
        );
        ctx.lineTo(leftShoulder.x - shoulderWidth * 0.15, leftShoulder.y);
        ctx.closePath();

        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 25;
        ctx.stroke();
      }

      // 팔 - 두꺼운 선
      const armWidth = shoulderWidth * 0.18;
      if (leftElbow && leftShoulder) {
        ctx.beginPath();
        ctx.moveTo(leftShoulder.x, leftShoulder.y);
        ctx.lineTo(leftElbow.x, leftElbow.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = armWidth;
        ctx.stroke();
      }
      if (rightElbow && rightShoulder) {
        ctx.beginPath();
        ctx.moveTo(rightShoulder.x, rightShoulder.y);
        ctx.lineTo(rightElbow.x, rightElbow.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = armWidth;
        ctx.stroke();
      }

      // 어깨 점 - 더 큰 원
      ctx.fillStyle = color;
      if (leftShoulder) {
        ctx.beginPath();
        ctx.arc(leftShoulder.x, leftShoulder.y, 18, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (rightShoulder) {
        ctx.beginPath();
        ctx.arc(rightShoulder.x, rightShoulder.y, 18, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  // 가이드 체크
  const checkPoseInGuide = (landmarks, width, height) => {
    if (!guideBoxRef.current) return false;

    const guide = guideBoxRef.current;
    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];

    const hasValidShoulder = isLandmarkValid(leftShoulder) || isLandmarkValid(rightShoulder);
    if (!hasValidShoulder) return false;

    const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder : rightShoulder;
    const sY = shoulder.y * height;

    const shoulderInGuide = sY > guide.y + guide.height * 0.3 && sY < guide.y + guide.height * 0.75;

    return shoulderInGuide;
  };

  // 감지 루프 (최적화됨)
  const detectLoop = useCallback(() => {
    if (!poseLandmarkerRef.current || !videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // 캔버스 컨텍스트 캐싱
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext('2d', { alpha: false });
    }
    const ctx = ctxRef.current;

    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }

    // FPS 제한 (15fps)
    const now = performance.now();
    if (now - lastDetectionTimeRef.current < DETECTION_INTERVAL) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }
    lastDetectionTimeRef.current = now;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctxRef.current = null; // 크기 변경 시 컨텍스트 리셋
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }

    try {
      const results = poseLandmarkerRef.current.detectForVideo(video, now);

      // 미러링
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      const calibrated = calibratedPoseRef.current;
      const isMonitoring = isMonitoringRef.current;

      if (results.landmarks && results.landmarks.length > 0) {
        const smoothed = smoothLandmarks(results.landmarks[0]);
        const mirrored = smoothed.map(lm => ({ ...lm, x: 1 - lm.x }));

        if (isMonitoring && calibrated) {
          // 모니터링
          const { status, issues, debug } = analyzePosture(smoothed, calibrated, sensitivity);

          if (status !== 'good') {
            drawCalibrationSilhouette(ctx, calibrated, canvas.width, canvas.height);
          }

          drawPoseSilhouette(ctx, mirrored, canvas.width, canvas.height, status, cameraAngleRef.current);

          // 상태 변경 시에만 setState 호출 (성능 최적화)
          if (lastStatusRef.current !== status) {
            lastStatusRef.current = status;
            setPostureStatus(status);
          }

          const issuesStr = issues.join(',');
          if (lastIssuesStrRef.current !== issuesStr) {
            lastIssuesStrRef.current = issuesStr;
            setPostureIssues(issues);
            setDebugInfo(debug);
          }

          frameCountRef.current++;
          if (frameCountRef.current % 3 === 0) {
            // 이슈 시작 시간 관리 및 필터링 (일시적 이슈 무시)
            const now = Date.now();
            const ISSUE_MIN_DURATION = 1000; // 최소 1초 이상 지속되어야 카운트

            // 현재 이슈들의 시작 시간 기록
            issues.forEach(issue => {
              if (!issueStartTimeRef.current[issue]) {
                issueStartTimeRef.current[issue] = now;
              }
            });

            // 사라진 이슈 정리
            Object.keys(issueStartTimeRef.current).forEach(issue => {
              if (!issues.includes(issue)) {
                delete issueStartTimeRef.current[issue];
              }
            });

            // 최소 지속 시간을 만족한 새로운 이슈만 카운트
            const persistentNewIssues = issues.filter(issue => {
              const startTime = issueStartTimeRef.current[issue];
              const isPersistent = startTime && (now - startTime >= ISSUE_MIN_DURATION);
              const isNew = !lastIssuesRef.current.includes(issue);
              return isPersistent && isNew;
            });

            setStats(prev => {
              const updatedIssueCount = { ...prev.issueCount };
              persistentNewIssues.forEach(issue => {
                updatedIssueCount[issue] = (updatedIssueCount[issue] || 0) + 1;
              });

              return {
                ...prev,
                goodTime: status === 'good' ? prev.goodTime + 1 : prev.goodTime,
                badTime: status !== 'good' ? prev.badTime + 1 : prev.badTime,
                issueCount: updatedIssueCount,
              };
            });

            // 지속 시간을 만족한 이슈만 lastIssues로 기록
            lastIssuesRef.current = issues.filter(issue => {
              const startTime = issueStartTimeRef.current[issue];
              return startTime && (now - startTime >= ISSUE_MIN_DURATION);
            });
          }

          // 타임라인 기록 (10초마다)
          if (frameCountRef.current % 30 === 0) {
            const timelineEntry = {
              time: Date.now(),
              status,
              issues: [...issues],
            };
            postureTimelineRef.current.push(timelineEntry);
            // 최대 360개 (1시간) 보관
            if (postureTimelineRef.current.length > 360) {
              postureTimelineRef.current.shift();
            }
          }

          // 나쁜 자세일 때 알림 (warning 포함)
          if (status !== 'good') {
            if (!badPostureStartRef.current) {
              badPostureStartRef.current = Date.now();
            } else {
              const duration = (Date.now() - badPostureStartRef.current) / 1000;
              if (duration >= alertDelay) {
                triggerAlert();
                badPostureStartRef.current = Date.now();
              }
            }
          } else {
            badPostureStartRef.current = null;
          }
        } else {
          // 캘리브레이션 모드
          const detectedAngle = detectCameraAngle(mirrored);
          if (cameraAngleRef.current !== detectedAngle) {
            cameraAngleRef.current = detectedAngle;
            setCameraAngle(detectedAngle);
          }

          drawGuideBox(ctx, canvas.width, canvas.height, detectedAngle);

          const inGuide = checkPoseInGuide(mirrored, canvas.width, canvas.height);
          setPoseInGuide(inGuide);

          drawPoseSilhouette(ctx, mirrored, canvas.width, canvas.height, inGuide ? 'good' : 'warning', detectedAngle);
        }
      } else {
        if (!isMonitoring) {
          drawGuideBox(ctx, canvas.width, canvas.height, cameraAngleRef.current || 'front');
        }
        setPoseInGuide(false);
      }
    } catch (err) {
      console.error('감지 오류:', err);
    }

    animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensitivity, alertDelay, triggerAlert]);

  // detectLoop ref 업데이트
  useEffect(() => {
    detectLoopRef.current = detectLoop;
  }, [detectLoop]);

  // 앱 시작 시 자동으로 카메라 시작
  useEffect(() => {
    if (!isLoading && appState === 'calibrating' && streamRef.current && !cameraReady) {
      const initCamera = async () => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play();
          setCameraReady(true);
          isMonitoringRef.current = false;
          animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
        }
      };
      initCamera();
    }
  }, [isLoading, appState, cameraReady, detectLoop]);

  const completeCalibration = () => {
    if (!smoothedLandmarksRef.current) {
      alert('자세가 인식되지 않았습니다.');
      return;
    }

    if (!poseInGuide) {
      alert('가이드 영역 안에 자세를 맞춰주세요.');
      return;
    }

    const lm = smoothedLandmarksRef.current;
    const angle = cameraAngleRef.current;

    const leftShoulder = lm[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = lm[LANDMARKS.RIGHT_SHOULDER];
    const nose = lm[LANDMARKS.NOSE];
    const leftEar = lm[LANDMARKS.LEFT_EAR];
    const rightEar = lm[LANDMARKS.RIGHT_EAR];

    let newCalibration;

    if (angle === 'side') {
      // 측면 캘리브레이션
      const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder : rightShoulder;
      const ear = isLandmarkValid(leftEar) ? leftEar :
                  isLandmarkValid(rightEar) ? rightEar : null;

      if (!shoulder) {
        alert('어깨가 보이도록 해주세요.');
        return;
      }

      newCalibration = {
        viewMode: 'side',
        shoulderX: 1 - shoulder.x,
        shoulderY: shoulder.y,
        earX: ear ? 1 - ear.x : null,
        earY: ear ? ear.y : null,
        noseX: isLandmarkValid(nose) ? 1 - nose.x : null,
        noseY: isLandmarkValid(nose) ? nose.y : null,
        earShoulderX: ear ? ear.x - shoulder.x : null,
        earNoseY: (ear && isLandmarkValid(nose)) ? ear.y - nose.y : null,
      };

    } else if (angle === 'diagonal') {
      // 정측면 캘리브레이션 - 머리/목 기반 분석
      const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder :
                       isLandmarkValid(rightShoulder) ? rightShoulder : null;
      const ear = isLandmarkValid(leftEar) ? leftEar :
                  isLandmarkValid(rightEar) ? rightEar : null;
      const leftEyeLm = lm[LANDMARKS.LEFT_EYE];
      const rightEyeLm = lm[LANDMARKS.RIGHT_EYE];
      const eye = isLandmarkValid(leftEyeLm) ? leftEyeLm :
                  isLandmarkValid(rightEyeLm) ? rightEyeLm : null;

      if (!shoulder) {
        alert('어깨가 보이도록 해주세요.');
        return;
      }

      const bothShouldersValid = isLandmarkValid(leftShoulder) && isLandmarkValid(rightShoulder);

      newCalibration = {
        viewMode: 'diagonal',
        // 어깨 데이터
        shoulderX: 1 - shoulder.x,
        shoulderY: shoulder.y,
        // 코 데이터
        noseX: isLandmarkValid(nose) ? 1 - nose.x : null,
        noseY: isLandmarkValid(nose) ? nose.y : null,
        // 귀 데이터 (머리/목 분석용)
        earX: ear ? 1 - ear.x : null,
        earY: ear ? ear.y : null,
        // 귀-코 X축 관계 (거북목 핵심 지표)
        earNoseX: (ear && isLandmarkValid(nose)) ? ear.x - nose.x : undefined,
        // 귀-눈 Y축 관계 (머리 기울기)
        earEyeY: (ear && eye) ? ear.y - eye.y : undefined,
        // 코-귀 Y축 관계 (앞뒤 굽힘 구분용)
        noseEarYDiff: (ear && isLandmarkValid(nose)) ? nose.y - ear.y : undefined,
      };

      // 양쪽 어깨가 보이면 정면 데이터도 추가
      if (bothShouldersValid) {
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

        newCalibration.leftShoulderX = 1 - leftShoulder.x;
        newCalibration.leftShoulderY = leftShoulder.y;
        newCalibration.rightShoulderX = 1 - rightShoulder.x;
        newCalibration.rightShoulderY = rightShoulder.y;
        newCalibration.shoulderCenterY = shoulderCenterY;
        newCalibration.shoulderWidth = shoulderWidth;
        newCalibration.shoulderTilt = shoulderTilt;
      }

    } else if (angle === 'back') {
      // 후면 캘리브레이션
      if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) {
        alert('양쪽 어깨가 보이도록 해주세요.');
        return;
      }

      const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

      newCalibration = {
        viewMode: 'back',
        noseX: null,
        noseY: null,
        leftShoulderX: 1 - leftShoulder.x,
        leftShoulderY: leftShoulder.y,
        rightShoulderX: 1 - rightShoulder.x,
        rightShoulderY: rightShoulder.y,
        shoulderCenterY: shoulderCenterY,
        shoulderWidth: shoulderWidth,
        shoulderTilt: shoulderTilt,
      };

    } else {
      // 정면 캘리브레이션
      if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) {
        alert('양쪽 어깨가 보이도록 해주세요.');
        return;
      }

      const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

      newCalibration = {
        viewMode: 'front',
        noseX: isLandmarkValid(nose) ? 1 - nose.x : null,
        noseY: isLandmarkValid(nose) ? nose.y : null,
        leftShoulderX: 1 - leftShoulder.x,
        leftShoulderY: leftShoulder.y,
        rightShoulderX: 1 - rightShoulder.x,
        rightShoulderY: rightShoulder.y,
        shoulderCenterY: shoulderCenterY,
        shoulderWidth: shoulderWidth,
        shoulderTilt: shoulderTilt,
      };
    }

    calibratedPoseRef.current = newCalibration;
    setCalibratedPose(newCalibration);
    isMonitoringRef.current = true;
    badPostureStartRef.current = null;
    frameCountRef.current = 0;
    sessionStartTimeRef.current = Date.now();
    setAppState('monitoring');
    setLastBreakTime(Date.now());
    setIsPaused(false);

    // 휴식 타이머 시작
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    breakTimerRef.current = setInterval(() => {
      if (breakInterval > 0) {
        setShowBreakReminder(true);
        playBeep();
      }
    }, breakInterval * 60 * 1000);

    // 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const stopMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }

    // 세션 결과 저장
    const sessionDuration = sessionStartTimeRef.current
      ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      : 0;

    const totalTicks = stats.goodTime + stats.badTime;
    const goodPercentage = totalTicks > 0 ? Math.round((stats.goodTime / totalTicks) * 100) : 0;

    const result = {
      duration: sessionDuration,
      goodTime: stats.goodTime,
      badTime: stats.badTime,
      alerts: stats.alerts,
      goodPercentage,
      issueCount: { ...stats.issueCount },
      viewMode: calibratedPose?.viewMode || 'front',
      timestamp: new Date().toISOString(),
      startTime: sessionStartTimeRef.current ? new Date(sessionStartTimeRef.current).toISOString() : null,
      timeline: [...postureTimelineRef.current],
    };

    setSessionResult(result);
    saveToHistory(result);
    postureTimelineRef.current = [];

    smoothedLandmarksRef.current = null;
    calibratedPoseRef.current = null;
    isMonitoringRef.current = false;
    guideBoxRef.current = null;
    cameraAngleRef.current = null;
    sessionStartTimeRef.current = null;
    setCalibratedPose(null);
    setPostureStatus('good');
    setPostureIssues([]);
    setCameraReady(false);
    setAppState('result');
    setPoseInGuide(false);
    setCameraAngle(null);
  };

  const recalibrate = () => {
    smoothedLandmarksRef.current = null;
    calibratedPoseRef.current = null;
    isMonitoringRef.current = false;
    cameraAngleRef.current = null;
    lastIssuesRef.current = [];
    issueStartTimeRef.current = {};
    setCalibratedPose(null);
    setAppState('calibrating');
    setPoseInGuide(false);
    setStats({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
    setCameraAngle(null);
  };

  const startNewSession = async () => {
    setSessionResult(null);
    setStats({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
    lastIssuesRef.current = [];
    issueStartTimeRef.current = {};

    // 카메라 다시 시작
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        isMonitoringRef.current = false;
        setAppState('calibrating');
        animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      }
    } catch (err) {
      console.error('카메라 접근 실패:', err);
      alert('카메라 접근 권한이 필요합니다.');
    }
  };

  const formatTime = useCallback((ticks) => {
    const seconds = Math.floor(ticks / 10);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${mins}분 ${secs}초`;
    } else if (mins > 0) {
      return `${mins}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  };

  const getStatusInfo = useCallback(() => {
    switch (postureStatus) {
      case 'bad':
        return { color: '#EF4444', text: '자세 교정 필요!', emoji: '😣', bgColor: 'rgba(239, 68, 68, 0.2)' };
      case 'warning':
        return { color: '#FBBF24', text: '주의', emoji: '😐', bgColor: 'rgba(251, 191, 36, 0.2)' };
      default:
        return { color: '#22C55E', text: '좋은 자세', emoji: '😊', bgColor: 'rgba(34, 197, 94, 0.2)' };
    }
  }, [postureStatus]);

  const getAngleEmoji = (angle) => {
    switch (angle) {
      case 'side': return '📐';
      case 'diagonal': return '↗️';
      case 'back': return '🔙';
      default: return '👤';
    }
  };

  // 상태 정보 메모이제이션
  const statusInfo = useMemo(() => getStatusInfo(), [getStatusInfo]);

  // 포맷된 시간 메모이제이션
  const formattedGoodTime = useMemo(() => formatTime(stats.goodTime), [stats.goodTime, formatTime]);
  const formattedBadTime = useMemo(() => formatTime(stats.badTime), [stats.badTime, formatTime]);

  if (isLoading || cameraError) {
    return (
      <div className="app">
        <div className="loading-screen">
          {isLoading && !cameraError && (
            <>
              <div className="loading-spinner"></div>
              <p>{loadingProgress}</p>
            </>
          )}
          {cameraError && (
            <>
              <div className="error-icon">📷</div>
              <p className="error-message">{cameraError}</p>
              <button className="retry-btn" onClick={retryCamera}>
                다시 시도
              </button>
              <p className="error-hint">
                카메라 권한을 확인하고 다시 시도해주세요.
                <br />
                Android의 경우 앱 설정에서 카메라 권한을 허용해주세요.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* PWA 설치 프롬프트 */}
      {!isInstalled && (
        <InstallPrompt
          isInstallable={isInstallable}
          onInstall={promptInstall}
          showIOSGuide={showIOSInstallGuide}
        />
      )}

      <header className="header" role="banner">
        <h1>자세 교정 알리미</h1>
        <div className="header-buttons" role="group" aria-label="앱 메뉴">
          <button
            className="settings-btn"
            onClick={() => setShowStats(true)}
            aria-label="통계 보기"
            title="통계 보기"
          >
            📊
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowFullSettings(true)}
            aria-label="설정 열기"
            title="설정"
          >
            ⚙️
          </button>
        </div>
      </header>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden-video"
        aria-hidden="true"
      />

      <main className="main" role="main">
        {appState === 'calibrating' && (
          <>
            <div className="camera-wrapper">
              <div className="camera-container calibration-mode">
                <canvas ref={canvasRef} className="camera-canvas" aria-label="자세 감지 카메라 화면" role="img" />

                {/* 상단 뷰 모드 표시 */}
                {cameraAngle && (
                  <div className="calibration-view-badge">
                    <span className="view-icon">{getAngleEmoji(cameraAngle)}</span>
                    <span className="view-label">{VIEW_MODE_LABELS[cameraAngle]} 뷰</span>
                  </div>
                )}

                {/* 상태 표시 */}
                <div className={`calibration-status ${poseInGuide ? 'ready' : 'waiting'}`}>
                  {poseInGuide ? '준비 완료' : '자세를 맞춰주세요'}
                </div>
              </div>
            </div>

            {/* 가이드 및 버튼 영역 */}
            <div className="calibration-panel">
              <div className="calibration-guide">
                <div className="guide-title">기준 자세 설정</div>
                <ul className="guide-list">
                  <li>
                    <span className="guide-icon">🪑</span>
                    <span>허리를 곧게 펴고 바르게 앉아주세요</span>
                  </li>
                  <li>
                    <span className="guide-icon">📱</span>
                    <span>카메라를 고정된 위치에 배치해주세요</span>
                  </li>
                  <li>
                    <span className="guide-icon">👤</span>
                    <span>상체가 화면에 잘 보이도록 조정해주세요</span>
                  </li>
                </ul>
              </div>

              <button
                className={`main-btn ${poseInGuide ? 'start' : 'disabled'}`}
                onClick={completeCalibration}
                disabled={!poseInGuide}
              >
                {poseInGuide ? '이 자세로 시작' : '자세 인식 대기 중...'}
              </button>
            </div>
          </>
        )}

        {appState === 'monitoring' && (
          <>
            {/* 카메라 영역 */}
            <div className="camera-wrapper">
              <div className="camera-container" style={{ borderColor: statusInfo.color }}>
                <canvas ref={canvasRef} className="camera-canvas" aria-label="자세 감지 카메라 화면" role="img" />

                <div
                  className="status-indicator"
                  style={{ backgroundColor: statusInfo.bgColor, borderColor: statusInfo.color }}
                >
                  <span className="status-emoji">{statusInfo.emoji}</span>
                  <span className="status-text" style={{ color: statusInfo.color }}>
                    {statusInfo.text}
                  </span>
                </div>

                {postureIssues.length > 0 && (
                  <div className="issues-container">
                    {postureIssues.map((issue, i) => (
                      <span key={i} className="issue-badge">{issue}</span>
                    ))}
                  </div>
                )}

                {/* 카메라 내부 오른쪽 하단 수치 오버레이 */}
                <div className="camera-stats-overlay">
                  <div className="overlay-stat good">
                    <span className="overlay-value">{formattedGoodTime}</span>
                    <span className="overlay-label">바른</span>
                  </div>
                  <div className="overlay-stat bad">
                    <span className="overlay-value">{formattedBadTime}</span>
                    <span className="overlay-label">나쁜</span>
                  </div>
                  <div className="overlay-stat alert">
                    <span className="overlay-value">{stats.alerts}</span>
                    <span className="overlay-label">알림</span>
                  </div>
                </div>

                {/* 뷰 모드 배지 */}
                <div className="view-mode-badge">
                  {getAngleEmoji(calibratedPose?.viewMode)} {VIEW_MODE_LABELS[calibratedPose?.viewMode] || '정면'}
                </div>

                {/* 디버그 정보 (카메라 내부) */}
                {showDebug && debugInfo && (
                  <div className="camera-debug-overlay">
                    <div className="debug-item">{debugInfo.viewMode}</div>
                    {debugInfo.error ? (
                      <div className="debug-item bad">{debugInfo.error}</div>
                    ) : (
                      <>
                        {debugInfo.shoulderY !== undefined && (
                          <div className={`debug-item ${parseFloat(debugInfo.shoulderY) > parseFloat(debugInfo.shoulderYThreshold) ? 'bad' : ''}`}>
                            어깨: {debugInfo.shoulderY}
                          </div>
                        )}
                        {debugInfo.shoulderWidth !== undefined && (
                          <div className={`debug-item ${parseFloat(debugInfo.shoulderWidth) < parseFloat(debugInfo.widthThreshold) ? 'bad' : ''}`}>
                            너비: {debugInfo.shoulderWidth}
                          </div>
                        )}
                        {debugInfo.shoulderTilt !== undefined && (
                          <div className={`debug-item ${parseFloat(debugInfo.shoulderTilt) > parseFloat(debugInfo.tiltThreshold) ? 'bad' : ''}`}>
                            기울기: {debugInfo.shoulderTilt}
                          </div>
                        )}
                        {debugInfo.headDrop !== undefined && (
                          <div className={`debug-item ${parseFloat(debugInfo.headDrop) > parseFloat(debugInfo.headThreshold) ? 'bad' : ''}`}>
                            고개: {debugInfo.headDrop}
                          </div>
                        )}
                        {debugInfo.noseEarChange !== undefined && (
                          <div className={`debug-item ${Math.abs(parseFloat(debugInfo.noseEarChange)) > parseFloat(debugInfo.bendThreshold) ? 'bad' : ''}`}>
                            앞뒤: {debugInfo.noseEarChange}
                          </div>
                        )}
                        {debugInfo.earNoseXDiff !== undefined && (
                          <div className={`debug-item ${Math.abs(parseFloat(debugInfo.earNoseXDiff)) > parseFloat(debugInfo.neckThreshold) ? 'bad' : ''}`}>
                            목: {debugInfo.earNoseXDiff}
                          </div>
                        )}
                        {(debugInfo.leftWristDist !== undefined || debugInfo.rightWristDist !== undefined) && (
                          <div className={`debug-item ${(parseFloat(debugInfo.leftWristDist || '1') < 0.15 || parseFloat(debugInfo.rightWristDist || '1') < 0.15) ? 'bad' : ''}`}>
                            손: {debugInfo.leftWristDist || '-'}/{debugInfo.rightWristDist || '-'}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 빠른 설정 (한 줄로 통합) + 버튼 */}
            <div className="quick-controls compact">
              <div className="compact-settings">
                <div className="setting-row">
                  <span className="setting-label">민감도</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                    className="sensitivity-slider"
                  />
                  <span className="sensitivity-value">{sensitivity.toFixed(1)}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">알림</span>
                  <div className="alert-controls">
                    {[2, 3, 5].map(d => (
                      <button
                        key={d}
                        className={`quick-btn small ${alertDelay === d ? 'active' : ''}`}
                        onClick={() => setAlertDelay(d)}
                      >
                        {d}초
                      </button>
                    ))}
                    <button
                      className={`quick-btn small ${alertEnabled ? 'on' : 'off'}`}
                      onClick={() => setAlertEnabled(!alertEnabled)}
                    >
                      {alertEnabled ? '켜짐' : '꺼짐'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="action-buttons" role="group" aria-label="모니터링 제어">
                <button
                  className="action-btn recalibrate"
                  onClick={recalibrate}
                  aria-label="기준 자세 재설정"
                >
                  재설정
                </button>
                <button
                  className="action-btn stop"
                  onClick={stopMonitoring}
                  aria-label="모니터링 중지"
                >
                  중지
                </button>
                <button
                  className={`action-btn debug ${showDebug ? 'active' : ''}`}
                  onClick={() => setShowDebug(!showDebug)}
                  title="수치 표시"
                  aria-label={showDebug ? '디버그 정보 숨기기' : '디버그 정보 표시'}
                  aria-pressed={showDebug}
                >
                  {showDebug ? '📊' : '📈'}
                </button>
              </div>
            </div>
          </>
        )}

        {appState === 'result' && sessionResult && (
          <div className="result-container compact">
            {/* 헤더 + 원형 그래프 한 줄 */}
            <div className="result-top">
              <div className="result-chart-small">
                <svg viewBox="0 0 100 100" className="circular-chart small">
                  <circle className="circle-bg" cx="50" cy="50" r="40" />
                  <circle
                    className="circle-progress"
                    cx="50" cy="50" r="40"
                    style={{
                      strokeDasharray: `${sessionResult.goodPercentage * 2.51} 251`,
                      stroke: sessionResult.goodPercentage >= 70 ? '#22C55E' :
                              sessionResult.goodPercentage >= 50 ? '#FBBF24' : '#EF4444'
                    }}
                  />
                </svg>
                <div className="chart-center small">
                  <span className="chart-percentage">{sessionResult.goodPercentage}%</span>
                </div>
              </div>
              <div className="result-info">
                <h2>세션 완료</h2>
                <p className="result-duration">{formatDuration(sessionResult.duration)}</p>
                <div className={`result-feedback-inline ${
                  sessionResult.goodPercentage >= 70 ? 'excellent' :
                  sessionResult.goodPercentage >= 50 ? 'good' : 'needs-work'
                }`}>
                  {sessionResult.goodPercentage >= 70 ? '훌륭해요!' :
                   sessionResult.goodPercentage >= 50 ? '괜찮아요!' : '더 노력해요!'}
                </div>
              </div>
            </div>

            {/* 기본 통계 - 가로 한 줄 */}
            <div className="result-stats-row">
              <div className="result-stat-mini good">
                <span className="stat-mini-value">{formatTime(sessionResult.goodTime)}</span>
                <span className="stat-mini-label">바른</span>
              </div>
              <div className="result-stat-mini bad">
                <span className="stat-mini-value">{formatTime(sessionResult.badTime)}</span>
                <span className="stat-mini-label">나쁜</span>
              </div>
              <div className="result-stat-mini alert">
                <span className="stat-mini-value">{sessionResult.alerts}</span>
                <span className="stat-mini-label">알림</span>
              </div>
            </div>

            {/* 이슈별 통계 - 컴팩트 */}
            {sessionResult.issueCount && Object.keys(sessionResult.issueCount).length > 0 && (
              <div className="issue-breakdown compact">
                <div className="issue-tags">
                  {Object.entries(sessionResult.issueCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([issue, count]) => (
                      <span key={issue} className="issue-tag">
                        {issue} <b>{count}</b>
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 타임라인 바 */}
            {sessionResult.timeline && sessionResult.timeline.length > 0 && (
              <div className="timeline-section">
                <div className="timeline-header">
                  <span className="timeline-title">자세 타임라인</span>
                  <span className="timeline-time">
                    {sessionResult.startTime && new Date(sessionResult.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {' ~ '}
                    {new Date(sessionResult.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="timeline-bar">
                  {sessionResult.timeline.map((entry, i) => (
                    <div
                      key={i}
                      className={`timeline-segment ${entry.status}`}
                      style={{ flex: 1 }}
                      title={entry.issues.length > 0 ? entry.issues.join(', ') : '바른 자세'}
                    />
                  ))}
                </div>
                <div className="timeline-legend">
                  <span className="legend-item good">바른</span>
                  <span className="legend-item warning">주의</span>
                  <span className="legend-item bad">나쁜</span>
                </div>
              </div>
            )}

            <div className="result-buttons">
              <button className="main-btn start" onClick={startNewSession}>
                다시 시작
              </button>
              <button className="main-btn secondary" onClick={() => setShowHistory(true)}>
                기록 보기
              </button>
            </div>
          </div>
        )}

        {/* 히스토리 모달 */}
        {showHistory && (
          <div
            className="modal-backdrop"
            onClick={() => setShowHistory(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            <div className="modal history-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 id="history-modal-title">세션 기록</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowHistory(false)}
                  aria-label="세션 기록 닫기"
                >
                  ✕
                </button>
              </div>

              <div className="history-list">
                {sessionHistory.length === 0 ? (
                  <p className="no-history">기록이 없습니다</p>
                ) : (
                  sessionHistory.map((session, idx) => (
                    <div key={session.id || idx} className="history-item">
                      <div className="history-date">
                        {new Date(session.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="history-stats">
                        <span className={`history-score ${
                          session.goodPercentage >= 70 ? 'good' :
                          session.goodPercentage >= 50 ? 'warning' : 'bad'
                        }`}>
                          {session.goodPercentage}%
                        </span>
                        <span className="history-duration">{formatDuration(session.duration)}</span>
                      </div>
                      {session.timeline && session.timeline.length > 0 && (
                        <div className="history-timeline">
                          {session.timeline.slice(0, 20).map((entry, i) => (
                            <div key={i} className={`mini-segment ${entry.status}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {sessionHistory.length > 0 && (
                <button
                  className="clear-history-btn"
                  onClick={() => {
                    if (confirm('모든 기록을 삭제하시겠습니까?')) {
                      setSessionHistory([]);
                      localStorage.removeItem('postureHistory');
                    }
                  }}
                >
                  기록 삭제
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>설정</h2>

            <div className="setting-group">
              <label>민감도</label>
              <div className="btn-group">
                {[
                  { value: 1.5, label: '낮음' },
                  { value: 1.0, label: '중간' },
                  { value: 0.7, label: '높음' }
                ].map(item => (
                  <button
                    key={item.value}
                    className={`option-btn ${sensitivity === item.value ? 'active' : ''}`}
                    onClick={() => setSensitivity(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="setting-hint">높으면 작은 변화도 감지</p>
            </div>

            <div className="setting-group">
              <label>알림 딜레이</label>
              <div className="btn-group">
                {[
                  { value: 2, label: '2초' },
                  { value: 3, label: '3초' },
                  { value: 5, label: '5초' }
                ].map(item => (
                  <button
                    key={item.value}
                    className={`option-btn ${alertDelay === item.value ? 'active' : ''}`}
                    onClick={() => setAlertDelay(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="setting-hint">나쁜 자세 유지 시 진동까지 걸리는 시간</p>
            </div>

            <div className="setting-group">
              <label>진동 알림</label>
              <button
                className={`toggle-btn ${alertEnabled ? 'on' : 'off'}`}
                onClick={() => setAlertEnabled(!alertEnabled)}
              >
                {alertEnabled ? '켜짐' : '꺼짐'}
              </button>
            </div>

            <button className="modal-btn primary full" onClick={() => setShowSettings(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 전체 설정 모달 */}
      {showFullSettings && (
        <div
          className="modal-backdrop"
          onClick={() => setShowFullSettings(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <div className="modal full-settings-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="settings-modal-title">설정</h2>
              <button
                className="close-btn"
                onClick={() => setShowFullSettings(false)}
                aria-label="설정 닫기"
              >
                ✕
              </button>
            </div>

            {/* 테마 설정 */}
            <div className="settings-section">
              <div className="settings-section-title">🎨 테마</div>
              <div className="settings-row">
                <span className="settings-label">화면 모드</span>
                <div className="theme-btns">
                  <button
                    className={`theme-btn dark ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    🌙 다크
                  </button>
                  <button
                    className={`theme-btn light ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    ☀️ 라이트
                  </button>
                </div>
              </div>
            </div>

            {/* 알림 설정 */}
            <div className="settings-section">
              <div className="settings-section-title">🔔 알림</div>
              <div className="settings-row">
                <span className="settings-label">알림음</span>
                <div className="sound-btns">
                  {['beep', 'chime', 'bell'].map(sound => (
                    <button
                      key={sound}
                      className={`sound-btn ${alertSound === sound ? 'active' : ''}`}
                      onClick={() => setAlertSound(sound)}
                    >
                      {sound === 'beep' ? '📢 비프' : sound === 'chime' ? '🔔 차임' : '🛎️ 벨'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">볼륨</span>
                <div className="volume-control">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={alertVolume}
                    onChange={(e) => setAlertVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                  />
                  <span className="volume-value">{Math.round(alertVolume * 100)}%</span>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">알림 딜레이</span>
                <div className="sound-btns">
                  {[2, 3, 5].map(d => (
                    <button
                      key={d}
                      className={`sound-btn ${alertDelay === d ? 'active' : ''}`}
                      onClick={() => setAlertDelay(d)}
                    >
                      {d}초
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 목표 설정 */}
            <div className="settings-section">
              <div className="settings-section-title">🎯 목표</div>
              <div className="settings-row">
                <span className="settings-label">일일 목표</span>
                <div className="goal-input">
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Math.min(100, Math.max(50, parseInt(e.target.value) || 80)))}
                  />
                  <span>% 바른 자세</span>
                </div>
              </div>
            </div>

            {/* 휴식 설정 */}
            <div className="settings-section">
              <div className="settings-section-title">☕ 휴식 알림</div>
              <div className="settings-row">
                <span className="settings-label">알림 간격</span>
                <div className="break-btns">
                  {[0, 20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      className={`break-btn ${breakInterval === mins ? 'active' : ''}`}
                      onClick={() => setBreakInterval(mins)}
                    >
                      {mins === 0 ? '끄기' : `${mins}분`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 감지 설정 */}
            <div className="settings-section">
              <div className="settings-section-title">📷 감지</div>
              <div className="settings-row">
                <span className="settings-label">민감도</span>
                <div className="volume-control">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                    className="volume-slider"
                  />
                  <span className="volume-value">{sensitivity.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <button className="modal-btn primary full" onClick={() => setShowFullSettings(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 휴식 알림 모달 */}
      {showBreakReminder && (
        <div
          className="modal-backdrop"
          onClick={() => setShowBreakReminder(false)}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="break-reminder-title"
        >
          <div className="modal break-reminder-modal" onClick={e => e.stopPropagation()}>
            <div className="break-icon" aria-hidden="true">☕</div>
            <h2 id="break-reminder-title">휴식 시간!</h2>
            <p className="break-message">
              {breakInterval}분 동안 열심히 하셨어요.<br />
              잠시 일어나서 스트레칭을 해보세요.
            </p>
            <div className="break-tip">
              💡 목을 좌우로 돌리고, 어깨를 으쓱해보세요
            </div>
            <button
              className="modal-btn primary full"
              onClick={() => {
                setShowBreakReminder(false);
                setLastBreakTime(Date.now());
              }}
            >
              확인 (계속하기)
            </button>
          </div>
        </div>
      )}

      {/* 통계 대시보드 모달 */}
      {showStats && (
        <div
          className="modal-backdrop"
          onClick={() => setShowStats(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stats-modal-title"
        >
          <div className="modal stats-dashboard" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="stats-modal-title">통계</h2>
              <button
                className="close-btn"
                onClick={() => setShowStats(false)}
                aria-label="통계 닫기"
              >
                ✕
              </button>
            </div>

            {/* 요약 카드 */}
            <div className="stats-summary">
              <div className="stats-card">
                <div className="stats-card-value">{sessionHistory.length}</div>
                <div className="stats-card-label">총 세션</div>
              </div>
              <div className="stats-card">
                <div className={`stats-card-value ${
                  sessionHistory.length > 0
                    ? (sessionHistory.reduce((sum, s) => sum + s.goodPercentage, 0) / sessionHistory.length) >= 70
                      ? 'good'
                      : (sessionHistory.reduce((sum, s) => sum + s.goodPercentage, 0) / sessionHistory.length) >= 50
                        ? 'warning'
                        : 'bad'
                    : ''
                }`}>
                  {sessionHistory.length > 0
                    ? Math.round(sessionHistory.reduce((sum, s) => sum + s.goodPercentage, 0) / sessionHistory.length)
                    : 0}%
                </div>
                <div className="stats-card-label">평균 점수</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">
                  {sessionHistory.length > 0
                    ? formatDuration(sessionHistory.reduce((sum, s) => sum + s.duration, 0))
                    : '0초'}
                </div>
                <div className="stats-card-label">총 시간</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value bad">
                  {sessionHistory.reduce((sum, s) => sum + s.alerts, 0)}
                </div>
                <div className="stats-card-label">총 알림</div>
              </div>
            </div>

            {/* 최근 7일 그래프 */}
            {sessionHistory.length > 0 && (
              <div className="stats-chart">
                <div className="stats-chart-title">최근 세션</div>
                <div className="stats-bars">
                  {sessionHistory.slice(0, 7).reverse().map((session, i) => (
                    <div key={i} className="stats-bar-item">
                      <div className="stats-bar" style={{ height: '80px' }}>
                        <div
                          className={`stats-bar-fill ${
                            session.goodPercentage >= 70 ? 'good' :
                            session.goodPercentage >= 50 ? 'warning' : 'bad'
                          }`}
                          style={{ height: `${session.goodPercentage}%` }}
                        />
                      </div>
                      <span className="stats-bar-label">{session.goodPercentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 목표 달성 */}
            <div className="stats-goal-progress">
              <div className="stats-goal-header">
                <span className="stats-goal-title">오늘 목표</span>
                <span className="stats-goal-value">
                  {sessionHistory.length > 0 && sessionHistory[0].date?.startsWith(new Date().toISOString().slice(0, 10))
                    ? sessionHistory[0].goodPercentage
                    : 0}% / {dailyGoal}%
                </span>
              </div>
              <div className="stats-goal-bar">
                <div
                  className="stats-goal-fill"
                  style={{
                    width: `${Math.min(100, (
                      sessionHistory.length > 0 && sessionHistory[0].date?.startsWith(new Date().toISOString().slice(0, 10))
                        ? (sessionHistory[0].goodPercentage / dailyGoal) * 100
                        : 0
                    ))}%`
                  }}
                />
              </div>
            </div>

            <button className="modal-btn primary full" onClick={() => setShowStats(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
