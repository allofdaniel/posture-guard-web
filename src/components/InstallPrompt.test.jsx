import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstallPrompt from './InstallPrompt';

describe('InstallPrompt', () => {
  it('renders nothing when not installable and not iOS', () => {
    const { container } = render(
      <InstallPrompt isInstallable={false} onInstall={() => {}} showIOSGuide={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders install button when installable', () => {
    render(
      <InstallPrompt isInstallable={true} onInstall={() => {}} showIOSGuide={false} />
    );
    expect(screen.getByText('앱으로 설치하기')).toBeInTheDocument();
    expect(screen.getByText('설치')).toBeInTheDocument();
  });

  it('calls onInstall when install button clicked', () => {
    const onInstall = vi.fn();
    render(
      <InstallPrompt isInstallable={true} onInstall={onInstall} showIOSGuide={false} />
    );

    fireEvent.click(screen.getByText('설치'));
    expect(onInstall).toHaveBeenCalled();
  });

  it('renders iOS guide when showIOSGuide is true', () => {
    render(
      <InstallPrompt isInstallable={false} onInstall={() => {}} showIOSGuide={true} />
    );
    expect(screen.getByText(/Safari에서 공유 버튼/)).toBeInTheDocument();
  });

  it('dismisses prompt when close button clicked', () => {
    render(
      <InstallPrompt isInstallable={true} onInstall={() => {}} showIOSGuide={false} />
    );

    const closeButton = screen.getByLabelText('닫기');
    fireEvent.click(closeButton);

    expect(screen.queryByText('앱으로 설치하기')).not.toBeInTheDocument();
  });
});
