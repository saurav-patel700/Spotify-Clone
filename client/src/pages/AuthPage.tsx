import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import {
  authCredentialsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from '@soundsphere/shared';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUiStore } from '@/stores/useUiStore';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';

  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const showToast = useUiStore((s) => s.showToast);

  const initialMode: AuthMode =
    searchParams.get('mode') === 'signup'
      ? 'signup'
      : searchParams.get('mode') === 'forgot'
        ? 'forgot'
        : searchParams.get('mode') === 'reset'
          ? 'reset'
          : 'login';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState(searchParams.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'login') {
      const parsed = authCredentialsSchema.safeParse({ email, password });
      if (!parsed.success) {
        setError(parsed.error.errors[0]?.message ?? 'Invalid credentials');
        return;
      }
      const res = await signIn(parsed.data.email, parsed.data.password);
      if (!res.ok) {
        setError(res.error ?? 'Sign in failed');
        return;
      }
      showToast('Signed in to SoundSphere');
      navigate(redirectTarget, { replace: true });
      return;
    }

    if (mode === 'signup') {
      const parsed = signupSchema.safeParse({ displayName, email, password });
      if (!parsed.success) {
        setError(parsed.error.errors[0]?.message ?? 'Invalid input');
        return;
      }
      const res = await signUp(parsed.data.displayName, parsed.data.email, parsed.data.password);
      if (!res.ok) {
        setError(res.error ?? 'Account creation failed');
        return;
      }
      showToast('Account created and signed in');
      navigate(redirectTarget, { replace: true });
      return;
    }

    if (mode === 'forgot') {
      const parsed = forgotPasswordSchema.safeParse({ email });
      if (!parsed.success) {
        setError(parsed.error.errors[0]?.message ?? 'Enter a valid email address');
        return;
      }
      const res = await requestPasswordReset(parsed.data.email);
      if (!res.ok) {
        setError(res.error ?? 'Unable to issue reset token');
        return;
      }
      setInfoMessage(res.message ?? 'Password reset instructions sent.');
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      return;
    }

    if (mode === 'reset') {
      const parsed = resetPasswordSchema.safeParse({ token: resetToken, newPassword });
      if (!parsed.success) {
        setError(parsed.error.errors[0]?.message ?? 'Invalid reset input');
        return;
      }
      const res = await confirmPasswordReset(parsed.data.token, parsed.data.newPassword);
      if (!res.ok) {
        setError(res.error ?? 'Password reset failed');
        return;
      }
      showToast('Password updated. Sign in with your new password.');
      setMode('login');
      setPassword('');
      setNewPassword('');
      setInfoMessage('Password updated successfully. You can now sign in.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0B0D] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Discover
          </Link>
        </div>

        <div className="rounded-lg border border-[#1F242D] bg-[#14171D] p-6">
          {(mode === 'login' || mode === 'signup') && (
            <div className="grid grid-cols-2 gap-1 rounded-md border border-[#1F242D] bg-[#0E1014] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`rounded py-2 text-xs font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-[#1B1F27] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`rounded py-2 text-xs font-medium transition-colors ${
                  mode === 'signup'
                    ? 'bg-[#1B1F27] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="mt-5">
            <h1 className="text-lg font-semibold text-zinc-100">
              {mode === 'login'
                ? 'Sign in to your account'
                : mode === 'signup'
                  ? 'Create a SoundSphere account'
                  : mode === 'forgot'
                    ? 'Forgot password'
                    : 'Reset password'}
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              {mode === 'login' || mode === 'signup'
                ? 'Save playlists, FocusFlow sessions, and private MemoryMix entries.'
                : mode === 'forgot'
                  ? 'Enter your account email to request a password reset token.'
                  : 'Enter your reset token and choose a new password.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300"
            >
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mt-4 space-y-2 rounded-md border border-emerald-500/40 bg-[#121D19] px-3 py-2.5 text-xs text-emerald-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
              {resetToken && mode === 'forgot' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-zinc-950"
                  >
                    <KeyRound className="h-3 w-3" />
                    Proceed to Reset Password
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-zinc-300">
                  Display Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 pr-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label htmlFor="auth-reset-token" className="block text-xs font-medium text-zinc-300">
                    Reset Token
                  </label>
                  <input
                    id="auth-reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste password reset token"
                    className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="auth-new-password" className="block text-xs font-medium text-zinc-300">
                    New Password
                  </label>
                  <input
                    id="auth-new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 transition-colors"
            >
              {isSubmitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : mode === 'forgot'
                      ? 'Send Reset Instructions'
                      : 'Update Password'}
            </button>
          </form>

          {(mode === 'forgot' || mode === 'reset') && (
            <div className="mt-4 flex items-center justify-between border-t border-[#1F242D] pt-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setInfoMessage(null);
                }}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Back to Sign In
              </button>
              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Have a reset token?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
