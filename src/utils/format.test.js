import { describe, it, expect } from 'vitest';
import { formatTime, formatDuration, formatDate, formatTimeOnly } from './format';

describe('formatTime', () => {
  it('formats 0 ticks as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 10 ticks (1 second) as 0:01', () => {
    expect(formatTime(10)).toBe('0:01');
  });

  it('formats 600 ticks (60 seconds) as 1:00', () => {
    expect(formatTime(600)).toBe('1:00');
  });

  it('formats 650 ticks (65 seconds) as 1:05', () => {
    expect(formatTime(650)).toBe('1:05');
  });

  it('formats 6000 ticks (10 minutes) as 10:00', () => {
    expect(formatTime(6000)).toBe('10:00');
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0초');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45초');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2분 5초');
  });

  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3725)).toBe('1시간 2분 5초');
  });

  it('formats exact hour', () => {
    expect(formatDuration(3600)).toBe('1시간 0분 0초');
  });
});

describe('formatDate', () => {
  it('formats date string to Korean locale', () => {
    const result = formatDate('2024-01-15T14:30:00');
    expect(result).toContain('1월');
    expect(result).toContain('15');
  });
});

describe('formatTimeOnly', () => {
  it('formats time only from date string', () => {
    const result = formatTimeOnly('2024-01-15T14:30:00');
    // 다양한 로케일 형식에 대응 (14:30, 오후 2:30, 오후 02:30 등)
    expect(result).toMatch(/14:30|오후\s*0?2:30/);
  });
});
