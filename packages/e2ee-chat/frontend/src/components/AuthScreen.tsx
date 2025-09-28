import { useState } from 'react';

type AuthScreenProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onGuestSignIn?: () => Promise<void>;
  allowGuest?: boolean;
};

export default function AuthScreen({ onSignIn, onSignUp, onGuestSignIn, allowGuest = false }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handle(callback: (email: string, password: string) => Promise<void>, mode: 'in' | 'up') {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'in') setSigningIn(true);
    else setSigningUp(true);
    try {
      await callback(email, password);
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed.');
    } finally {
      if (mode === 'in') setSigningIn(false);
      else setSigningUp(false);
    }
  }

  async function handleGuest() {
    if (!onGuestSignIn) return;
    setError(null);
    setGuestLoading(true);
    try {
      await onGuestSignIn();
    } catch (err: any) {
      setError(err?.message ?? 'Guest sign-in failed.');
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-6xl w-full grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
          <aside className="hidden lg:flex flex-col gap-8 rounded-3xl border border-slate-200 bg-white/85 backdrop-blur px-10 py-12 shadow-2xl shadow-slate-400/10">
            <div>
              <span className="badge">End-to-end encrypted</span>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900">
                Secure conversations without the backend seeing a byte.
              </h1>
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li>• Zero-knowledge vaults keep message keys on your device.</li>
              <li>• Invite collaborators with wrapped keys in a couple of clicks.</li>
              <li>• Powered by PowerSync streaming and Supabase authentication.</li>
            </ul>
          </aside>
          <div className="w-full">
            <div className="card px-8 py-10">
              <div className="space-y-1.5 mb-6">
                <h2 className="text-2xl font-semibold text-slate-900" data-testid="auth-heading">
                  Welcome back
                </h2>
                <p className="text-sm text-slate-500">
                  Sign in with email, or create a new encrypted workspace in seconds.
                </p>
              </div>
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 mb-4">
                  {error}
                </div>
              ) : null}
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handle(onSignIn, 'in');
                }}
              >
                <input
                  className="input h-12"
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                />
                <input
                  className="input h-12"
                  placeholder="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="submit"
                    className="btn w-full"
                    disabled={!email || !password || signingIn}
                  >
                    {signingIn ? 'Signing In…' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={!email || !password || signingUp}
                    onClick={() => handle(onSignUp, 'up')}
                  >
                    {signingUp ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              </form>
              {allowGuest && onGuestSignIn ? (
                <div className="mt-6">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span>or</span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary w-full mt-3"
                    disabled={guestLoading}
                    onClick={handleGuest}
                    data-testid="guest-continue-button"
                  >
                    {guestLoading ? 'Joining…' : 'Continue as guest'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
