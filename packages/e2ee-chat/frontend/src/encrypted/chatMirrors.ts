import type { CryptoProvider } from '@crypto/interface';
import type { EncryptedPairConfig, EncryptedRuntime, RawEncryptedRow } from '@crypto/sqlite';
import { columnsToEnvelope } from '@crypto/sqlite';
import { CHAT_MESSAGES_PAIR, CHAT_ROOMS_PAIR } from './chatPairs';

type MirrorPair = {
  pair: EncryptedPairConfig;
  sql: string;
};

type ResolveCrypto = (row: RawEncryptedRow) => Promise<CryptoProvider | null> | CryptoProvider | null;

function buildMirrorUpsertSQL(pair: EncryptedPairConfig) {
  const mir = pair.mirrorTable;
  const custom = pair.mirrorColumns.map((c) => c.name);
  const cols = ['id', 'user_id', 'bucket_id', 'updated_at', ...custom];
  const placeholders = cols.map(() => '?').join(', ');
  const updates = ['user_id=excluded.user_id', 'bucket_id=excluded.bucket_id', 'updated_at=excluded.updated_at', ...custom.map((n) => `${n}=excluded.${n}`)].join(', ');
  const sql = `
    INSERT INTO ${mir} (${cols.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}
  `.trim();
  return { sql, cols };
}

function defaultComparatorKey(row: any) {
  return String(row.id);
}

function defaultComparatorValue(row: any) {
  return `${row.alg}|${row.aad ?? ''}|${row.nonce_b64}|${row.cipher_b64}|${row.kdf_salt_b64}|${row.updated_at}`;
}

export function startChatMirrors(
  runtime: EncryptedRuntime,
  opts?: { throttleMs?: number; resolveCrypto?: ResolveCrypto },
) {
  const { db, userId, crypto } = runtime;
  const throttle = opts?.throttleMs ?? 150;
  const resolver = opts?.resolveCrypto;

  const pairs: MirrorPair[] = [
    {
      pair: CHAT_ROOMS_PAIR,
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
      `.trim(),
    },
    {
      pair: CHAT_MESSAGES_PAIR,
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
          updated_at,
          sent_at
        FROM chat_messages
        WHERE bucket_id IN (
          SELECT room_id FROM chat_room_members WHERE user_id = ?
        )
        ORDER BY sent_at DESC
      `.trim(),
    },
  ];

  const subs: Array<{ close: () => void }> = [];

  for (const { pair, sql } of pairs) {
    const upsert = buildMirrorUpsertSQL(pair);
    const query = db.query<RawEncryptedRow>({ sql, parameters: [userId] });
    const sub = query
      .differentialWatch({
        throttleMs: throttle,
        rowComparator: {
          keyBy: defaultComparatorKey,
          compareBy: defaultComparatorValue,
        },
      })
      .registerListener({
        onDiff: async ({ added, updated, removed }) => {
          if ((!added || added.length === 0) && (!updated || updated.length === 0) && (!removed || removed.length === 0)) {
            return;
          }

          await db.writeTransaction(async (tx) => {
            const normalizeUpdated = (updated ?? []).map((item: any) => (item && 'current' in item ? item.current : item));
            const work = [...(added ?? []), ...normalizeUpdated];

            for (const row of work) {
              try {
                const provider = resolver ? await resolver(row) : crypto;
                if (!provider) {
                  continue;
                }
                const env = columnsToEnvelope(row);
                const plain = await provider.decrypt(env, row.aad ?? undefined);
                const parsed = pair.parsePlain({
                  plaintext: plain,
                  aad: row.aad ?? undefined,
                  encryptedRow: row as any,
                });
                const base = [row.id, row.user_id, row.bucket_id ?? null, row.updated_at];
                const customVals = pair.mirrorColumns.map((col) => (parsed as any)[col.name] ?? null);
                await tx.execute(upsert.sql, [...base, ...customVals]);
              } catch (err) {
                console.warn(`[chat mirror ${pair.encryptedTable}] decrypt/parse failed id=${row.id}`, err);
              }
            }

            for (const row of removed ?? []) {
              await tx.execute(`DELETE FROM ${pair.mirrorTable} WHERE id = ?`, [row.id]);
            }
          });
        },
        onError: (err: unknown) => {
          console.error(`[chat mirror ${pair.encryptedTable}] watch error`, err);
        },
      });
    subs.push({ close: sub });
  }

  return () => {
    for (const sub of subs) {
      try {
        sub.close();
      } catch (err) {
        console.warn('Failed to close chat mirror subscription', err);
      }
    }
  };
}
