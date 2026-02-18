import { LANDMARKS, THRESHOLDS, SMOOTHING_FACTOR } from '../constants';

// Check if landmark is valid
export const isLandmarkValid = (lm) => {
  return lm && lm.visibility >= THRESHOLDS.MIN_VISIBILITY;
};

// Smooth landmarks for stability
export const smoothLandmarks = (newLandmarks, previousLandmarks) => {
  if (!previousLandmarks) {
    return newLandmarks.map(lm => ({ ...lm }));
  }

  return newLandmarks.map((lm, i) => {
    const prev = previousLandmarks[i];
    return {
      x: prev.x * SMOOTHING_FACTOR + lm.x * (1 - SMOOTHING_FACTOR),
      y: prev.y * SMOOTHING_FACTOR + lm.y * (1 - SMOOTHING_FACTOR),
      z: prev.z * SMOOTHING_FACTOR + lm.z * (1 - SMOOTHING_FACTOR),
      visibility: lm.visibility
    };
  });
};

// Detect camera angle from landmarks
export const detectCameraAngle = (landmarks) => {
  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const leftEar = landmarks[LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
  const nose = landmarks[LANDMARKS.NOSE];
  const leftEye = landmarks[LANDMARKS.LEFT_EYE];
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE];

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const leftShoulderVis = leftShoulder.visibility || 0;
  const rightShoulderVis = rightShoulder.visibility || 0;
  const shoulderVisibilityDiff = Math.abs(leftShoulderVis - rightShoulderVis);
  const avgShoulderVis = (leftShoulderVis + rightShoulderVis) / 2;

  const leftEarVis = leftEar?.visibility || 0;
  const rightEarVis = rightEar?.visibility || 0;
  const leftEarVisible = leftEarVis >= THRESHOLDS.MIN_VISIBILITY;
  const rightEarVisible = rightEarVis >= THRESHOLDS.MIN_VISIBILITY;
  const bothEarsVisible = leftEarVisible && rightEarVisible;
  const noEarsVisible = !leftEarVisible && !rightEarVisible;
  const oneEarVisible = (leftEarVisible || rightEarVisible) && !bothEarsVisible;

  const leftEyeVis = leftEye?.visibility || 0;
  const rightEyeVis = rightEye?.visibility || 0;
  const leftEyeVisible = leftEyeVis >= THRESHOLDS.MIN_VISIBILITY;
  const rightEyeVisible = rightEyeVis >= THRESHOLDS.MIN_VISIBILITY;
  const bothEyesVisible = leftEyeVisible && rightEyeVisible;
  const noEyesVisible = !leftEyeVisible && !rightEyeVisible;

  const noseVis = nose?.visibility || 0;
  const noseVisible = noseVis >= THRESHOLDS.MIN_VISIBILITY;

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const noseOffset = nose ? Math.abs(nose.x - shoulderCenterX) : 0;

  // Back view
  if (!noseVisible && noEyesVisible && noEarsVisible && avgShoulderVis > 0.5) {
    return 'back';
  }
  if (!noseVisible && noEyesVisible && avgShoulderVis > 0.6) {
    return 'back';
  }

  // Pure side view
  const isPureSide =
    shoulderWidth < 0.10 ||
    (oneEarVisible && shoulderWidth < 0.15 && shoulderVisibilityDiff > 0.2) ||
    shoulderVisibilityDiff > 0.4;

  if (isPureSide) {
    return 'side';
  }

  // Front view
  const isPureFront =
    shoulderWidth >= 0.22 &&
    bothEyesVisible &&
    noseOffset < 0.06 &&
    shoulderVisibilityDiff < 0.15;

  if (isPureFront) {
    return 'front';
  }

  // Default to diagonal
  return 'diagonal';
};

// Analyze front view posture
export const analyzeFrontPosture = (landmarks, calibrated, sens) => {
  const issues = [];
  const debug = { viewMode: '정면' };

  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const nose = landmarks[LANDMARKS.NOSE];
  const leftWrist = landmarks[LANDMARKS.LEFT_WRIST];
  const rightWrist = landmarks[LANDMARKS.RIGHT_WRIST];
  const leftElbow = landmarks[LANDMARKS.LEFT_ELBOW];
  const rightElbow = landmarks[LANDMARKS.RIGHT_ELBOW];

  if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) {
    return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '정면' } };
  }

  const currentShoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const currentShoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

  // Shoulder Y change (dropping)
  const shoulderYDiff = currentShoulderCenterY - calibrated.shoulderCenterY;
  const dropThreshold = THRESHOLDS.FRONT.SHOULDER_DROP * sens;
  debug.shoulderY = shoulderYDiff.toFixed(4);
  debug.shoulderYThreshold = dropThreshold.toFixed(4);

  if (shoulderYDiff > dropThreshold) {
    issues.push('자세 처짐');
  } else if (shoulderYDiff < -dropThreshold * 0.8) {
    issues.push('어깨 긴장');
  }

  // Shoulder width change (leaning forward)
  const widthRatio = currentShoulderWidth / calibrated.shoulderWidth;
  const widthThreshold = 1 - (THRESHOLDS.FRONT.SHOULDER_WIDTH * sens);
  debug.shoulderWidth = widthRatio.toFixed(3);
  debug.widthThreshold = widthThreshold.toFixed(3);

  if (widthRatio < widthThreshold) {
    issues.push('앞으로 숙임');
  }

  // Shoulder tilt
  const tiltDiff = currentShoulderTilt - calibrated.shoulderTilt;
  const tiltThreshold = THRESHOLDS.FRONT.SHOULDER_TILT * sens;
  debug.shoulderTilt = tiltDiff.toFixed(4);
  debug.tiltThreshold = tiltThreshold.toFixed(4);

  if (tiltDiff > tiltThreshold) {
    issues.push('어깨 기울어짐');
  }

  // Head drop
  if (isLandmarkValid(nose) && calibrated.noseY !== null) {
    const headDrop = nose.y - calibrated.noseY;
    const headThreshold = THRESHOLDS.FRONT.HEAD_DROP * sens;
    debug.headDrop = headDrop.toFixed(4);
    debug.headThreshold = headThreshold.toFixed(4);

    if (headDrop > headThreshold) {
      issues.push('고개 숙임');
    }
  }

  // Chin resting detection
  if (isLandmarkValid(nose)) {
    let chinResting = false;
    const shoulderY = currentShoulderCenterY;

    if (isLandmarkValid(leftElbow) && leftElbow.y < shoulderY + 0.05) {
      if (isLandmarkValid(leftWrist) && leftWrist.y < shoulderY) {
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

    const chinRestThreshold = 0.12;
    if (isLandmarkValid(leftWrist)) {
      const leftDist = Math.sqrt(
        Math.pow(leftWrist.x - nose.x, 2) + Math.pow(leftWrist.y - nose.y, 2)
      );
      debug.leftWristDist = leftDist.toFixed(3);
      if (leftDist < chinRestThreshold) chinResting = true;
    }

    if (isLandmarkValid(rightWrist)) {
      const rightDist = Math.sqrt(
        Math.pow(rightWrist.x - nose.x, 2) + Math.pow(rightWrist.y - nose.y, 2)
      );
      debug.rightWristDist = rightDist.toFixed(3);
      if (rightDist < chinRestThreshold) chinResting = true;
    }

    if (chinResting) issues.push('턱 괴기');
  }

  const status = issues.length >= 2 ? 'bad' : issues.length === 1 ? 'warning' : 'good';
  return { status, issues, debug };
};

// Analyze side view posture
export const analyzeSidePosture = (landmarks, calibrated, sens) => {
  const issues = [];
  const debug = { viewMode: '측면' };

  const nose = landmarks[LANDMARKS.NOSE];
  const leftEar = landmarks[LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];

  const shoulder = isLandmarkValid(leftShoulder) ? leftShoulder :
                   isLandmarkValid(rightShoulder) ? rightShoulder : null;
  const ear = isLandmarkValid(leftEar) ? leftEar :
              isLandmarkValid(rightEar) ? rightEar : null;

  if (!shoulder) {
    return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '측면' } };
  }

  // Turtle neck check
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

  // Shoulder Y change
  if (calibrated.shoulderY !== null) {
    const shoulderYDiff = shoulder.y - calibrated.shoulderY;
    const dropThreshold = THRESHOLDS.SIDE.SHOULDER_DROP * sens;
    debug.shoulderY = shoulderYDiff.toFixed(4);
    debug.shoulderYThreshold = dropThreshold.toFixed(4);

    if (shoulderYDiff > dropThreshold) {
      issues.push('자세 처짐');
    }
  }

  // Head drop via nose
  if (isLandmarkValid(nose) && calibrated.noseY !== null) {
    const headDrop = nose.y - calibrated.noseY;
    const headThreshold = THRESHOLDS.SIDE.SPINE_CURVE * sens;
    debug.headDrop = headDrop.toFixed(4);
    debug.headThreshold = headThreshold.toFixed(4);

    if (headDrop > headThreshold) {
      issues.push('고개 숙임');
    }
  }

  // Ear-nose Y relationship for head tilt
  if (ear && isLandmarkValid(nose) && calibrated.earNoseY !== null) {
    const currentEarNoseY = ear.y - nose.y;
    const earNoseDiff = currentEarNoseY - calibrated.earNoseY;
    debug.earNoseY = currentEarNoseY.toFixed(4);
    debug.calibratedEarNoseY = calibrated.earNoseY.toFixed(4);

    if (Math.abs(earNoseDiff) > 0.03 * sens) {
      issues.push('머리 기울어짐');
    }
  }

  const status = issues.length >= 2 ? 'bad' : issues.length === 1 ? 'warning' : 'good';
  return { status, issues, debug };
};

// Analyze diagonal view posture
export const analyzeDiagonalPosture = (landmarks, calibrated, sens) => {
  const issues = [];
  const debug = { viewMode: '정측면' };

  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const nose = landmarks[LANDMARKS.NOSE];
  const leftEar = landmarks[LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
  const leftEye = landmarks[LANDMARKS.LEFT_EYE];
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE];

  const bothShouldersValid = isLandmarkValid(leftShoulder) && isLandmarkValid(rightShoulder);
  const mainShoulder = isLandmarkValid(leftShoulder) ? leftShoulder :
                       isLandmarkValid(rightShoulder) ? rightShoulder : null;
  const ear = isLandmarkValid(leftEar) ? leftEar :
              isLandmarkValid(rightEar) ? rightEar : null;
  const eye = isLandmarkValid(leftEye) ? leftEye :
              isLandmarkValid(rightEye) ? rightEye : null;

  if (!mainShoulder) {
    return { status: 'good', issues: [], debug: { error: '어깨 감지 안됨', viewMode: '정측면' } };
  }

  // Neck tilt (ear-nose X relationship) - turtle neck
  if (ear && isLandmarkValid(nose) && calibrated.earNoseX !== undefined) {
    const currentEarNoseX = ear.x - nose.x;
    const earNoseXDiff = currentEarNoseX - calibrated.earNoseX;
    const neckThreshold = 0.025 * sens;

    debug.earNoseX = currentEarNoseX.toFixed(4);
    debug.calibratedEarNoseX = calibrated.earNoseX.toFixed(4);
    debug.earNoseXDiff = earNoseXDiff.toFixed(4);
    debug.neckThreshold = neckThreshold.toFixed(4);

    if (Math.abs(earNoseXDiff) > neckThreshold) {
      issues.push('거북목');
    }
  }

  // Head height change (ear Y)
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
    const headDrop = nose.y - calibrated.noseY;
    const headThreshold = THRESHOLDS.DIAGONAL.HEAD_DROP * sens;
    debug.headDrop = headDrop.toFixed(4);
    debug.headThreshold = headThreshold.toFixed(4);

    if (headDrop > headThreshold) {
      issues.push('고개 숙임');
    }
  }

  // Head tilt (ear-eye Y)
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

  // Forward/backward bending (nose-ear Y)
  if (ear && isLandmarkValid(nose) && calibrated.noseEarYDiff !== undefined) {
    const currentNoseEarYDiff = nose.y - ear.y;
    const noseEarChange = currentNoseEarYDiff - calibrated.noseEarYDiff;
    const bendThreshold = 0.03 * sens;

    debug.noseEarYDiff = currentNoseEarYDiff.toFixed(4);
    debug.calibratedNoseEarYDiff = calibrated.noseEarYDiff.toFixed(4);
    debug.noseEarChange = noseEarChange.toFixed(4);
    debug.bendThreshold = bendThreshold.toFixed(4);

    if (noseEarChange > bendThreshold) {
      issues.push('앞으로 굽힘');
    } else if (noseEarChange < -bendThreshold) {
      issues.push('뒤로 젖힘');
    }
  } else if (calibrated.shoulderY !== null || calibrated.shoulderCenterY !== null) {
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

  // Shoulder width change
  if (bothShouldersValid && calibrated.shoulderWidth) {
    const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const widthRatio = currentShoulderWidth / calibrated.shoulderWidth;
    const widthThreshold = 1 - (THRESHOLDS.DIAGONAL.SHOULDER_WIDTH * sens);

    debug.shoulderWidth = widthRatio.toFixed(3);
    debug.widthThreshold = widthThreshold.toFixed(3);

    if (widthRatio < widthThreshold && !issues.includes('앞으로 굽힘')) {
      issues.push('앞으로 굽힘');
    }
  }

  // Chin resting
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
      if (leftDist < chinRestThreshold) chinResting = true;
    }

    if (isLandmarkValid(rightWrist)) {
      const rightDist = Math.sqrt(
        Math.pow(rightWrist.x - nose.x, 2) + Math.pow(rightWrist.y - nose.y, 2)
      );
      debug.rightWristDist = rightDist.toFixed(3);
      if (rightDist < chinRestThreshold) chinResting = true;
    }

    if (chinResting) issues.push('턱 괴기');
  }

  const status = issues.length >= 2 ? 'bad' : issues.length === 1 ? 'warning' : 'good';
  return { status, issues, debug };
};

// Analyze back view posture
export const analyzeBackPosture = (landmarks, calibrated, sens) => {
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

  // Shoulder Y change
  if (calibrated.shoulderCenterY !== null) {
    const shoulderYDiff = currentShoulderCenterY - calibrated.shoulderCenterY;
    const dropThreshold = THRESHOLDS.BACK.SHOULDER_DROP * sens;
    debug.shoulderY = shoulderYDiff.toFixed(4);
    debug.shoulderYThreshold = dropThreshold.toFixed(4);

    if (shoulderYDiff > dropThreshold) {
      issues.push('자세 처짐');
    }
  }

  // Shoulder width change
  if (calibrated.shoulderWidth) {
    const widthRatio = currentShoulderWidth / calibrated.shoulderWidth;
    const widthThreshold = 1 - (THRESHOLDS.BACK.SHOULDER_WIDTH * sens);
    debug.shoulderWidth = widthRatio.toFixed(3);
    debug.widthThreshold = widthThreshold.toFixed(3);

    if (widthRatio < widthThreshold) {
      issues.push('등 굽음');
    }
  }

  // Shoulder tilt
  if (calibrated.shoulderTilt !== undefined) {
    const tiltDiff = currentShoulderTilt - calibrated.shoulderTilt;
    const tiltThreshold = THRESHOLDS.BACK.SHOULDER_TILT * sens;
    debug.shoulderTilt = tiltDiff.toFixed(4);
    debug.tiltThreshold = tiltThreshold.toFixed(4);

    if (tiltDiff > tiltThreshold) {
      issues.push('어깨 기울어짐');
    }
  }

  const status = issues.length >= 2 ? 'bad' : issues.length === 1 ? 'warning' : 'good';
  return { status, issues, debug };
};

// Main posture analysis function
export const analyzePosture = (landmarks, calibrated, sens, cameraAngle) => {
  if (!landmarks || landmarks.length === 0 || !calibrated) {
    return { status: 'good', issues: [], debug: {} };
  }

  switch (cameraAngle) {
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
