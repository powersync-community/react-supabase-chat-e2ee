import { useEffect, useMemo, useState } from 'react';
import { usePowerSync, useQuery } from '@powersync/react';
import { createPasswordCrypto } from '@crypto/password';
import { createDEKCrypto, insertEncrypted, generateDEK } from '@crypto/sqlite';
import type { CryptoProvider } from '@crypto/interface';
import AuthScreen from './components/AuthScreen';
import VaultScreen from './components/VaultScreen';
import ChatLayout from './components/ChatLayout';
import {
  getCurrentUserId,
  getSupabase,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  signInAnonymously,
  isAnonymousSupported,
} from './utils/supabase';
import { ensureVaultKey } from './utils/keyring';
import { CHAT_MESSAGES_PAIR, CHAT_ROOMS_PAIR } from './encrypted/chatPairs';
import { startChatMirrors } from './encrypted/chatMirrors';
import { ensureIdentityKeyPair, loadPeerPublicKey, type IdentityKeyPair } from './crypto/identity';
import { wrapRoomKey, unwrapRoomKey } from './crypto/roomKeys';

function useSupabaseUser(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await getCurrentUserId();
      if (mounted) setUserId(id);
    })();

    const client = getSupabase();
    if (!client) return () => {
      mounted = false;
    };

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return userId;
}

function useVaultProviders(userId: string | null) {
  const { data } = useQuery(
    'SELECT provider FROM chat_e2ee_keys WHERE user_id = ?',
    [userId ?? ''],
    { throttleMs: 150 },
  );
  return useMemo(() => {
    const rows = Array.isArray(data) ? (data as Array<{ provider: string }>) : [];
    const providers = new Set(rows.map((r) => r.provider));
    return {
      haveAny: providers.size > 0,
      havePassword: providers.has('password'),
    };
  }, [data]);
}

type RoomPlain = {
  id: string;
  name: string;
  topic: string | null;
  updatedAt: string;
};

type MessagePlain = {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
};

type MemberPlain = {
  roomId: string;
  userId: string;
  invitedBy: string;
  role: string;
  joinedAt: string;
};

const memberIdFor = (roomId: string, userId: string) => `${roomId}:${userId}`;

type RoomKeyRow = {
  room_id: string;
  user_id: string;
  wrapped_by: string | null;
  alg: string;
  aad?: string | null;
  nonce_b64: string;
  cipher_b64: string;
  kdf_salt_b64: string;
};

export default function App() {
  const db = usePowerSync();
  const [dbReady, setDbReady] = useState(false);
  const userId = useSupabaseUser();
  const providers = useVaultProviders(userId);

  const [dataCrypto, setDataCrypto] = useState<CryptoProvider | null>(null);
  const [identity, setIdentity] = useState<IdentityKeyPair | null>(null);
  const [roomKeys, setRoomKeys] = useState<Map<string, Uint8Array>>(new Map());
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [mirrorsStarted, setMirrorsStarted] = useState(false);
  const [guestSupported, setGuestSupported] = useState(() => isAnonymousSupported());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await db.waitForReady();
        if (!cancelled) setDbReady(true);
      } catch (err) {
        console.error('Failed to wait for PowerSync readiness', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    if (!dataCrypto) {
      setIdentity(null);
      setRoomKeys(new Map());
    }
  }, [dataCrypto]);

  useEffect(() => {
    setGuestSupported(isAnonymousSupported());
  }, [userId]);

  const roomProviders = useMemo(() => {
    const map = new Map<string, CryptoProvider>();
    for (const [roomId, key] of roomKeys.entries()) {
      map.set(roomId, createDEKCrypto(key));
    }
    return map;
  }, [roomKeys]);

  useEffect(() => {
    if (!userId || !dataCrypto) return;
    const stop = startChatMirrors(
      { db, userId, crypto: dataCrypto },
      {
        resolveCrypto: (row) => {
          const candidate = (row.bucket_id as string | undefined) ?? (row as any).room_id ?? (row.id as string | undefined);
          if (!candidate) return null;
          return roomProviders.get(candidate) ?? null;
        },
      },
    );
    setMirrorsStarted(true);
    return () => {
      stop?.();
      setMirrorsStarted(false);
    };
  }, [db, userId, dataCrypto, roomProviders]);

  useEffect(() => {
    if (!userId || !dataCrypto) return;
    let cancelled = false;
    (async () => {
      try {
        const pair = await ensureIdentityKeyPair(db, userId, dataCrypto);
        if (!cancelled) setIdentity(pair);
      } catch (err) {
        console.error('Failed to ensure identity key pair', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, dataCrypto]);

  const { data: roomKeyRows } = useQuery(
    'SELECT * FROM chat_room_keys WHERE user_id = ?',
    [userId ?? ''],
    { throttleMs: 250 },
  );

  useEffect(() => {
    if (!identity || !userId) return;
    const rows = Array.isArray(roomKeyRows) ? (roomKeyRows as RoomKeyRow[]) : [];
    if (!rows.length) return;
    let cancelled = false;
    (async () => {
      const resolved: Array<[string, Uint8Array]> = [];
      for (const row of rows) {
        const roomId = row.room_id;
        if (!roomId) continue;
        const ctx = {
          roomId,
          senderId: row.wrapped_by ?? row.user_id ?? userId,
          recipientId: userId,
        };
        let peerPublic: Uint8Array | null = null;
        try {
          if (row.wrapped_by && row.wrapped_by !== userId) {
            peerPublic = await loadPeerPublicKey(db, row.wrapped_by);
          } else {
            peerPublic = identity.publicKey;
          }
          if (!peerPublic) continue;
          const env = {
            header: {
              v: 1 as const,
              alg: row.alg,
              aad: row.aad ?? undefined,
              kdf: { saltB64: row.kdf_salt_b64 ?? '' },
            },
            nB64: row.nonce_b64,
            cB64: row.cipher_b64,
          };
          const key = await unwrapRoomKey(env, identity.secretKey, peerPublic, ctx);
          resolved.push([roomId, key]);
        } catch (err) {
          console.warn('Failed to unwrap room key', row.room_id, err);
        }
      }
      if (cancelled || !resolved.length) return;
      setRoomKeys((prev) => {
        const next = new Map(prev);
        for (const [roomId, key] of resolved) {
          next.set(roomId, key);
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [roomKeyRows, identity, db, userId]);

  const { data: roomsData } = useQuery(
    'SELECT * FROM chat_rooms_plain ORDER BY updated_at DESC',
    [],
    { throttleMs: 200 },
  );
  const rooms: RoomPlain[] = useMemo(() => {
    if (!Array.isArray(roomsData)) return [];
    return (roomsData as any[]).map((row) => ({
      id: String(row.id),
      name: (row.name as string) ?? 'Untitled room',
      topic: (row.topic as string | null) ?? null,
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    }));
  }, [roomsData]);

  useEffect(() => {
    if (!rooms.length) {
      setActiveRoomId(null);
      return;
    }
    if (!activeRoomId) {
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const { data: messagesData } = useQuery(
    'SELECT * FROM chat_messages_plain WHERE room_id = ? ORDER BY sent_at ASC',
    [activeRoomId ?? ''],
    { throttleMs: 120 },
  );
  const messages: MessagePlain[] = useMemo(() => {
    if (!Array.isArray(messagesData)) return [];
    return (messagesData as any[]).map((row) => ({
      id: String(row.id),
      senderId: String(row.sender_id ?? row.user_id ?? ''),
      text: String(row.text ?? ''),
      sentAt: String(row.sent_at ?? row.updated_at ?? new Date().toISOString()),
    }));
  }, [messagesData]);

  const { data: membershipData } = useQuery(
    'SELECT * FROM chat_room_members WHERE room_id = ? ORDER BY joined_at ASC',
    [activeRoomId ?? ''],
    { throttleMs: 300 },
  );
  const members: MemberPlain[] = useMemo(() => {
    if (!Array.isArray(membershipData)) return [];
    return (membershipData as any[]).map((row) => ({
      roomId: String(row.room_id ?? ''),
      userId: String(row.user_id ?? ''),
      invitedBy: String(row.invited_by ?? ''),
      role: String(row.role ?? 'member'),
      joinedAt: String(row.joined_at ?? new Date().toISOString()),
    }));
  }, [membershipData]);

  const canSendToActiveRoom = activeRoomId ? roomKeys.has(activeRoomId) : false;

  const handleSignIn = async (email: string, password: string) => {
    try {
      await signInWithPassword(email, password);
    } catch (err: any) {
      throw new Error(err?.message ?? 'Sign-in failed');
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      await signUpWithPassword(email, password);
    } catch (err: any) {
      throw new Error(err?.message ?? 'Sign-up failed');
    }
  };

  const handleGuestSignIn = async () => {
    try {
      await signInAnonymously();
    } catch (err: any) {
      throw new Error(err?.message ?? 'Guest sign-in failed');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setDataCrypto(null);
    setIdentity(null);
    setRoomKeys(new Map());
    setActiveRoomId(null);
  };

  const handleCreateVault = async (passphrase: string) => {
    if (!userId) throw new Error('User not authenticated.');
    try {
      const wrapper = createPasswordCrypto({ password: passphrase, preferWebCrypto: true });
      const dek = await ensureVaultKey(db, userId, 'password', wrapper);
      setDataCrypto(createDEKCrypto(dek));
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to create vault.');
    }
  };

  const handleUnlockVault = async (passphrase: string) => {
    if (!userId) throw new Error('User not authenticated.');
    try {
      const wrapper = createPasswordCrypto({ password: passphrase, preferWebCrypto: true });
      const dek = await ensureVaultKey(db, userId, 'password', wrapper);
      setDataCrypto(createDEKCrypto(dek));
    } catch (err: any) {
      throw new Error(err?.message ?? 'Passphrase did not unlock your vault.');
    }
  };

  const handleCreateRoom = async (name: string, topic: string) => {
    if (!userId || !identity) throw new Error('Vault not ready yet.');
    try {
      const id = crypto.randomUUID();
      const roomKey = await generateDEK();
      const roomCrypto = createDEKCrypto(roomKey);
      await insertEncrypted({ db, userId, crypto: roomCrypto }, CHAT_ROOMS_PAIR, {
        id,
        bucketId: id,
        object: { name, topic: topic || undefined },
      });
      await db.execute(
        'INSERT INTO chat_room_members (id, room_id, user_id, invited_by, role, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
        [memberIdFor(id, userId), id, userId, userId, 'owner', new Date().toISOString()],
      );
      const envelope = await wrapRoomKey(roomKey, identity.secretKey, identity.publicKey, {
        roomId: id,
        senderId: userId,
        recipientId: userId,
      });
      await db.execute(
        'INSERT INTO chat_room_keys (id, room_id, user_id, wrapped_by, alg, aad, nonce_b64, cipher_b64, kdf_salt_b64, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n         ON CONFLICT(id) DO UPDATE SET alg = excluded.alg, aad = excluded.aad, nonce_b64 = excluded.nonce_b64, cipher_b64 = excluded.cipher_b64, kdf_salt_b64 = excluded.kdf_salt_b64, created_at = excluded.created_at',
        [
          `${id}:${userId}`,
          id,
          userId,
          userId,
          envelope.header.alg,
          envelope.header.aad ?? null,
          envelope.nB64,
          envelope.cB64,
          envelope.header.kdf.saltB64 ?? '',
          new Date().toISOString(),
        ],
      );
      setRoomKeys((prev) => {
        const next = new Map(prev);
        next.set(id, roomKey);
        return next;
      });
      setActiveRoomId(id);
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to create room.');
    }
  };

  const handleSendMessage = async (roomId: string, text: string) => {
    if (!userId) throw new Error('User not authenticated.');
    const provider = roomProviders.get(roomId);
    if (!provider) throw new Error('Room key not available yet.');
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await insertEncrypted({ db, userId, crypto: provider }, CHAT_MESSAGES_PAIR, {
        id,
        bucketId: roomId,
        object: { text, sentAt: now, senderId: userId },
      });
    } catch (err: any) {
      throw new Error(err?.message ?? 'Could not send message.');
    }
  };

  const handleInviteUser = async (roomId: string, targetUserId: string) => {
    if (!userId || !identity) throw new Error('Vault not ready yet.');
    if (targetUserId === userId) throw new Error('You are already in this room.');
    const roomKey = roomKeys.get(roomId);
    if (!roomKey) throw new Error('Room key not available yet.');
    const peerPublic = await loadPeerPublicKey(db, targetUserId);
    if (!peerPublic) throw new Error('Target user has not published an identity key.');
    const envelope = await wrapRoomKey(roomKey, identity.secretKey, peerPublic, {
      roomId,
      senderId: userId,
      recipientId: targetUserId,
    });
    const now = new Date().toISOString();
    await db.writeTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO chat_room_members (id, room_id, user_id, invited_by, role, joined_at) VALUES (?, ?, ?, ?, ?, ?)\n         ON CONFLICT(id) DO UPDATE SET invited_by = excluded.invited_by, role = excluded.role, joined_at = excluded.joined_at`,
        [memberIdFor(roomId, targetUserId), roomId, targetUserId, userId, 'member', now],
      );
      await tx.execute(
        `INSERT INTO chat_room_keys (id, room_id, user_id, wrapped_by, alg, aad, nonce_b64, cipher_b64, kdf_salt_b64, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n         ON CONFLICT(id) DO UPDATE SET alg = excluded.alg, aad = excluded.aad, nonce_b64 = excluded.nonce_b64, cipher_b64 = excluded.cipher_b64, kdf_salt_b64 = excluded.kdf_salt_b64, created_at = excluded.created_at`,
        [
          `${roomId}:${targetUserId}`,
          roomId,
          targetUserId,
          userId,
          envelope.header.alg,
          envelope.header.aad ?? null,
          envelope.nB64,
          envelope.cB64,
          envelope.header.kdf.saltB64 ?? '',
          now,
        ],
      );
    });
  };

  if (!userId) {
    return (
      <AuthScreen
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onGuestSignIn={guestSupported ? handleGuestSignIn : undefined}
        allowGuest={guestSupported}
      />
    );
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-950/5 flex items-center justify-center">
        <div className="text-sm text-slate-500">Connecting to PowerSync…</div>
      </div>
    );
  }

  if (!dataCrypto) {
    return (
      <VaultScreen
        hasVault={providers.haveAny}
        onCreateVault={handleCreateVault}
        onUnlockVault={handleUnlockVault}
        onSignOut={handleSignOut}
      />
    );
  }

  if (!identity) {
    return (
      <div className="min-h-screen bg-slate-950/5 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-slate-500">Preparing identity keys…</div>
          <button type="button" className="btn-secondary" onClick={() => handleSignOut()}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatLayout
      userId={userId}
      mirrorsStarted={mirrorsStarted}
      rooms={rooms}
      activeRoomId={activeRoomId}
      onSelectRoom={setActiveRoomId}
      onCreateRoom={handleCreateRoom}
      messages={messages}
      members={members
        .filter((member) => member.roomId === (activeRoomId ?? ''))
        .map(({ userId: memberId, invitedBy, role, joinedAt }) => ({
          userId: memberId,
          invitedBy,
          role,
          joinedAt,
        }))}
      canSendToActiveRoom={canSendToActiveRoom}
      onSendMessage={handleSendMessage}
      onInviteUser={handleInviteUser}
      onSignOut={handleSignOut}
    />
  );
}
