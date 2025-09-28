import { useState, type FormEvent } from 'react';

type ResetPasswordScreenProps = {
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => Promise<void> | void;
};

export default function ResetPasswordScreen({ onSubmit, onCancel }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError('Enter a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(password);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-md w-full">
          <div className="card px-8 py-10 space-y-6">
            <div className="space-y-1.5 text-center">
              <h2 className="text-2xl font-semibold text-slate-900">Set a new password</h2>
              <p className="text-sm text-slate-500">
                Enter a fresh password to finish resetting your account.
              </p>
            </div>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <form className="space-y-5 w-full" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-left">
                  New Password
                </label>
                <input
                  className="input h-12 w-full"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="New password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-left">
                  Confirm Password
                </label>
                <input
                  className="input h-12 w-full"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm password"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full">
                <button type="submit" className="btn w-full" disabled={loading}>
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => {
                    void onCancel();
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
