import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
  it('shows loading spinner when isLoading is true', () => {
    render(
      <LoadingScreen
        isLoading={true}
        loadingProgress="초기화 중..."
        cameraError={null}
        onRetry={() => {}}
      />
    );

    expect(screen.getByLabelText('로딩 중')).toBeInTheDocument();
    expect(screen.getByText('초기화 중...')).toBeInTheDocument();
  });

  it('shows error message when cameraError is set', () => {
    render(
      <LoadingScreen
        isLoading={false}
        loadingProgress=""
        cameraError="카메라를 사용할 수 없습니다"
        onRetry={() => {}}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('카메라를 사용할 수 없습니다');
    expect(screen.getByText('다시 시도')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <LoadingScreen
        isLoading={false}
        loadingProgress=""
        cameraError="Error"
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByText('다시 시도'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows camera permission hint when error occurs', () => {
    render(
      <LoadingScreen
        isLoading={false}
        loadingProgress=""
        cameraError="Error"
        onRetry={() => {}}
      />
    );

    expect(screen.getByText(/카메라 권한을 확인/)).toBeInTheDocument();
  });

  it('does not show spinner when there is an error', () => {
    render(
      <LoadingScreen
        isLoading={true}
        loadingProgress="Loading..."
        cameraError="Error"
        onRetry={() => {}}
      />
    );

    expect(screen.queryByLabelText('로딩 중')).not.toBeInTheDocument();
  });
});
