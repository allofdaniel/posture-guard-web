import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { usePWAInstall, useSettings } from './hooks';
import {
  LoadingScreen,
  InstallPrompt,
  CalibrationView,
  MonitoringView,
  SessionResult,
  HistoryModal,
  SettingsModal,
  StatsModal,
  BreakReminderModal,
} from './components';
import {
  LANDMARKS,
  DETECTION_INTERVAL,
} from './constants';
import {
  checkCameraSupport,
  requestCameraStream,
  getCameraErrorMessage,
  playBeep,
  vibrate,
  showNotification,
  requestNotificationPermission,
  loadHistory,
  saveHistory,
} from './utils';
import {
  smoothLandmarks,
  detectCameraAngle,
  analyzePosture,
  isLandmarkValid,
} from './utils/postureAnalysis';
import {
  drawGuideBox,
  drawCalibrationSilhouette,
  drawPoseSilhouette,
  checkPoseInGuide,
} from './utils/canvasDrawing';
import './App.css';

function App() {
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const smoothedLandmarksRef = useRef(null);
  const calibratedPoseRef = useRef(null);
  const isMonitoringRef = useRef(false);
  const guideBoxRef = useRef(null);
  const cameraAngleRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const ctxRef = useRef(null);
  const lastStatusRef = useRef('good');
  const lastIssuesStrRef = useRef('');
  const detectLoopRef = useRef(null);
  const lastAlertTime = useRef(0);
  const badPostureStartRef = useRef(null);
  const frameCountRef = useRef(0);
  const breakTimerRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const lastIssuesRef = useRef([]);
  const issueStartTimeRef = useRef({});
  const postureTimelineRef = useRef([]);

  // App State
  const [appState, setAppState] = useState('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('AI 모델 로딩 중...');
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Posture State
  const [calibratedPose, setCalibratedPose] = useState(null);
  const [postureStatus, setPostureStatus] = useState('good');
  const [postureIssues, setPostureIssues] = useState([]);
  const [poseInGuide, setPoseInGuide] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  // Settings (consolidated into useSettings hook)
  const {
    settings,
    updateSettings,
    setSensitivity,
    setAlertEnabled,
    setAlertDelay,
  } = useSettings();
  const { sensitivity, alertEnabled, alertDelay, dailyGoal, breakInterval } = settings;

  // UI State
  const [showDebug, setShowDebug] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBreakReminder, setShowBreakReminder] = useState(false);

  // Session State
  const [stats, setStats] = useState({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionHistory, setSessionHistory] = useState(() => loadHistory());

  // PWA
  const { isInstallable, isInstalled, promptInstall, showIOSInstallGuide } = usePWAInstall();

  // MediaPipe initialization
  const initMediaPipe = async () => {
    setLoadingProgress('MediaPipe 초기화 중...');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    setLoadingProgress('AI 모델 다운로드 중...');

    const delegates = ['GPU', 'CPU'];
    for (const delegate of delegates) {
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
            delegate
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch {
        // Continue to next delegate
      }
    }
    throw new Error('MediaPipe 초기화 실패');
  };

  // Initialize camera and MediaPipe
  useEffect(() => {
    const init = async () => {
      try {
        const cameraSupport = await checkCameraSupport();
        if (!cameraSupport.supported) {
          setCameraError(cameraSupport.message);
          setIsLoading(false);
          return;
        }

        poseLandmarkerRef.current = await initMediaPipe();

        setLoadingProgress('카메라 시작 중...');
        const cameraResult = await requestCameraStream();

        if (cameraResult.success) {
          streamRef.current = cameraResult.stream;
          setCameraError(null);
          setIsLoading(false);
          setAppState('calibrating');
        } else {
          setCameraError(getCameraErrorMessage(cameraResult.error));
          setIsLoading(false);
        }
      } catch (err) {
        setCameraError(err.message || '초기화 실패');
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, []);

  // Retry camera
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
        setCameraError(getCameraErrorMessage(cameraResult.error));
        setIsLoading(false);
      }
    } catch (err) {
      setCameraError(getCameraErrorMessage(err));
      setIsLoading(false);
    }
  };

  // Trigger alert
  const triggerAlert = useCallback(() => {
    const now = Date.now();
    if (now - lastAlertTime.current < 3000) return;

    lastAlertTime.current = now;
    setStats(prev => ({ ...prev, alerts: prev.alerts + 1 }));

    if (alertEnabled) {
      vibrate();
      playBeep();
      showNotification('자세 교정 알림', { body: '자세를 바르게 해주세요!' });
    }
  }, [alertEnabled]);

  // Detection loop
  const detectLoop = useCallback(() => {
    if (!poseLandmarkerRef.current || !videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext('2d', { alpha: false });
    }
    const ctx = ctxRef.current;

    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }

    const now = performance.now();
    if (now - lastDetectionTimeRef.current < DETECTION_INTERVAL) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }
    lastDetectionTimeRef.current = now;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctxRef.current = null;
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
      return;
    }

    try {
      const results = poseLandmarkerRef.current.detectForVideo(video, now);

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      const calibrated = calibratedPoseRef.current;
      const isMonitoring = isMonitoringRef.current;

      if (results.landmarks && results.landmarks.length > 0) {
        smoothedLandmarksRef.current = smoothLandmarks(results.landmarks[0], smoothedLandmarksRef.current);
        const mirrored = smoothedLandmarksRef.current.map(lm => ({ ...lm, x: 1 - lm.x }));

        if (isMonitoring && calibrated) {
          const { status, issues, debug } = analyzePosture(smoothedLandmarksRef.current, calibrated, sensitivity, cameraAngleRef.current);

          if (status !== 'good') {
            drawCalibrationSilhouette(ctx, calibrated, canvas.width, canvas.height);
          }
          drawPoseSilhouette(ctx, mirrored, canvas.width, canvas.height, status, cameraAngleRef.current);

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
            const currentTime = Date.now();
            const ISSUE_MIN_DURATION = 1000;

            issues.forEach(issue => {
              if (!issueStartTimeRef.current[issue]) {
                issueStartTimeRef.current[issue] = currentTime;
              }
            });

            Object.keys(issueStartTimeRef.current).forEach(issue => {
              if (!issues.includes(issue)) delete issueStartTimeRef.current[issue];
            });

            const persistentNewIssues = issues.filter(issue => {
              const startTime = issueStartTimeRef.current[issue];
              return startTime && (currentTime - startTime >= ISSUE_MIN_DURATION) && !lastIssuesRef.current.includes(issue);
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

            lastIssuesRef.current = issues.filter(issue => {
              const startTime = issueStartTimeRef.current[issue];
              return startTime && (currentTime - startTime >= ISSUE_MIN_DURATION);
            });
          }

          if (frameCountRef.current % 30 === 0) {
            postureTimelineRef.current.push({ time: Date.now(), status, issues: [...issues] });
            if (postureTimelineRef.current.length > 360) postureTimelineRef.current.shift();
          }

          if (status !== 'good') {
            if (!badPostureStartRef.current) {
              badPostureStartRef.current = Date.now();
            } else if ((Date.now() - badPostureStartRef.current) / 1000 >= alertDelay) {
              triggerAlert();
              badPostureStartRef.current = Date.now();
            }
          } else {
            badPostureStartRef.current = null;
          }
        } else {
          const detectedAngle = detectCameraAngle(mirrored);
          if (cameraAngleRef.current !== detectedAngle) {
            cameraAngleRef.current = detectedAngle;
            setCameraAngle(detectedAngle);
          }

          drawGuideBox(ctx, canvas.width, canvas.height, guideBoxRef);
          const inGuide = checkPoseInGuide(mirrored, canvas.width, canvas.height, guideBoxRef.current);
          setPoseInGuide(inGuide);
          drawPoseSilhouette(ctx, mirrored, canvas.width, canvas.height, inGuide ? 'good' : 'warning', detectedAngle);
        }
      } else {
        if (!isMonitoring) {
          drawGuideBox(ctx, canvas.width, canvas.height, guideBoxRef);
        }
        setPoseInGuide(false);
      }
    } catch {
      // Silent error handling
    }

    animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
  }, [sensitivity, alertDelay, triggerAlert]);

  useEffect(() => {
    detectLoopRef.current = detectLoop;
  }, [detectLoop]);

  // Start camera when ready
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
  }, [isLoading, appState, cameraReady]);

  // Complete calibration
  const completeCalibration = useCallback(() => {
    if (!smoothedLandmarksRef.current || !poseInGuide) return;

    const lm = smoothedLandmarksRef.current;
    const angle = cameraAngleRef.current;
    const leftShoulder = lm[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = lm[LANDMARKS.RIGHT_SHOULDER];
    const nose = lm[LANDMARKS.NOSE];
    const leftEar = lm[LANDMARKS.LEFT_EAR];
    const rightEar = lm[LANDMARKS.RIGHT_EAR];

    let newCalibration;

    if (angle === 'side') {
      const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder : rightShoulder;
      const ear = isLandmarkValid(leftEar) ? leftEar : isLandmarkValid(rightEar) ? rightEar : null;
      if (!shoulder) return;

      newCalibration = {
        viewMode: 'side',
        shoulderX: 1 - shoulder.x, shoulderY: shoulder.y,
        earX: ear ? 1 - ear.x : null, earY: ear ? ear.y : null,
        noseX: isLandmarkValid(nose) ? 1 - nose.x : null, noseY: isLandmarkValid(nose) ? nose.y : null,
        earShoulderX: ear ? ear.x - shoulder.x : null,
        earNoseY: (ear && isLandmarkValid(nose)) ? ear.y - nose.y : null,
      };
    } else if (angle === 'diagonal') {
      const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder : isLandmarkValid(rightShoulder) ? rightShoulder : null;
      const ear = isLandmarkValid(leftEar) ? leftEar : isLandmarkValid(rightEar) ? rightEar : null;
      const eye = isLandmarkValid(lm[LANDMARKS.LEFT_EYE]) ? lm[LANDMARKS.LEFT_EYE] : isLandmarkValid(lm[LANDMARKS.RIGHT_EYE]) ? lm[LANDMARKS.RIGHT_EYE] : null;
      if (!shoulder) return;

      const bothShouldersValid = isLandmarkValid(leftShoulder) && isLandmarkValid(rightShoulder);
      newCalibration = {
        viewMode: 'diagonal',
        shoulderX: 1 - shoulder.x, shoulderY: shoulder.y,
        noseX: isLandmarkValid(nose) ? 1 - nose.x : null, noseY: isLandmarkValid(nose) ? nose.y : null,
        earX: ear ? 1 - ear.x : null, earY: ear ? ear.y : null,
        earNoseX: (ear && isLandmarkValid(nose)) ? ear.x - nose.x : undefined,
        earEyeY: (ear && eye) ? ear.y - eye.y : undefined,
        noseEarYDiff: (ear && isLandmarkValid(nose)) ? nose.y - ear.y : undefined,
      };

      if (bothShouldersValid) {
        Object.assign(newCalibration, {
          leftShoulderX: 1 - leftShoulder.x, leftShoulderY: leftShoulder.y,
          rightShoulderX: 1 - rightShoulder.x, rightShoulderY: rightShoulder.y,
          shoulderCenterY: (leftShoulder.y + rightShoulder.y) / 2,
          shoulderWidth: Math.abs(leftShoulder.x - rightShoulder.x),
          shoulderTilt: Math.abs(leftShoulder.y - rightShoulder.y),
        });
      }
    } else if (angle === 'back') {
      if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) return;
      newCalibration = {
        viewMode: 'back', noseX: null, noseY: null,
        leftShoulderX: 1 - leftShoulder.x, leftShoulderY: leftShoulder.y,
        rightShoulderX: 1 - rightShoulder.x, rightShoulderY: rightShoulder.y,
        shoulderCenterY: (leftShoulder.y + rightShoulder.y) / 2,
        shoulderWidth: Math.abs(leftShoulder.x - rightShoulder.x),
        shoulderTilt: Math.abs(leftShoulder.y - rightShoulder.y),
      };
    } else {
      if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) return;
      newCalibration = {
        viewMode: 'front',
        noseX: isLandmarkValid(nose) ? 1 - nose.x : null, noseY: isLandmarkValid(nose) ? nose.y : null,
        leftShoulderX: 1 - leftShoulder.x, leftShoulderY: leftShoulder.y,
        rightShoulderX: 1 - rightShoulder.x, rightShoulderY: rightShoulder.y,
        shoulderCenterY: (leftShoulder.y + rightShoulder.y) / 2,
        shoulderWidth: Math.abs(leftShoulder.x - rightShoulder.x),
        shoulderTilt: Math.abs(leftShoulder.y - rightShoulder.y),
      };
    }

    calibratedPoseRef.current = newCalibration;
    setCalibratedPose(newCalibration);
    isMonitoringRef.current = true;
    badPostureStartRef.current = null;
    frameCountRef.current = 0;
    sessionStartTimeRef.current = Date.now();
    setAppState('monitoring');

    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    if (breakInterval > 0) {
      breakTimerRef.current = setInterval(() => {
        setShowBreakReminder(true);
        playBeep();
      }, breakInterval * 60 * 1000);
    }

    requestNotificationPermission();
  }, [poseInGuide, breakInterval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
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

    const sessionDuration = sessionStartTimeRef.current
      ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000) : 0;
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

    const newEntry = { id: Date.now(), date: new Date().toISOString(), ...result };
    const updated = [newEntry, ...sessionHistory].slice(0, 30);
    setSessionHistory(updated);
    saveHistory(updated);

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
  }, [stats, calibratedPose, sessionHistory]);

  // Recalibrate
  const recalibrate = useCallback(() => {
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
  }, []);

  // Start new session
  const startNewSession = useCallback(async () => {
    setSessionResult(null);
    setStats({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
    lastIssuesRef.current = [];
    issueStartTimeRef.current = {};

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
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
    } catch {
      alert('카메라 접근 권한이 필요합니다.');
    }
  }, []);

  // Settings change handler (uses updateSettings from useSettings hook)
  const handleSettingsChange = useCallback((newSettings) => {
    updateSettings(newSettings);
  }, [updateSettings]);

  // Loading/Error screen
  if (isLoading || cameraError) {
    return (
      <LoadingScreen
        isLoading={isLoading}
        loadingProgress={loadingProgress}
        cameraError={cameraError}
        onRetry={retryCamera}
      />
    );
  }

  return (
    <div className="app">
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
          <button className="settings-btn" onClick={() => setShowStats(true)} aria-label="통계 보기">📊</button>
          <button className="settings-btn" onClick={() => setShowFullSettings(true)} aria-label="설정 열기">⚙️</button>
        </div>
      </header>

      <video ref={videoRef} autoPlay playsInline muted className="hidden-video" aria-hidden="true" />

      <main className="main" role="main">
        {appState === 'calibrating' && (
          <CalibrationView
            canvasRef={canvasRef}
            cameraAngle={cameraAngle}
            poseInGuide={poseInGuide}
            onCalibrate={completeCalibration}
          />
        )}

        {appState === 'monitoring' && (
          <MonitoringView
            canvasRef={canvasRef}
            postureStatus={postureStatus}
            postureIssues={postureIssues}
            calibratedPose={calibratedPose}
            stats={stats}
            showDebug={showDebug}
            debugInfo={debugInfo}
            sensitivity={sensitivity}
            alertDelay={alertDelay}
            alertEnabled={alertEnabled}
            onSensitivityChange={setSensitivity}
            onAlertDelayChange={setAlertDelay}
            onAlertEnabledChange={setAlertEnabled}
            onRecalibrate={recalibrate}
            onStop={stopMonitoring}
            onToggleDebug={() => setShowDebug(!showDebug)}
          />
        )}

        {appState === 'result' && sessionResult && (
          <SessionResult
            result={sessionResult}
            onStartNew={startNewSession}
            onShowHistory={() => setShowHistory(true)}
          />
        )}
      </main>

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={sessionHistory}
        onClear={() => {
          setSessionHistory([]);
          saveHistory([]);
        }}
      />

      <SettingsModal
        isOpen={showFullSettings}
        onClose={() => setShowFullSettings(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      <StatsModal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        history={sessionHistory}
        dailyGoal={dailyGoal}
      />

      <BreakReminderModal
        isOpen={showBreakReminder}
        onClose={() => setShowBreakReminder(false)}
        breakInterval={breakInterval}
      />
    </div>
  );
}

export default App;
