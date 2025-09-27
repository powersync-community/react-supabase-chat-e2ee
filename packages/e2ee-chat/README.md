# PowerSync E2EE Chat

An end-to-end encrypted chat demo that reuses the shared crypto modules in this monorepo. The app mirrors the Todo vault experience: users unlock a per-device vault key with a passphrase or passkey, derive an X25519 identity keypair, and then distribute room keys via ECDH so every conversation is encrypted with its own symmetric key.

## Quickstart

```sh
pnpm install
pnpm build:packages
pnpm --filter @app/chat-e2ee dev
```

Create `packages/e2ee-chat/frontend/.env.local` from the example and add your Supabase & PowerSync values:

```
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon>
VITE_POWERSYNC_URL=<powersync-endpoint>
```

Run the frontend at the printed URL once the dev server starts.

## How the vault works

- **Vault KEK** – Users unlock a per-device vault key (`ensureVaultKey`) with a passphrase or passkey. That key never leaves the device; everything below is wrapped with it.
- **Identity keypair** – `ensureIdentityKeyPair` generates an X25519 keypair on first unlock, stores the secret side encrypted with the vault key (`chat_identity_private_keys`), and publishes the public key (`chat_identity_public_keys`).
- **Room DEKs** – Every chat room gets its own 32-byte DEK. The DEK encrypts both the room metadata (`chat_rooms`) and each message (`chat_messages`).
- **Key exchange** – For every participant we wrap the room DEK by deriving an ECDH shared secret (`wrapRoomKey` / `unwrapRoomKey`) and store the envelope in `chat_room_keys`. Only the intended recipient can unwrap it.
- **Invites UI** – From the chat panel you can invite another Supabase user by ID. The frontend wraps the existing room DEK with their published public key and inserts the necessary membership/key rows in a single transaction.
- **Anonymous sessions** – Enable the Supabase Anonymous provider and the launch screen shows a "Continue as guest" button. Guest users still unlock a local vault, but their messages display the Supabase user UUID unless you add a dedicated `sender_id` column to your schema.
- **Mirrors** – `startChatMirrors` decrypts encrypted rows per-room, writing plaintext representations into `chat_rooms_plain` and `chat_messages_plain` so the UI can query unencrypted data locally.

## Schema & sync rules

- Supabase schema lives at `packages/e2ee-chat/infra/schema.sql`.
- PowerSync sync rules live at `packages/e2ee-chat/infra/powersync/sync_rules.yaml` and replicate:
  - The personal vault tables (`chat_e2ee_keys`, `chat_identity_*`).
  - Per-room buckets: encrypted rooms, messages, membership, and the wrapped room keys for the current user.

Run the provided Supabase scripts (see `package.json` scripts) to push the schema to your project. Use the PowerSync dashboard to paste the sync rules.

After editing `infra/schema.sql`, generate and push a fresh migration:

```sh
pnpm --filter @app/chat-e2ee migrate
```

This snapshots the current schema into `infra/supabase/migrations/<timestamp>_init.sql` and runs `supabase db push` so the remote project picks up the change. If you only need to reapply the existing migrations without creating a new file, use `pnpm --filter @app/chat-e2ee supabase:db:push`.

## Frontend structure

```
frontend/src/
├── App.tsx                    # vault flow, identity management, chat UI
├── crypto/
│   ├── identity.ts            # X25519 keypair generation & storage
│   └── roomKeys.ts            # ECDH wrapping helpers
├── encrypted/
│   ├── chatPairs.ts           # encrypted-table ↔ mirror configs
│   └── chatMirrors.ts         # mirror watcher with per-room crypto resolver
├── powersync/SystemProvider.tsx # PowerSync bootstrap + schema install
└── utils/                     # Supabase helpers, vault keyring utilities
```

The UI is split across small components (`AuthScreen`, `VaultScreen`, `ChatLayout`, `RoomsPanel`, `ChatPanel`) so each step of the flow is easy to reason about.

## Next steps

- Surface room participants using verified fingerprints so users can confirm who they are chatting with.
- Harden the vault UX (passkey enrollment, recovery, rotation).
- Add optimistic message sending indicators and error recovery.
