import type { EncryptedPairConfig, EncryptedRuntime, RawEncryptedRow } from "./types.js";
import { columnsToEnvelope, resolveTableShape } from "./types.js";
import type { CryptoProvider } from "@crypto/interface";

/** Helper: dynamic UPSERT for mirror with declared custom columns */
function buildMirrorUpsertSQL(pair: EncryptedPairConfig) {
  const mir = pair.mirrorTable;
  const shape = resolveTableShape(pair.tableShape);
  const custom = pair.mirrorColumns.map((c) => c.name);
  const cols = [shape.id, shape.userId, shape.bucketId, shape.updatedAt, ...custom];
  const placeholders = cols.map(() => "?").join(", ");

  const insertSql = `
    INSERT INTO ${mir} (${cols.join(", ")})
    VALUES (${placeholders})
  `.trim();

  const deleteSql = `DELETE FROM ${mir} WHERE ${shape.id} = ?`;

  return { insertSql, deleteSql, shape };
}

type MirrorQuery = { sql: string; parameters?: any[] };

type MirrorQueryFactoryArgs = {
  pair: EncryptedPairConfig;
  shape: ReturnType<typeof resolveTableShape>;
  runtime: EncryptedRuntime;
};

type MirrorQueryFactory = (args: MirrorQueryFactoryArgs) => MirrorQuery;

type ResolveCryptoArgs = {
  row: RawEncryptedRow & Record<string, any>;
  pair: EncryptedPairConfig;
  runtime: EncryptedRuntime;
};

type ResolveCryptoFn = (args: ResolveCryptoArgs) => CryptoProvider | null | undefined | Promise<CryptoProvider | null | undefined>;

type RowComparator = {
  keyBy: (row: Record<string, any>) => string;
  compareBy: (row: Record<string, any>) => string;
};

export type MirrorSubscriptionConfig = {
  pair: EncryptedPairConfig;
  query?: MirrorQuery | MirrorQueryFactory;
  resolveCrypto?: ResolveCryptoFn;
  throttleMs?: number;
  comparator?: RowComparator;
};

type MirrorSubscriptionDefaults = {
  throttleMs?: number;
};

function defaultQuery(
  pair: EncryptedPairConfig,
  shape: ReturnType<typeof resolveTableShape>,
  runtime: EncryptedRuntime,
): MirrorQuery {
  return {
    sql: `
        SELECT
          ${shape.id} AS id,
          ${shape.userId} AS user_id,
          ${shape.bucketId} AS bucket_id,
          ${shape.alg} AS alg,
          ${shape.aad} AS aad,
          ${shape.nonce} AS nonce_b64,
          ${shape.cipher} AS cipher_b64,
          ${shape.kdfSalt} AS kdf_salt_b64,
          ${shape.createdAt} AS created_at,
          ${shape.updatedAt} AS updated_at
          FROM ${pair.encryptedTable}
         WHERE ${shape.userId} = ?
         ORDER BY ${shape.updatedAt} DESC
      `,
    parameters: [runtime.userId],
  };
}

function defaultComparator(shape: ReturnType<typeof resolveTableShape>): RowComparator {
  return {
    keyBy: (row) => String(row[shape.id] ?? row.id ?? ""),
    compareBy: (row) => {
      const alg = row[shape.alg] ?? row.alg ?? "";
      const aad = row[shape.aad] ?? row.aad ?? "";
      const nonce = row[shape.nonce] ?? row.nonce_b64 ?? "";
      const cipher = row[shape.cipher] ?? row.cipher_b64 ?? "";
      const kdf = row[shape.kdfSalt] ?? row.kdf_salt_b64 ?? "";
      const updated = row[shape.updatedAt] ?? row.updated_at ?? "";
      return `${alg}|${aad}|${nonce}|${cipher}|${kdf}|${updated}`;
    },
  };
}

function normalizeRow(
  row: Record<string, any>,
  shape: ReturnType<typeof resolveTableShape>,
): RawEncryptedRow & Record<string, any> {
  const normalized: RawEncryptedRow & Record<string, any> = {
    ...row,
    id: row[shape.id] ?? row.id,
    user_id: row[shape.userId] ?? row.user_id,
    bucket_id: row[shape.bucketId] ?? row.bucket_id ?? null,
    alg: row[shape.alg] ?? row.alg,
    aad: row[shape.aad] ?? row.aad ?? null,
    nonce_b64: row[shape.nonce] ?? row.nonce_b64,
    cipher_b64: row[shape.cipher] ?? row.cipher_b64,
    kdf_salt_b64: row[shape.kdfSalt] ?? row.kdf_salt_b64,
    created_at: row[shape.createdAt] ?? row.created_at ?? row[shape.updatedAt] ?? row.updated_at,
    updated_at: row[shape.updatedAt] ?? row.updated_at,
  };
  return normalized;
}

export function startEncryptedMirrorSubscriptions(
  runtime: EncryptedRuntime,
  configs: MirrorSubscriptionConfig[],
  defaults?: MirrorSubscriptionDefaults,
) {
  const { db } = runtime;
  const subs: Array<{ close: () => void }> = [];

  for (const config of configs) {
    const pair = config.pair;
    const upsert = buildMirrorUpsertSQL(pair);
    const shape = upsert.shape;
    const querySpec = typeof config.query === 'function'
      ? config.query({ pair, shape, runtime })
      : config.query ?? defaultQuery(pair, shape, runtime);

    const sql = querySpec.sql;
    const parameters = querySpec.parameters ?? [runtime.userId];
    const throttle = config.throttleMs ?? defaults?.throttleMs ?? 150;
    const comparator = config.comparator ?? defaultComparator(shape);

    const query = db.query<RawEncryptedRow & Record<string, any>>({ sql, parameters });
    const sub = query
      .differentialWatch({ throttleMs: throttle, rowComparator: comparator })
      .registerListener({
        onDiff: async ({ added, updated, removed }) => {
          if ((!added || added.length === 0) && (!updated || updated.length === 0) && (!removed || removed.length === 0)) {
            return;
          }

          await db.writeTransaction(async (tx) => {
            const normalizeUpdated = (updated ?? []).map((item: any) => (item && 'current' in item ? item.current : item));
            const work = [...(added ?? []), ...normalizeUpdated];

            for (const rawRow of work) {
              try {
                const normalized = normalizeRow(rawRow, shape);
                let provider: CryptoProvider | null | undefined = runtime.crypto;
                if (config.resolveCrypto) {
                  provider = await config.resolveCrypto({ row: normalized, pair, runtime });
                  if (provider === undefined) {
                    provider = runtime.crypto;
                  }
                }
                if (!provider) {
                  continue;
                }
                const env = columnsToEnvelope(normalized);
                const plain = await provider.decrypt(env, normalized.aad ?? undefined);
                const parsed = pair.parsePlain({
                  plaintext: plain,
                  aad: normalized.aad ?? undefined,
                  encryptedRow: { ...rawRow, ...normalized },
                });
                const base = [
                  normalized.id,
                  normalized.user_id,
                  normalized.bucket_id ?? null,
                  normalized.updated_at,
                ];
                const customVals = pair.mirrorColumns.map((col) => (parsed as any)[col.name] ?? null);
                await tx.execute(upsert.deleteSql, [normalized.id]);
                await tx.execute(upsert.insertSql, [...base, ...customVals]);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(`[mirror ${pair.encryptedTable}→${pair.mirrorTable}] decrypt/parse failed id=${rawRow[shape.id] ?? rawRow.id}`, err);
              }
            }

            for (const rawRow of removed ?? []) {
              const normalized = normalizeRow(rawRow, shape);
              await tx.execute(`DELETE FROM ${pair.mirrorTable} WHERE ${shape.id} = ?`, [normalized.id]);
            }
          });
        },
        onError: (err: unknown) => {
          // eslint-disable-next-line no-console
          console.error(`[mirror ${pair.encryptedTable}→${pair.mirrorTable}] watch error:`, err);
        },
      });
    subs.push({ close: sub });
  }

  return () => {
    for (const sub of subs) {
      try {
        sub.close();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to close encrypted mirror subscription', err);
      }
    }
  };
}

/** Start watchers that keep plaintext mirrors updated from encrypted tables */
export function startEncryptedMirrors(
  runtime: EncryptedRuntime,
  pairs: EncryptedPairConfig[],
  opts?: { throttleMs?: number }
) {
  const configs = pairs.map((pair) => ({ pair }));
  return startEncryptedMirrorSubscriptions(runtime, configs, { throttleMs: opts?.throttleMs });
}
