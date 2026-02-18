import { useRef, useCallback, useEffect } from 'react';
import {
  DETECTION_INTERVAL,
  STATS_UPDATE_INTERVAL,
  TIMELINE_UPDATE_INTERVAL,
  ISSUE_MIN_DURATION_MS,
  MAX_TIMELINE_ENTRIES,
} from '../constants';
import { smoothLandmarks, detectCameraAngle, analyzePosture } from '../utils/postureAnalysis';
import { drawGuideBox, drawCalibrationSilhouette, drawPoseSilhouette, checkPoseInGuide } from '../utils/canvasDrawing';

/**
 * Hook for posture detection loop
 * @param {Object} options - Detection options
 * @returns {Object} Detection state and controls
 */
export function usePostureDetection({
  videoRef,
  canvasRef,
  poseLandmarkerRef,
  calibratedPoseRef,
  isMonitoringRef,
  sensitivity,
  alertDelay,
  onPostureChange,
  onStatsUpdate,
  onTimelineUpdate,
  onTriggerAlert,
  onCameraAngleChange,
  onPoseInGuideChange,
}) {
  // Refs for mutable state
  const animationFrameRef = useRef(null);
  const smoothedLandmarksRef = useRef(null);
  const guideBoxRef = useRef(null);
  const cameraAngleRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const ctxRef = useRef(null);
  const lastStatusRef = useRef('good');
  const lastIssuesStrRef = useRef('');
  const detectLoopRef = useRef(null);
  const badPostureStartRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastIssuesRef = useRef([]);
  const issueStartTimeRef = useRef({});
  const postureTimelineRef = useRef([]);

  // Detection loop
  const detectLoop = useCallback(() => {
    if (!poseLandmarkerRef?.current || !videoRef?.current || !canvasRef?.current) {
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

      const calibrated = calibratedPoseRef?.current;
      const isMonitoring = isMonitoringRef?.current;

      if (results.landmarks && results.landmarks.length > 0) {
        smoothedLandmarksRef.current = smoothLandmarks(results.landmarks[0], smoothedLandmarksRef.current);
        const mirrored = smoothedLandmarksRef.current.map(lm => ({ ...lm, x: 1 - lm.x }));

        if (isMonitoring && calibrated) {
          const { status, issues, debug } = analyzePosture(
            smoothedLandmarksRef.current,
            calibrated,
            sensitivity,
            cameraAngleRef.current
          );

          if (status !== 'good') {
            drawCalibrationSilhouette(ctx, calibrated, canvas.width, canvas.height);
          }
          drawPoseSilhouette(ctx, mirrored, canvas.width, canvas.height, status, cameraAngleRef.current);

          // Update posture state only when changed
          if (lastStatusRef.current !== status) {
            lastStatusRef.current = status;
            onPostureChange?.({ status, issues, debug });
          }

          const issuesStr = issues.join(',');
          if (lastIssuesStrRef.current !== issuesStr) {
            lastIssuesStrRef.current = issuesStr;
            onPostureChange?.({ status, issues, debug });
          }

          // Stats update
          frameCountRef.current++;
          if (frameCountRef.current % STATS_UPDATE_INTERVAL === 0) {
            const currentTime = Date.now();

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
              return startTime && (currentTime - startTime >= ISSUE_MIN_DURATION_MS) && !lastIssuesRef.current.includes(issue);
            });

            onStatsUpdate?.({ status, persistentNewIssues });

            lastIssuesRef.current = issues.filter(issue => {
              const startTime = issueStartTimeRef.current[issue];
              return startTime && (currentTime - startTime >= ISSUE_MIN_DURATION_MS);
            });
          }

          // Timeline update
          if (frameCountRef.current % TIMELINE_UPDATE_INTERVAL === 0) {
            postureTimelineRef.current.push({ time: Date.now(), status, issues: [...issues] });
            if (postureTimelineRef.current.length > MAX_TIMELINE_ENTRIES) postureTimelineRef.current.shift();
            onTimelineUpdate?.(postureTimelineRef.current);
          }

          // Alert check
          if (status !== 'good') {
            if (!badPostureStartRef.current) {
              badPostureStartRef.current = Date.now();
            } else if ((Date.now() - badPostureStartRef.current) / 1000 >= alertDelay) {
              onTriggerAlert?.();
              badPostureStartRef.current = Date.now();
            }
          } else {
            badPostureStartRef.current = null;
          }
        } else {
          // Calibration mode
          const detectedAngle = detectCameraAngle(mirrored);
          if (cameraAngleRef.current !== detectedAngle) {
            cameraAngleRef.current = detectedAngle;
            onCameraAngleChange?.(detectedAngle);
          }

          drawGuideBox(ctx, canvas.width, canvas.height, guideBoxRef);
          const inGuide = checkPoseInGuide(mirrored, canvas.width, canvas.height, guideBoxRef.current);
          onPoseInGuideChange?.(inGuide);
          drawPoseSilhouette(ctx, mirrored, canvas.width, canvas.height, inGuide ? 'good' : 'warning', detectedAngle);
        }
      } else {
        if (!isMonitoring) {
          drawGuideBox(ctx, canvas.width, canvas.height, guideBoxRef);
        }
        onPoseInGuideChange?.(false);
      }
    } catch (error) {
      console.warn('Detection loop error:', error.message);
    }

    animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
  }, [
    videoRef,
    canvasRef,
    poseLandmarkerRef,
    calibratedPoseRef,
    isMonitoringRef,
    sensitivity,
    alertDelay,
    onPostureChange,
    onStatsUpdate,
    onTimelineUpdate,
    onTriggerAlert,
    onCameraAngleChange,
    onPoseInGuideChange,
  ]);

  // Keep detect loop ref updated
  useEffect(() => {
    detectLoopRef.current = detectLoop;
  }, [detectLoop]);

  // Start detection loop
  const startDetection = useCallback(() => {
    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => detectLoopRef.current?.());
    }
  }, []);

  // Stop detection loop
  const stopDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Reset detection state
  const resetDetection = useCallback(() => {
    smoothedLandmarksRef.current = null;
    guideBoxRef.current = null;
    cameraAngleRef.current = null;
    lastStatusRef.current = 'good';
    lastIssuesStrRef.current = '';
    badPostureStartRef.current = null;
    frameCountRef.current = 0;
    lastIssuesRef.current = [];
    issueStartTimeRef.current = {};
    postureTimelineRef.current = [];
    ctxRef.current = null;
  }, []);

  // Get current landmarks
  const getLandmarks = useCallback(() => smoothedLandmarksRef.current, []);

  // Get timeline
  const getTimeline = useCallback(() => [...postureTimelineRef.current], []);

  // Get camera angle ref
  const getCameraAngleRef = useCallback(() => cameraAngleRef, []);

  return {
    animationFrameRef,
    smoothedLandmarksRef,
    postureTimelineRef,
    cameraAngleRef,
    startDetection,
    stopDetection,
    resetDetection,
    getLandmarks,
    getTimeline,
    getCameraAngleRef,
  };
}

export default usePostureDetection;
