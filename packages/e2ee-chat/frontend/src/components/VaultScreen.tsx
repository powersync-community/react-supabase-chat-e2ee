import { useState } from "react";

type VaultScreenProps = {
  hasVault: boolean;
  onCreateVault: (passphrase: string) => Promise<void>;
  onUnlockVault: (passphrase: string) => Promise<void>;
  onSignOut: () => void | Promise<void>;
};

export default function VaultScreen({
  hasVault,
  onCreateVault,
  onUnlockVault,
  onSignOut,
}: VaultScreenProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(action: (passphrase: string) => Promise<void>) {
    setError(null);
    if (!passphrase) {
      setError("Passphrase required.");
      return;
    }
    setLoading(true);
    try {
      await action(passphrase);
      setPassphrase("");
    } catch (err: any) {
      setError(err?.message ?? "Vault operation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="card px-8 py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
              <div className="space-y-1.5">
                <h1
                  className="text-2xl font-semibold text-slate-900"
                  data-testid="vault-heading"
                >
                  {hasVault
                    ? "Unlock your chat vault"
                    : "Create your encrypted vault"}
                </h1>
                <p className="text-sm text-slate-500">
                  {hasVault
                    ? "Enter the passphrase you used to secure this device."
                    : "Choose a passphrase. We use it locally to unwrap your data keys."}
                </p>
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
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            ) : null}
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(hasVault ? onUnlockVault : onCreateVault);
              }}
            >
              <input
                className="input h-12"
                placeholder={hasVault ? "Passphrase" : "Choose a passphrase"}
                type="password"
                value={passphrase}
                onChange={(ev) => setPassphrase(ev.target.value)}
                data-testid="vault-passphrase-input"
              />
              <button
                type="submit"
                className="btn"
                disabled={loading}
                data-testid="vault-submit-button"
              >
                {loading
                  ? hasVault
                    ? "Unlocking…"
                    : "Creating…"
                  : hasVault
                    ? "Unlock Vault"
                    : "Create Vault"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
