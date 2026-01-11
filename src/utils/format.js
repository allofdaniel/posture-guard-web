// 시간 포맷팅 유틸리티

// 틱을 분:초 형식으로 변환
export const formatTime = (ticks) => {
  const seconds = Math.floor(ticks / 10);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 초를 시간/분/초 형식으로 변환
export const formatDuration = (seconds) => {
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

// 날짜 포맷팅
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 시간만 포맷팅
export const formatTimeOnly = (dateString) => {
  return new Date(dateString).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
