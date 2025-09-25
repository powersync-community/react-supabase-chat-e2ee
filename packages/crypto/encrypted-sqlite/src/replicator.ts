import type { EncryptedPairConfig, EncryptedRuntime, RawEncryptedRow } from "./types.js";
import { columnsToEnvelope, resolveTableShape } from "./types.js";

/** Helper: dynamic UPSERT for mirror with declared custom columns */
function buildMirrorUpsertSQL(pair: EncryptedPairConfig) {
  const mir = pair.mirrorTable;
  const shape = resolveTableShape(pair.tableShape);
  const custom = pair.mirrorColumns.map((c) => c.name);
  const cols = [shape.id, shape.userId, shape.bucketId, shape.updatedAt, ...custom];
  const placeholders = cols.map(() => "?").join(", ");

  const updates = [
    `${shape.userId}=excluded.${shape.userId}`,
    `${shape.bucketId}=excluded.${shape.bucketId}`,
    `${shape.updatedAt}=excluded.${shape.updatedAt}`,
    ...custom.map((n) => `${n}=excluded.${n}`),
  ].join(", ");

  const sql = `
    INSERT INTO ${mir} (${cols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT(${shape.id}) DO UPDATE SET ${updates}
  `.trim();

  return { sql, shape };
}

/** Start watchers that keep plaintext mirrors updated from encrypted tables */
export function startEncryptedMirrors(
  runtime: EncryptedRuntime,
  pairs: EncryptedPairConfig[],
  opts?: { throttleMs?: number }
) {
  const { db, userId, crypto } = runtime;
  const subs: Array<{ close: () => void }> = [];

  for (const p of pairs) {
    const enc = p.encryptedTable;
    const mir = p.mirrorTable;
    const throttle = opts?.throttleMs ?? 150;
    const upsert = buildMirrorUpsertSQL(p);
    const shape = upsert.shape;

    const q = db.query<RawEncryptedRow>({
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
          ${shape.updatedAt} AS updated_at
          FROM ${enc}
         WHERE ${shape.userId} = ?
         ORDER BY ${shape.updatedAt} DESC
      `,
      parameters: [userId]
    });
    const sub = q.differentialWatch({
        throttleMs: throttle,
        rowComparator: {
          keyBy: (r) => String(r.id),
          compareBy: (r) =>
            `${r.alg}|${r.aad ?? ""}|${r.nonce_b64}|${r.cipher_b64}|${r.kdf_salt_b64}|${r.updated_at}`
        }
    }).registerListener({
         onDiff: async ({ added, updated, removed }) => {
        if ((!added || added.length === 0) && (!updated || updated.length === 0) && (!removed || removed.length === 0)) {
          return;
        }

        await db.writeTransaction(async (tx) => {
          const normalizeUpdated = (updated ?? []).map((u: any) => (u && "current" in u ? u.current : u));
          const work = [...(added ?? []), ...normalizeUpdated];

          // Upsert mirror for added/updated
          for (const r of work) {
            try {
              const env = columnsToEnvelope(r);
              const plain = await crypto.decrypt(env, r.aad ?? undefined);
              const parsed = p.parsePlain({
                plaintext: plain,
                aad: r.aad ?? undefined,
                encryptedRow: {
                  id: r.id,
                  user_id: r.user_id,
                  bucket_id: r.bucket_id ?? null,
                  updated_at: r.updated_at,
                  alg: r.alg
                }
              });

              // Build param array in declared column order
              const base = [r.id, r.user_id, r.bucket_id ?? null, r.updated_at];
              const customVals = p.mirrorColumns.map(col => parsed[col.name] ?? null);
              await tx.execute(upsert.sql, [...base, ...customVals]);
            } catch (e) {
              // If key locked or parse fails, skip row
              // eslint-disable-next-line no-console
              console.warn(`[mirror ${enc}→${mir}] decrypt/parse failed id=${r.id}`, e);
            }
          }

          // Remove from mirror
          for (const r of removed ?? []) {
            await tx.execute(`DELETE FROM ${mir} WHERE ${shape.id} = ?`, [r.id]);
          }
        });
      },
      onError: (err: any) => {
        // eslint-disable-next-line no-console
        console.error(`[mirror ${enc}→${mir}] watch error:`, err);
      }
    } );
    subs.push({close: sub});
  }

  return () => {
    for (const s of subs) {
      try { s.close(); } catch {}
    }
  };
}