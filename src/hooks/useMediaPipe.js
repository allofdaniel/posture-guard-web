import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { checkCameraSupport, requestCameraStream, getCameraErrorMessage } from '../utils';

// Constants
const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MEDIAPIPE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

// Check if running in E2E test mode
const isE2ETestMode = () => {
  if (typeof window !== 'undefined') {
    return window.__E2E_TEST_MODE__ === true
      || window.__MEDIAPIPE_MOCK__ === true
      || new URLSearchParams(window.location.search).get('e2e') === 'true';
  }
  return false;
};

// Mock PoseLandmarker for E2E tests
const createMockPoseLandmarker = () => ({
  detectForVideo: () => {
    const landmarks = window.__mockPoseLandmarks || {
      landmarks: [[
        { x: 0.5, y: 0.15, z: 0, visibility: 0.95 },
        { x: 0.48, y: 0.14, z: 0, visibility: 0.95 },
        { x: 0.47, y: 0.14, z: 0, visibility: 0.95 },
        { x: 0.46, y: 0.14, z: 0, visibility: 0.95 },
        { x: 0.52, y: 0.14, z: 0, visibility: 0.95 },
        { x: 0.53, y: 0.14, z: 0, visibility: 0.95 },
        { x: 0.54, y: 0.14, z: 0, visibility: 0.95 },
        { x: 0.44, y: 0.15, z: 0, visibility: 0.9 },
        { x: 0.56, y: 0.15, z: 0, visibility: 0.9 },
        { x: 0.48, y: 0.18, z: 0, visibility: 0.9 },
        { x: 0.52, y: 0.18, z: 0, visibility: 0.9 },
        { x: 0.42, y: 0.35, z: 0, visibility: 0.95 },
        { x: 0.58, y: 0.35, z: 0, visibility: 0.95 },
        ...Array(20).fill(null).map((_, i) => ({
          x: 0.5,
          y: 0.5 + (i * 0.02),
          z: 0,
          visibility: 0.8,
        })),
      ]],
      worldLandmarks: [],
      segmentationMasks: [],
    };
    return landmarks;
  },
  close: () => {},
});

/**
 * Hook for initializing MediaPipe and camera
 * @returns {Object} MediaPipe state and controls
 */
export function useMediaPipe() {
  const poseLandmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(true);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('AI 모델 로딩 중...');
  const [cameraError, setCameraError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const stopStream = useCallback((stream) => {
    if (!stream) return;

    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error) {
        console.warn('Failed to stop media track:', error.message);
      }
    });
  }, []);

  const clearStream = useCallback(() => {
    if (streamRef.current) {
      stopStream(streamRef.current);
      streamRef.current = null;
    }
  }, [stopStream]);

  const safeSetState = (setter, value) => {
    if (!isActiveRef.current) return;
    setter(value);
  };

  // Initialize MediaPipe
  const initMediaPipe = async () => {
    // In E2E test mode, return mock immediately
    if (isE2ETestMode()) {
      return createMockPoseLandmarker();
    }

    setLoadingProgress('MediaPipe 모델 로드 중...');
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    setLoadingProgress('AI 분석 라이브러리 준비 중...');

    const delegates = ['GPU', 'CPU'];
    for (const delegate of delegates) {
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_MODEL_URL,
            delegate,
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (error) {
        console.warn(`MediaPipe ${delegate} delegate failed:`, error.message);
      }
    }

    throw new Error('MediaPipe initialization failed');
  };

  // Initialize on mount
  useEffect(() => {
    isActiveRef.current = true;

    const init = async () => {
      try {
        // In E2E test mode, skip camera support check
        if (!isE2ETestMode()) {
          const cameraSupport = await checkCameraSupport();
          if (!cameraSupport.supported) {
            safeSetState(setCameraError, cameraSupport.message);
            safeSetState(setIsLoading, false);
            return;
          }
        }

        poseLandmarkerRef.current = await initMediaPipe();

        safeSetState(setLoadingProgress, '카메라 접근 중...');
        const cameraResult = await requestCameraStream();

        if (!isActiveRef.current) return;

        if (cameraResult.success) {
          clearStream();
          streamRef.current = cameraResult.stream;
          setCameraError(null);
          setIsLoading(false);
          setIsReady(true);
        } else {
          setCameraError(getCameraErrorMessage(cameraResult.error));
          setIsLoading(false);
        }
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        safeSetState(setCameraError, err.message || 'MediaPipe 초기화 실패');
        safeSetState(setIsLoading, false);
      }
    };

    init();

    return () => {
      isActiveRef.current = false;
      clearStream();

      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close?.();
        poseLandmarkerRef.current = null;
      }
    };
  }, [clearStream]);

  // Retry camera
  const retryCamera = async () => {
    setCameraError(null);
    setIsLoading(true);
    setLoadingProgress('카메라 재시도 중...');

    try {
      clearStream();
      const cameraResult = await requestCameraStream();
      if (cameraResult.success) {
        streamRef.current = cameraResult.stream;
        setCameraError(null);
        setIsLoading(false);
        setIsReady(true);
      } else {
        setCameraError(getCameraErrorMessage(cameraResult.error));
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Camera retry error:', err);
      setCameraError(getCameraErrorMessage(err));
      setIsLoading(false);
      setIsReady(false);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    clearStream();
    setIsReady(false);
  };

  // Restart camera stream
  const restartCamera = async () => {
    try {
      clearStream();
      const cameraResult = await requestCameraStream();

      if (!cameraResult.success) {
        throw cameraResult.error || new Error('Unable to access camera');
      }

      const stream = cameraResult.stream;
      streamRef.current = stream;
      setIsReady(true);
      return stream;
    } catch (error) {
      console.error('Camera restart error:', error);
      setIsReady(false);
      throw error;
    }
  };

  return {
    poseLandmarkerRef,
    streamRef,
    isLoading,
    loadingProgress,
    cameraError,
    isReady,
    retryCamera,
    stopCamera,
    restartCamera,
  };
}

export default useMediaPipe;
