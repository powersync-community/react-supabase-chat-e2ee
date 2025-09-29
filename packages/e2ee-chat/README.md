# PowerSync E2EE Chat

An end-to-end encrypted chat demo that reuses the shared crypto modules in this monorepo. The app mirrors the Todo vault experience: users unlock a per-device vault key with a passphrase or passkey, derive an X25519 identity keypair, and then distribute room keys via ECDH so every conversation is encrypted with its own symmetric key.

## Overview

- Multi-room chat with per-room encryption and live updates via PowerSync.
- Invite Supabase users (including anonymous guests) by sharing their published identity key.
- Local vault unlock flow using passphrase or WebAuthn passkey with rekey support.
- Deterministic encrypted mirrors that project decrypted room metadata and messages for React components.

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

## Supabase setup

1. The repo already bundles the Supabase CLI, so from the chat frontend package run the helper scripts (they call `pnpx supabase` under the hood). Sign in when prompted the first time so the CLI can push to your project:
   ```sh
   pnpm --filter @app/chat-e2ee supabase:init   # generates config in infra/supabase
   pnpm --filter @app/chat-e2ee supabase:link   # choose your Supabase project reference
   ```
2. Push the schema in `infra/schema.sql` to your project. For a clean push run either:
   ```sh
   pnpm --filter @app/chat-e2ee migrate         # snapshot schema + push
   # or when no new migration file is required
   pnpm --filter @app/chat-e2ee supabase:db:push
   ```
3. Copy `infra/powersync/sync_rules.yaml` into your PowerSync dashboard so the client can sync the encrypted tables.  
4. Populate `frontend/.env.local` with the Supabase URL and anon key from the dashboard (see Quickstart above).

If you ever need a fresh database during development, run `pnpm --filter @app/chat-e2ee supabase:reset` to drop and reapply the schema locally. To repair discrepancies between your migrations and the remote database, use the Supabase CLI’s `migration repair` command as documented by Supabase.

## Encryption & privacy model

- **Client-encrypted data**
  - `chat_rooms` ciphertext stores room name/topic/etc.; only minimal identifiers stay plaintext.
  - `chat_messages` ciphertext wraps message bodies; sender identity and timestamps remain as metadata.
  - `chat_room_keys` rows hold the wrapped Data Encryption Key (DEK) per member; only the recipient can unwrap the payload.
  - `chat_identity_private_keys` and `chat_e2ee_keys` contain the user’s sealed vault material.
- **Plaintext metadata (required for access control & sync)**
  - `chat_room_members` keeps a `room_id` → `user_id` link so Supabase RLS can gate reads/writes; the frontend now syncs every member row in a room but nothing is decrypted server-side.
  - `chat_identity_public_keys` exposes each user’s X25519 public key so peers can encrypt invites.
  - `chat_messages.bucket_id`, `chat_rooms.bucket_id`, and timestamps allow ordering and fan-out without revealing message content.
- **Local mirrors**
  - `chatMirrors.ts` watches encrypted tables, decrypts with the user’s vault + room keys, and writes plaintext mirrors (`chat_rooms_plain`, `chat_messages_plain`) to the PowerSync client DB for querying.
  - No decrypted content leaves the device; uploads use Supabase RPC with ciphertext rows only.

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

## Next steps

- Surface room participants using verified fingerprints so users can confirm who they are chatting with.
- Harden the vault UX (passkey enrollment, recovery, rotation).
- Add optimistic message sending indicators and error recovery.
