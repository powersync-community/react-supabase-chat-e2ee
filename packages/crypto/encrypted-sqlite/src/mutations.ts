import type { EncryptedPairConfig, EncryptedRuntime } from "./types.js";
import { utf8, resolveTableShape } from "./types.js";

/** ISO helper */
function nowIso() { return new Date().toISOString(); }

type InsertArgs<T> =
  | { id: string; bucketId?: string | null; object: T; aad?: string }
  | { id: string; bucketId?: string | null; plaintext: Uint8Array; aad?: string };

type UpdateArgs<T> =
  | { id: string; bucketId?: string | null; object: T; aad?: string }
  | { id: string; bucketId?: string | null; plaintext: Uint8Array; aad?: string };

function toPlain<T>(pair: EncryptedPairConfig<T>, args: { object?: T; plaintext?: Uint8Array; aad?: string }) {
  if (args.plaintext) return { plaintext: args.plaintext, aad: args.aad ?? pair.aad };
  if (args.object != null) {
    if (pair.serializePlain) return pair.serializePlain(args.object);
    // default fallback: JSON
    return { plaintext: utf8(JSON.stringify(args.object)), aad: args.aad ?? pair.aad };
  }
  throw new Error("insert/update requires either 'object' or 'plaintext'");
}

export async function insertEncrypted<T>(
  runtime: EncryptedRuntime,
  pair: EncryptedPairConfig<T>,
  args: InsertArgs<T>
) {
  const { db, userId, crypto } = runtime;
  const { plaintext, aad } = toPlain(pair, args);
  const env = await crypto.encrypt(plaintext, aad);
  const now = nowIso();
  const shape = resolveTableShape(pair.tableShape);

  await db.execute(
    `INSERT INTO ${pair.encryptedTable} (
      ${shape.id}, ${shape.userId}, ${shape.bucketId},
      ${shape.alg}, ${shape.aad}, ${shape.nonce}, ${shape.cipher}, ${shape.kdfSalt},
      ${shape.createdAt}, ${shape.updatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`.trim(),
    [
      args.id,
      userId,
      args.bucketId ?? null,
      env.header.alg,
      env.header.aad ?? null,
      env.nB64,
      env.cB64,
      env.header.kdf.saltB64 ?? "",
      now,
      now
    ]
  );
}

export async function updateEncrypted<T>(
  runtime: EncryptedRuntime,
  pair: EncryptedPairConfig<T>,
  args: UpdateArgs<T>
) {
  const { db, userId, crypto } = runtime;
  const { plaintext, aad } = toPlain(pair, args as any);
  const env = await crypto.encrypt(plaintext, aad);
  const now = nowIso();
  const shape = resolveTableShape(pair.tableShape);

  await db.execute(
    `UPDATE ${pair.encryptedTable}
        SET ${shape.alg} = ?, ${shape.aad} = ?, ${shape.nonce} = ?, ${shape.cipher} = ?, ${shape.kdfSalt} = ?, ${shape.updatedAt} = ?
      WHERE ${shape.id} = ? AND ${shape.userId} = ?`.trim(),
    [
      env.header.alg,
      env.header.aad ?? null,
      env.nB64,
      env.cB64,
      env.header.kdf.saltB64 ?? "",
      now,
      args.id,
      userId
    ]
  );
}

export async function deleteEncrypted(
  runtime: EncryptedRuntime,
  pair: EncryptedPairConfig,
  args: { id: string }
) {
  const { db, userId } = runtime;
  const shape = resolveTableShape(pair.tableShape);
  await db.execute(
    `DELETE FROM ${pair.encryptedTable} WHERE ${shape.id} = ? AND ${shape.userId} = ?`,
    [args.id, userId]
  );
}