# Encrypted SQLite (PowerSync)

Helpers for storing end-to-end encrypted rows in SQLite while keeping a plaintext mirror for fast, typed queries on the client. The server only ever sees opaque ciphertext; decryption happens on-device using your crypto provider.

This package provides:

- DDL helpers to create the encrypted and mirror tables, plus CRUD triggers that enqueue uploads for PowerSync
- A lightweight replicator that watches the encrypted table, decrypts rows, and upserts into the plaintext mirror
- Querying examples using `@powersync/react`'s `useQuery` against the mirror
- Mutation helpers to insert, update, and delete encrypted rows

Dependencies: `@powersync/web`, `@powersync/react` (for the hook), and a `CryptoProvider` from `@crypto/interface`.

---

## Concepts

- Encrypted table: Stores opaque ciphertext plus metadata (algorithm, AAD, nonce, etc.). The schema is fixed and generic.
- Mirror table: Plaintext projection of just the columns you need for UX and local queries, defined per domain via `mirrorColumns`.
- Pair: A one-to-one mapping between an encrypted table and its mirror with custom columns, plus parsing/serialization logic.

Encrypted table columns created by this package:

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `bucket_id TEXT`
- `alg TEXT NOT NULL`
- `aad TEXT`
- `nonce_b64 TEXT NOT NULL`
- `cipher_b64 TEXT NOT NULL`
- `kdf_salt_b64 TEXT NOT NULL`
- `created_at TEXT NOT NULL` (ISO)
- `updated_at TEXT NOT NULL` (ISO)

Mirror table has: `id`, `user_id`, `bucket_id`, `updated_at`, plus your declared `mirrorColumns`.

---

## Quick start

### 1) Define a pair

```ts
import type { EncryptedPairConfig } from "@crypto/sqlite";

const TODOS_PAIR: EncryptedPairConfig<{ text: string; completed: boolean }> = {
  name: "todos",
  encryptedTable: "raw_items",
  mirrorTable: "raw_items_plain",
  mirrorColumns: [
    { name: "text", type: "TEXT", notNull: true, defaultExpr: "''" },
    { name: "completed", type: "INTEGER", notNull: true, defaultExpr: "0" }
  ],
  // Convert decrypted bytes -> mirror columns
  parsePlain: ({ plaintext }) => {
    const obj = JSON.parse(new TextDecoder().decode(plaintext));
    return { text: obj.text ?? "", completed: obj.completed ? 1 : 0 };
  },
  // Optional: serialize domain object -> bytes (defaults to JSON if omitted)
  serializePlain: (obj) => ({
    plaintext: new TextEncoder().encode(JSON.stringify(obj)),
    aad: "todo-v1"
  })
};
```

### 2) Create tables and triggers

```ts
import { ensurePairsDDL } from "@crypto/sqlite";

await ensurePairsDDL(db, [TODOS_PAIR]);
```

This creates both the encrypted and mirror tables and installs triggers that write to `powersync_crud` on insert/update/delete.

### 3) Install raw-table mappings in your PowerSync schema

```ts
import { installPairsOnSchema } from "@crypto/sqlite";

installPairsOnSchema(schema, [TODOS_PAIR]);
```

### 4) Start the mirror replicator

```ts
import { startEncryptedMirrors } from "@crypto/sqlite";

const stop = startEncryptedMirrors({ db, userId, crypto }, [TODOS_PAIR], { throttleMs: 150 });
// call stop() to dispose
```

The replicator watches the encrypted table, decrypts rows using your `CryptoProvider`, runs `parsePlain`, and upserts results into the mirror. Failures (e.g., locked keys) are logged and skipped so the UI remains responsive.

### 5) Write encrypted rows

```ts
import { insertEncrypted, updateEncrypted, deleteEncrypted } from "@crypto/sqlite";

await insertEncrypted(
  { db, userId, crypto },
  TODOS_PAIR,
  { id: "a1", bucketId: null, object: { text: "Buy milk", completed: false } }
);

await updateEncrypted(
  { db, userId, crypto },
  TODOS_PAIR,
  { id: "a1", object: { text: "Buy oat milk", completed: true } }
);

await deleteEncrypted({ db, userId, crypto }, TODOS_PAIR, { id: "a1" });
```

### 6) Query from React

```ts
import { useQuery } from "@powersync/react";

const { data, isLoading, error } = useQuery(
  `
  SELECT id, user_id, bucket_id, updated_at, text, completed
    FROM raw_items_plain
   WHERE user_id = ?
     AND bucket_id IS NULL
   ORDER BY updated_at DESC
  `,
  [userId]
);
```

---

## API overview

- `ensurePairsDDL(db, pairs)` — Create encrypted/mirror tables and triggers.
- `installPairsOnSchema(schema, pairs)` — Register raw-table mappings for PowerSync.
- `startEncryptedMirrors(runtime, pairs, opts)` — Start watchers that keep mirrors up to date; returns `stop()`.
- `startEncryptedMirrorSubscriptions(runtime, configs, defaults)` — Advanced mirror watcher with custom queries, crypto resolvers, and comparator control.
- `insertEncrypted(runtime, pair, args)` — Encrypt and insert a new row.
- `updateEncrypted(runtime, pair, args)` — Encrypt and update an existing row.
- `deleteEncrypted(runtime, pair, { id })` — Delete by id.
- Utilities: `columnsToEnvelope(row)` and `utf8(str)`.

Common types: `EncryptedPairConfig`, `EncryptedRuntime`, `MirrorColumnDef`, `MirrorBaseRow`.

---

## Advanced mirror subscriptions

`startEncryptedMirrorSubscriptions` exposes the same resilient mirror updater that powers `startEncryptedMirrors`, but lets you plug in domain-specific SQL, throttling, and key resolution logic per encrypted pair.

```ts
import {
  startEncryptedMirrorSubscriptions,
  type MirrorSubscriptionConfig,
} from '@crypto/sqlite';

const configs: MirrorSubscriptionConfig[] = [
  {
    pair: CHAT_ROOMS_PAIR,
    // Custom SQL can add JOINs, filters, or derived columns.
    query: ({ runtime }) => ({
      sql: `
        SELECT r.*, owner.display_name
          FROM chat_rooms r
          JOIN chat_room_members m ON m.room_id = r.id
          JOIN profiles owner ON owner.id = r.owner_id
         WHERE m.user_id = ?
         ORDER BY r.updated_at DESC
      `,
      parameters: [runtime.userId],
    }),
  },
  {
    pair: CHAT_MESSAGES_PAIR,
    resolveCrypto: async ({ row }) => {
      // Look up the room-specific DEK.
      const provider = await roomCryptoCache.get(row.bucket_id);
      return provider ?? null;
    },
    throttleMs: 100,
  },
];

const stop = startEncryptedMirrorSubscriptions({ db, userId, crypto }, configs, {
  throttleMs: 150, // default fallback for configs that omit throttleMs
});
```

Each subscription config supports:

- `pair` *(required)* — The `EncryptedPairConfig` you defined for the table/mirror.
- `query` — Either a static `{ sql, parameters }` object or a factory that receives `{ pair, shape, runtime }`. Use this to project extra columns or filter by membership like the chat demo.
- `resolveCrypto` — Given a decrypted row context, return the `CryptoProvider` that should be used. Return `undefined` to fall back to `runtime.crypto`, or `null` to skip the row (e.g., key still locked).
- `throttleMs` — Override debounce per subscription.
- `comparator` — Custom `keyBy` / `compareBy` functions if your query adds columns that should influence differential updates.

The helper still guarantees:

- Mirror upserts run inside a single write transaction per diff.
- Rows that fail to decrypt/parse are logged and skipped without breaking the stream.
- Disposing the returned function tears down all underlying `differentialWatch` subscriptions.

Prefer this API whenever different encrypted tables require different SQL predicates or key lookup strategies—as in the chat E2EE demo where rooms sync via membership and messages unwrap per-room DEKs.

---

## Notes & tips

- `bucketId` filtering: pass `bucketId: null` to target NULL; omit it to not filter by bucket.
- `aad`: If not provided in mutation args, `serializePlain` may provide one; otherwise it can default using the pair’s `aad`.
- Mirror upserts follow the order in your declared `mirrorColumns`.
- Timestamps are stored as ISO strings in both tables.
- Decrypt/parse errors are warned to the console and skipped so the replicator is resilient under key rotation/lock.

---

## Testing

See `dist/__tests__` for examples of DDL, replication, and mutations in action.

---

## License

This package is part of the monorepo and may not be published. Check the repository’s root license for details.
