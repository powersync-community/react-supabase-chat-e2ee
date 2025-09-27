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
    <div className="min-h-screen bg-slate-950/5 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow px-6 py-8">
        <h1 className="text-xl font-semibold mb-4" data-testid="auth-heading">
          Sign in to chat secretly
        </h1>
        {error ? <div className="text-sm text-red-600 mb-3">{error}</div> : null}
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); handle(onSignIn, 'in'); }}>
          <input
            className="input"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!email || !password || signingIn}
            >
              {signingIn ? 'Signing In…' : 'Sign In'}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              disabled={!email || !password || signingUp}
              onClick={() => handle(onSignUp, 'up')}
            >
              {signingUp ? 'Creating…' : 'Sign Up'}
            </button>
          </div>
          {allowGuest && onGuestSignIn ? (
            <button
              type="button"
              className="btn-tertiary"
              disabled={guestLoading}
              onClick={handleGuest}
              data-testid="guest-continue-button"
            >
              {guestLoading ? 'Joining…' : 'Continue as guest'}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
