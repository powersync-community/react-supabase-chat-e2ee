# PowerSync E2EE Chat Monorepo

This repository focuses on the end-to-end encrypted chat demo plus the shared crypto libraries it depends on. Use it as a reference implementation for building client-encrypted PowerSync projects backed by Supabase.

## Application

- [packages/e2ee-chat](packages/e2ee-chat) — End-to-end encrypted group chat with guest access, room invites, and local vault unlock flows. See the package README for setup instructions and an in-depth encryption/privacy overview.

![Screenshot of E2EE Chat](packages/e2ee-chat/screenshot.png)

## Crypto packages

- [packages/crypto/interface](packages/crypto/interface) — Shared types and helpers (`CipherEnvelope`, base64 helpers, etc.) used by crypto providers.
- [packages/crypto/encrypted-sqlite](packages/crypto/encrypted-sqlite) — Encrypted↔mirror runtime for SQLite/PowerSync: pair configs, `ensurePairsDDL`, mirror orchestration, and CRUD helpers.
- [packages/crypto/password](packages/crypto/password) — Password-based crypto provider (PBKDF2 by default) implementing the `CryptoProvider` interface for wrapping/unwrapping DEKs.
- [packages/crypto/webauthn](packages/crypto/webauthn) — WebAuthn-based crypto provider using PRF/hmac-secret extensions to derive a stable secret per credential (wrap/unwrap DEKs using passkeys).

Each module keeps ciphertext opaque to the PowerSync backend while presenting decrypted mirrors locally for the user interface.
