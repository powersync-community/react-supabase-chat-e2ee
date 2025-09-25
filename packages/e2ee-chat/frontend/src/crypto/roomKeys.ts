import { bytesToBase64, base64ToBytes, type CipherEnvelope } from '@crypto/interface';
import sodium from 'libsodium-wrappers-sumo';

const ALG = 'xchacha20poly1305/x25519-wrap-v1';

export type RoomKeyWrapContext = {
  roomId: string;
  senderId: string;
  recipientId: string;
};

function buildContextString(ctx: RoomKeyWrapContext): string {
  return `room:${ctx.roomId}|from:${ctx.senderId}|to:${ctx.recipientId}`;
}

async function deriveWrapKey(ourSecretKey: Uint8Array, peerPublicKey: Uint8Array, ctx: RoomKeyWrapContext): Promise<Uint8Array> {
  await sodium.ready;
  const shared = sodium.crypto_scalarmult(ourSecretKey, peerPublicKey);
  const context = buildContextString(ctx);
  const contextDigest = sodium.crypto_generichash(32, sodium.from_string(context));
  return sodium.crypto_generichash(32, shared, contextDigest);
}

export async function wrapRoomKey(
  roomKey: Uint8Array,
  ourSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  ctx: RoomKeyWrapContext,
): Promise<CipherEnvelope> {
  await sodium.ready;
  const wrapKey = await deriveWrapKey(ourSecretKey, recipientPublicKey, ctx);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const aad = buildContextString(ctx);
  const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    roomKey,
    new TextEncoder().encode(aad),
    null,
    nonce,
    wrapKey,
  );
  return {
    header: {
      v: 1,
      alg: ALG,
      aad,
      kdf: { saltB64: '' },
    },
    nB64: bytesToBase64(nonce),
    cB64: bytesToBase64(cipher),
  };
}

export async function unwrapRoomKey(
  envelope: CipherEnvelope,
  ourSecretKey: Uint8Array,
  peerPublicKey: Uint8Array,
  ctx: RoomKeyWrapContext,
): Promise<Uint8Array> {
  await sodium.ready;
  if (!envelope.header.alg.startsWith('xchacha20poly1305/x25519-wrap')) {
    throw new Error(`Unsupported room key wrapping algorithm: ${envelope.header.alg}`);
  }
  const wrapKey = await deriveWrapKey(ourSecretKey, peerPublicKey, ctx);
  const nonce = base64ToBytes(envelope.nB64);
  const cipher = base64ToBytes(envelope.cB64);
  const aad = envelope.header.aad ?? buildContextString(ctx);
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    cipher,
    aad ? new TextEncoder().encode(aad) : null,
    nonce,
    wrapKey,
  );
}
