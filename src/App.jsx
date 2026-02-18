import { useState, useEffect, useRef, useCallback } from 'react';
import {
  usePWAInstall,
  useSettings,
  useMediaPipe,
  usePostureDetection,
  useSessionManager,
} from './hooks';
import { useWatchConnection } from './hooks/useWatchConnection';
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
import { LANDMARKS } from './constants';
import {
  playBeep,
  vibrate,
  showNotification,
  requestNotificationPermission,
} from './utils';
import { isLandmarkValid } from './utils/postureAnalysis';
import './App.css';

function App() {
  // Refs for video and canvas elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const calibratedPoseRef = useRef(null);
  const isMonitoringRef = useRef(false);

  // App State
  const [appState, setAppState] = useState('loading');
  const [cameraReady, setCameraReady] = useState(false);

  // Posture State
  const [calibratedPose, setCalibratedPose] = useState(null);
  const [postureStatus, setPostureStatus] = useState('good');
  const [postureIssues, setPostureIssues] = useState([]);
  const [poseInGuide, setPoseInGuide] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  // UI State
  const [showDebug, setShowDebug] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBreakReminder, setShowBreakReminder] = useState(false);

  // Custom Hooks
  const {
    settings,
    updateSettings,
    setSensitivity,
    setAlertEnabled,
    setAlertDelay,
  } = useSettings();
  const { sensitivity, alertEnabled, alertDelay, dailyGoal, breakInterval } = settings;

  const { isInstallable, isInstalled, promptInstall, showIOSInstallGuide } = usePWAInstall();

  // Watch connection for Wear OS
  const {
    isConnected: isWatchConnected,
    watchCount,
    connect: connectWatch,
    disconnect: disconnectWatch,
    sendVibration: sendWatchVibration,
  } = useWatchConnection();

  const {
    poseLandmarkerRef,
    streamRef,
    isLoading,
    loadingProgress,
    cameraError,
    isReady: mediaPipeReady,
    retryCamera,
    stopCamera,
    restartCamera,
  } = useMediaPipe();

  const {
    stats,
    sessionResult,
    sessionHistory,
    updateStats,
    incrementAlerts,
    startSession,
    endSession,
    resetStats,
    clearSessionResult,
    clearHistory,
    cleanup: cleanupSession,
  } = useSessionManager();

  // Trigger alert
  const triggerAlert = useCallback(() => {
    const shouldAlert = incrementAlerts();
    if (!shouldAlert) return;

    if (alertEnabled) {
      vibrate();
      playBeep();
      showNotification('자세 교정 알림', { body: '자세를 바르게 해주세요!' });

      // 워치에 진동 전송
      if (isWatchConnected) {
        sendWatchVibration({ pattern: 'medium', intensity: 255 });
      }
    }
  }, [alertEnabled, incrementAlerts, isWatchConnected, sendWatchVibration]);

  // Posture Detection Hook
  const {
    smoothedLandmarksRef,
    cameraAngleRef,
    startDetection,
    stopDetection,
    resetDetection,
    getTimeline,
  } = usePostureDetection({
    videoRef,
    canvasRef,
    poseLandmarkerRef,
    calibratedPoseRef,
    isMonitoringRef,
    sensitivity,
    alertDelay,
    onPostureChange: ({ status, issues, debug }) => {
      setPostureStatus(status);
      setPostureIssues(issues);
      setDebugInfo(debug);
    },
    onStatsUpdate: updateStats,
    onTriggerAlert: triggerAlert,
    onCameraAngleChange: setCameraAngle,
    onPoseInGuideChange: setPoseInGuide,
  });

  // Initialize app and camera when MediaPipe is ready
  useEffect(() => {
    if (!mediaPipeReady || cameraReady) return;

    const initCamera = async () => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
        setCameraReady(true);
        isMonitoringRef.current = false;
        setAppState('calibrating');
        startDetection();
      }
    };

    initCamera();
  }, [mediaPipeReady, cameraReady, streamRef, startDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      disconnectWatch();
      cleanupSession();
    };
  }, [stopDetection, disconnectWatch, cleanupSession]);

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
    setAppState('monitoring');

    startSession(breakInterval, () => {
      setShowBreakReminder(true);
      playBeep();
    });

    requestNotificationPermission();
  }, [poseInGuide, breakInterval, smoothedLandmarksRef, cameraAngleRef, startSession]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    stopDetection();
    stopCamera();

    const result = endSession(calibratedPose, getTimeline());

    // Reset refs
    calibratedPoseRef.current = null;
    isMonitoringRef.current = false;
    resetDetection();

    // Reset state
    setCalibratedPose(null);
    setPostureStatus('good');
    setPostureIssues([]);
    setCameraReady(false);
    setAppState('result');
    setPoseInGuide(false);
    setCameraAngle(null);

    return result;
  }, [calibratedPose, stopDetection, stopCamera, endSession, getTimeline, resetDetection]);

  // Recalibrate
  const recalibrate = useCallback(() => {
    calibratedPoseRef.current = null;
    isMonitoringRef.current = false;
    resetDetection();

    setCalibratedPose(null);
    setAppState('calibrating');
    setPoseInGuide(false);
    setCameraAngle(null);
    resetStats();
  }, [resetDetection, resetStats]);

  // Start new session
  const startNewSession = useCallback(async () => {
    clearSessionResult();
    resetStats();

    try {
      const stream = await restartCamera();
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        isMonitoringRef.current = false;
        setAppState('calibrating');
        startDetection();
      }
    } catch (error) {
      console.error('Failed to start new session:', error);
      alert('카메라 접근 권한이 필요합니다.');
    }
  }, [clearSessionResult, resetStats, restartCamera, startDetection]);

  // Settings change handler
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
            onNewSession={startNewSession}
            onShowHistory={() => setShowHistory(true)}
          />
        )}
      </main>

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={sessionHistory}
        onClearHistory={clearHistory}
      />

      <SettingsModal
        isOpen={showFullSettings}
        onClose={() => setShowFullSettings(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        watchConnection={{
          isConnected: isWatchConnected,
          watchCount,
          onConnect: connectWatch,
          onDisconnect: disconnectWatch,
        }}
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
