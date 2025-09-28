import type { CryptoProvider } from "@crypto/interface";
import { bytesToBase64, base64ToBytes } from "@crypto/interface";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import sodium from "libsodium-wrappers-sumo";

const IDENTITY_KEY_AAD = "identity-key-v1";
const PRIVATE_KEY_ID_FORMAT = (userId: string) => `identity:${userId}`;

export type IdentityKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyB64: string;
  secretKeyB64: string;
};

type IdentityPrivateRow = {
  id: string;
  user_id: string;
  alg: string;
  aad?: string | null;
  nonce_b64: string;
  cipher_b64: string;
  kdf_salt_b64: string;
  created_at: string;
};

type IdentityPublicRow = {
  user_id: string;
  key_version: number;
  public_key_b64: string;
};

async function fetchPrivateRow(
  db: AbstractPowerSyncDatabase,
  userId: string,
): Promise<IdentityPrivateRow | null> {
  const rows = await db.getAll<IdentityPrivateRow>(
    "SELECT * FROM chat_identity_private_keys WHERE user_id = ? LIMIT 1",
    [userId],
  );
  return rows?.[0] ?? null;
}

async function upsertPrivateRow(
  db: AbstractPowerSyncDatabase,
  userId: string,
  env: {
    alg: string;
    aad?: string | null;
    nonce_b64: string;
    cipher_b64: string;
    kdf_salt_b64: string;
  },
) {
  const id = PRIVATE_KEY_ID_FORMAT(userId);
  const now = new Date().toISOString();
  await db.execute("DELETE FROM chat_identity_private_keys WHERE id = ?", [id]);
  await db.execute(
    `
    INSERT INTO chat_identity_private_keys (id, user_id, alg, aad, nonce_b64, cipher_b64, kdf_salt_b64, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `.trim(),
    [
      id,
      userId,
      env.alg,
      env.aad ?? null,
      env.nonce_b64,
      env.cipher_b64,
      env.kdf_salt_b64 ?? "",
      now,
    ],
  );
}

async function upsertPublicRow(
  db: AbstractPowerSyncDatabase,
  userId: string,
  publicKeyB64: string,
  version = 1,
) {
  const id = `${userId}:${version}`;
  const now = new Date().toISOString();
  await db.execute("DELETE FROM chat_identity_public_keys WHERE id = ?", [id]);
  await db.execute(
    `
    INSERT INTO chat_identity_public_keys (id, user_id, key_version, public_key_b64, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `.trim(),
    [id, userId, version, publicKeyB64, now, now],
  );
}

async function decryptPrivateKey(
  row: IdentityPrivateRow,
  kek: CryptoProvider,
): Promise<Uint8Array | null> {
  try {
    const plain = await kek.decrypt(
      {
        header: {
          v: 1,
          alg: row.alg,
          aad: row.aad ?? undefined,
          kdf: { saltB64: row.kdf_salt_b64 ?? "" },
        },
        nB64: row.nonce_b64,
        cB64: row.cipher_b64,
      },
      row.aad ?? undefined,
    );
    return plain;
  } catch (err) {
    console.warn(
      "Failed to decrypt identity private key with current vault key",
      err,
    );
    return null;
  }
}

export async function ensureIdentityKeyPair(
  db: AbstractPowerSyncDatabase,
  userId: string,
  kek: CryptoProvider,
): Promise<IdentityKeyPair> {
  await sodium.ready;
  const existing = await fetchPrivateRow(db, userId);
  if (existing) {
    const secret = await decryptPrivateKey(existing, kek);
    if (secret) {
      const secretBytes = new Uint8Array(secret);
      const publicRow = await db.getAll<IdentityPublicRow>(
        "SELECT * FROM chat_identity_public_keys WHERE user_id = ? ORDER BY key_version DESC LIMIT 1",
        [userId],
      );
      const publicKeyB64 =
        publicRow?.[0]?.public_key_b64 ??
        bytesToBase64(sodium.crypto_scalarmult_base(secretBytes));
      return {
        publicKey: base64ToBytes(publicKeyB64),
        secretKey: secretBytes,
        publicKeyB64,
        secretKeyB64: bytesToBase64(secretBytes),
      };
    }
    // fallthrough to regenerate if decrypt failed
  }

  const keyPair = sodium.crypto_kx_keypair();
  const publicKeyB64 = bytesToBase64(keyPair.publicKey);
  const secretKeyB64 = bytesToBase64(keyPair.privateKey);
  const envelope = await kek.encrypt(keyPair.privateKey, IDENTITY_KEY_AAD);
  await upsertPrivateRow(db, userId, {
    alg: envelope.header.alg,
    aad: envelope.header.aad ?? IDENTITY_KEY_AAD,
    nonce_b64: envelope.nB64,
    cipher_b64: envelope.cB64,
    kdf_salt_b64: envelope.header.kdf.saltB64 ?? "",
  });
  await upsertPublicRow(db, userId, publicKeyB64, 1);

  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.privateKey,
    publicKeyB64,
    secretKeyB64,
  };
}

export async function loadPeerPublicKey(
  db: AbstractPowerSyncDatabase,
  userId: string,
): Promise<Uint8Array | null> {
  const rows = await db.getAll<IdentityPublicRow>(
    "SELECT * FROM chat_identity_public_keys WHERE user_id = ? ORDER BY key_version DESC LIMIT 1",
    [userId],
  );
  const row = rows?.[0];
  if (!row) return null;
  return base64ToBytes(row.public_key_b64);
}
