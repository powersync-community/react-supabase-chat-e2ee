import { useState } from 'react';

type VaultScreenProps = {
  hasVault: boolean;
  onCreateVault: (passphrase: string) => Promise<void>;
  onUnlockVault: (passphrase: string) => Promise<void>;
  onSignOut: () => void | Promise<void>;
};

export default function VaultScreen({ hasVault, onCreateVault, onUnlockVault, onSignOut }: VaultScreenProps) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(action: (passphrase: string) => Promise<void>) {
    setError(null);
    if (!passphrase) {
      setError('Passphrase required.');
      return;
    }
    setLoading(true);
    try {
      await action(passphrase);
      setPassphrase('');
    } catch (err: any) {
      setError(err?.message ?? 'Vault operation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950/5 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold" data-testid="vault-heading">
              Unlock your chat vault
            </h1>
            <p className="text-sm text-slate-500">Your passphrase never leaves the device.</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onSignOut()}
            data-testid="vault-sign-out-button"
          >
            Sign Out
          </button>
        </div>
        {error ? <div className="text-sm text-red-600 mb-3">{error}</div> : null}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(hasVault ? onUnlockVault : onCreateVault);
          }}
        >
          <input
            className="input"
            placeholder={hasVault ? 'Passphrase' : 'Choose a passphrase'}
            type="password"
            value={passphrase}
            onChange={(ev) => setPassphrase(ev.target.value)}
            data-testid="vault-passphrase-input"
          />
          <button type="submit" className="btn-primary" disabled={loading} data-testid="vault-submit-button">
            {loading ? (hasVault ? 'Unlocking…' : 'Creating…') : hasVault ? 'Unlock Vault' : 'Create Vault'}
          </button>
        </form>
      </div>
    </div>
  );
}
