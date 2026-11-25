import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AuthPage } from '@/pages/AuthPage';

describe('Authentication & Protected Routes', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isHydrating: false,
      isSubmitting: false,
      authError: null,
    });
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users from protected routes to /auth', () => {
    render(
      <MemoryRouter initialEntries={['/memory-mix']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/memory-mix"
            element={
              <ProtectedRoute>
                <div>Private Journal Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Private Journal Content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
  });

  it('renders protected routes when user has a valid authenticated session', () => {
    useAuthStore.setState({
      user: {
        id: 'usr-1',
        email: 'alex@example.com',
        displayName: 'Alex',
        preferredFocusMinutes: 25,
        preferredBreakMinutes: 5,
        preferredLongBreakMinutes: 15,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
      accessToken: 'jwt-token',
    });

    render(
      <MemoryRouter initialEntries={['/memory-mix']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/memory-mix"
            element={
              <ProtectedRoute>
                <div>Private Journal Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Private Journal Content')).toBeInTheDocument();
  });

  it('supports signup, forgot password, and password reset flows via AuthPage', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/signup')) {
        return new Response(
          JSON.stringify({
            data: {
              user: {
                id: 'usr-new',
                email: 'sam@example.com',
                displayName: 'Sam',
                preferredFocusMinutes: 25,
                preferredBreakMinutes: 5,
                preferredLongBreakMinutes: 15,
                createdAt: '2026-11-25T10:00:00.000Z',
              },
              accessToken: 'jwt-new',
              expiresAt: '2026-12-02T10:00:00.000Z',
            },
          }),
          { status: 201 }
        );
      }
      if (String(url).endsWith('/auth/forgot-password')) {
        return new Response(
          JSON.stringify({
            data: {
              message: 'Reset instructions issued.',
              expiresAt: '2026-11-25T10:30:00.000Z',
              resetToken: 'tok-1234567890abcdef',
            },
          }),
          { status: 200 }
        );
      }
      if (String(url).endsWith('/auth/reset-password')) {
        return new Response(JSON.stringify({ data: { reset: true } }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<div>Discover Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Forgot Password -> Reset Password flow
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'sam@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }));

    await waitFor(() =>
      expect(screen.getByText('Reset instructions issued.')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Proceed to Reset Password' }));
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() =>
      expect(
        screen.getByText('Password updated successfully. You can now sign in.')
      ).toBeInTheDocument()
    );

    // Switch to Signup
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'sam@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Account' })[1]);

    await waitFor(() => expect(screen.getByText('Discover Home')).toBeInTheDocument());
    expect(useAuthStore.getState().accessToken).toBe('jwt-new');
    expect(useAuthStore.getState().user?.email).toBe('sam@example.com');
  });
});
