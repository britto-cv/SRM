import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const response = (data: unknown) => ({
  ok: true,
  json: async () => data,
});

describe('App connection flow', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the deployed credential form after a cloud connection starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      status: 'WAITING_FOR_CREDENTIALS',
      sessionId: 'session-1',
    })));

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Connect to SRM' })).toBeInTheDocument();
    expect(screen.getByLabelText('NetID')).toBeInTheDocument();
  });

  it('polls for and displays the CAPTCHA while waiting for credentials', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: 'WAITING_FOR_CREDENTIALS', sessionId: 'session-1' }))
      .mockResolvedValueOnce(response({
        state: 'WAITING_FOR_CREDENTIALS',
        sessionId: 'session-1',
        captchaBase64: 'captcha-image',
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: 'Connect to SRM' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.getByAltText('CAPTCHA')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,captcha-image',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
