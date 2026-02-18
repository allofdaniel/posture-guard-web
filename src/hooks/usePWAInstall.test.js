import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import usePWAInstall from './usePWAInstall';

describe('usePWAInstall', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset matchMedia to default
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);
    expect(typeof result.current.promptInstall).toBe('function');
  });

  it('detects standalone mode as installed', () => {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstalled).toBe(true);
  });

  it('promptInstall returns false when no install prompt available', async () => {
    const { result } = renderHook(() => usePWAInstall());

    const outcome = await result.current.promptInstall();
    expect(outcome).toBe(false);
  });

  it('shows iOS install guide for iOS devices', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(typeof result.current.showIOSInstallGuide).toBe('boolean');
  });

  it('does not set up event listeners when already installed', () => {
    // Mock as installed (standalone mode)
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const addEventSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => usePWAInstall());

    // Should not add beforeinstallprompt listener when already installed
    const beforeInstallCalls = addEventSpy.mock.calls.filter(
      call => call[0] === 'beforeinstallprompt'
    );
    expect(beforeInstallCalls).toHaveLength(0);

    addEventSpy.mockRestore();
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => usePWAInstall());
    unmount();

    expect(removeEventSpy).toHaveBeenCalled();
    removeEventSpy.mockRestore();
  });
});
