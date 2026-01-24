import { LANDMARKS } from '../constants';

// Draw guide box for calibration
export const drawGuideBox = (ctx, width, height, guideBoxRef) => {
  const boxWidth = width * 0.92;
  const boxHeight = height * 0.92;
  const boxX = (width - boxWidth) / 2;
  const boxY = (height - boxHeight) / 2;

  if (guideBoxRef) {
    guideBoxRef.current = { x: boxX, y: boxY, width: boxWidth, height: boxHeight };
  }

  const cornerLength = 30;
  const cornerRadius = 4;

  ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + cornerLength);
  ctx.lineTo(boxX, boxY + cornerRadius);
  ctx.arcTo(boxX, boxY, boxX + cornerRadius, boxY, cornerRadius);
  ctx.lineTo(boxX + cornerLength, boxY);
  ctx.stroke();

  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(boxX + boxWidth - cornerLength, boxY);
  ctx.lineTo(boxX + boxWidth - cornerRadius, boxY);
  ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + cornerRadius, cornerRadius);
  ctx.lineTo(boxX + boxWidth, boxY + cornerLength);
  ctx.stroke();

  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + boxHeight - cornerLength);
  ctx.lineTo(boxX, boxY + boxHeight - cornerRadius);
  ctx.arcTo(boxX, boxY + boxHeight, boxX + cornerRadius, boxY + boxHeight, cornerRadius);
  ctx.lineTo(boxX + cornerLength, boxY + boxHeight);
  ctx.stroke();

  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(boxX + boxWidth - cornerLength, boxY + boxHeight);
  ctx.lineTo(boxX + boxWidth - cornerRadius, boxY + boxHeight);
  ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth, boxY + boxHeight - cornerRadius, cornerRadius);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerLength);
  ctx.stroke();

  // Center crosshair
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);

  ctx.beginPath();
  ctx.moveTo(width / 2, boxY + 20);
  ctx.lineTo(width / 2, boxY + boxHeight - 20);
  ctx.stroke();

  const shoulderGuideY = boxY + boxHeight * 0.45;
  ctx.beginPath();
  ctx.moveTo(boxX + 20, shoulderGuideY);
  ctx.lineTo(boxX + boxWidth - 20, shoulderGuideY);
  ctx.stroke();

  ctx.setLineDash([]);

  return { x: boxX, y: boxY, width: boxWidth, height: boxHeight };
};

// Draw calibration reference silhouette
export const drawCalibrationSilhouette = (ctx, calibrated, width, height) => {
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

// Draw pose silhouette with glow effect
export const drawPoseSilhouette = (ctx, landmarks, width, height, status, angle) => {
  const getPoint = (index) => {
    const lm = landmarks[index];
    if (!lm || lm.visibility < 0.4) return null;
    return { x: lm.x * width, y: lm.y * height, z: lm.z, v: lm.visibility };
  };

  const glowColor = status === 'bad' ? '#EF4444' :
                    status === 'warning' ? '#FBBF24' : '#00DCFF';
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
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 80;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  if (angle === 'side') {
    drawSideView(ctx, { nose, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow, leftHip, rightHip }, color, fillColor, height);
  } else {
    drawFrontView(ctx, { nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow }, color, fillColor, height);
  }

  // Reset shadow
  ctx.shadowBlur = 0;
};

// Draw side view
function drawSideView(ctx, points, color, fillColor, height) {
  const { nose, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow, leftHip, rightHip } = points;
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
    ctx.beginPath();
    ctx.arc(headCenter.x, headCenter.y, headRadius + 10, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 20;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(headCenter.x, headCenter.y + headRadius * 0.8);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 30;
    ctx.stroke();
  }

  if (hip) {
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
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 25;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(shoulder.x, shoulder.y, 20, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

// Draw front/diagonal/back view
function drawFrontView(ctx, points, color, fillColor, height) {
  const { nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow } = points;

  if (!leftShoulder && !rightShoulder) return;

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
    shoulderWidth = 100;
    shoulderCenter = { x: shoulder.x, y: shoulder.y };
  }

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
    ctx.beginPath();
    ctx.ellipse(headCenter.x, headCenter.y, headRadius * 0.9, headRadius * 1.1, 0, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 20;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(headCenter.x, headCenter.y + headRadius * 0.7);
    ctx.lineTo(shoulderCenter.x, shoulderCenter.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = shoulderWidth * 0.25;
    ctx.stroke();
  }

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

// Check if pose is in guide box
export const checkPoseInGuide = (landmarks, width, height, guideBox) => {
  if (!guideBox) return false;

  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];

  const isValid = (lm) => lm && lm.visibility >= 0.5;
  const hasValidShoulder = isValid(leftShoulder) || isValid(rightShoulder);
  if (!hasValidShoulder) return false;

  const shoulder = isValid(leftShoulder) ? leftShoulder : rightShoulder;
  const sY = shoulder.y * height;

  const shoulderInGuide = sY > guideBox.y + guideBox.height * 0.3 && sY < guideBox.y + guideBox.height * 0.75;

  return shoulderInGuide;
};
