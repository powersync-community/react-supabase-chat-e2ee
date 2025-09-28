import type { CryptoProvider } from "@crypto/interface";
import type {
  EncryptedRuntime,
  RawEncryptedRow,
  MirrorSubscriptionConfig,
} from "@crypto/sqlite";
import { startEncryptedMirrorSubscriptions } from "@crypto/sqlite";
import { CHAT_MESSAGES_PAIR, CHAT_ROOMS_PAIR } from "./chatPairs";

type ResolveCrypto = (
  row: RawEncryptedRow,
) => Promise<CryptoProvider | null> | CryptoProvider | null;

export function startChatMirrors(
  runtime: EncryptedRuntime,
  opts?: { throttleMs?: number; resolveCrypto?: ResolveCrypto },
) {
  const resolveRoomsCrypto = opts?.resolveCrypto;
  const resolveMessagesCrypto = opts?.resolveCrypto;

  const configs: MirrorSubscriptionConfig[] = [
    {
      pair: CHAT_ROOMS_PAIR,
      // Only sync rooms the current user belongs to; expose derived room_id for mirror columns.
      query: ({ runtime }) => ({
        sql: `
        SELECT
          id,
          user_id,
          bucket_id,
          COALESCE(bucket_id, id) AS room_id,
          alg,
          aad,
          nonce_b64,
          cipher_b64,
          kdf_salt_b64,
          created_at,
          updated_at
        FROM chat_rooms
        WHERE EXISTS (
          SELECT 1
            FROM chat_room_members m
           WHERE m.room_id = COALESCE(chat_rooms.bucket_id, chat_rooms.id)
             AND m.user_id = ?
        )
        ORDER BY updated_at DESC
      `,
        parameters: [runtime.userId],
      }),
      resolveCrypto: async ({ row }) => {
        if (resolveRoomsCrypto) {
          const provider = await resolveRoomsCrypto(row);
          if (provider) return provider;
        }
        return runtime.crypto;
      },
    },
    {
      pair: CHAT_MESSAGES_PAIR,
      // Messages need a per-room DEK. The subscription queries just the rooms the user can access.
      query: ({ runtime }) => ({
        sql: `
        SELECT
          id,
          user_id,
          bucket_id,
          user_id AS sender_id,
          alg,
          aad,
          nonce_b64,
          cipher_b64,
          kdf_salt_b64,
          created_at,
          updated_at
        FROM chat_messages
        WHERE bucket_id IN (
          SELECT room_id FROM chat_room_members WHERE user_id = ?
        )
        ORDER BY updated_at DESC
      `,
        parameters: [runtime.userId],
      }),
      // Defer to the caller for key resolution when provided; otherwise fall back to the runtime crypto (e.g., locked vault).
      resolveCrypto: async ({ row }) => {
        if (resolveMessagesCrypto) {
          return await resolveMessagesCrypto(row);
        }
        return runtime.crypto;
      },
    },
  ];

  return startEncryptedMirrorSubscriptions(runtime, configs, {
    throttleMs: opts?.throttleMs,
  });
}
