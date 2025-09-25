import type { EncryptedPairConfig } from '@crypto/sqlite';
import { utf8 } from '@crypto/sqlite';

type RoomPayload = {
  name: string;
  topic?: string;
};

type MessagePayload = {
  text: string;
  sentAt?: string;
  senderId?: string;
};

export const CHAT_ROOMS_PAIR: EncryptedPairConfig<RoomPayload> = {
  name: 'chat_rooms',
  encryptedTable: 'chat_rooms',
  mirrorTable: 'chat_rooms_plain',
  mirrorColumns: [
    { name: 'name', type: 'TEXT', notNull: true, defaultExpr: "''" },
    { name: 'topic', type: 'TEXT' },
  ],
  aad: 'chat-room-v1',
  parsePlain: ({ plaintext }) => {
    const json = new TextDecoder().decode(plaintext);
    try {
      const obj = JSON.parse(json) as RoomPayload;
      return {
        name: obj.name ?? 'Untitled room',
        topic: obj.topic ?? null,
      } as any;
    } catch {
      return { name: json || 'Untitled room', topic: null } as any;
    }
  },
  serializePlain: (room) => ({
    plaintext: utf8(JSON.stringify(room)),
    aad: 'chat-room-v1',
  }),
};

export const CHAT_MESSAGES_PAIR: EncryptedPairConfig<MessagePayload> = {
  name: 'chat_messages',
  encryptedTable: 'chat_messages',
  mirrorTable: 'chat_messages_plain',
  mirrorColumns: [
    { name: 'room_id', type: 'TEXT', notNull: true },
    { name: 'sender_id', type: 'TEXT', notNull: true },
    { name: 'text', type: 'TEXT', notNull: true, defaultExpr: "''" },
    { name: 'sent_at', type: 'TEXT', notNull: true },
  ],
  aad: 'chat-message-v1',
  parsePlain: ({ plaintext, encryptedRow }) => {
    const raw = new TextDecoder().decode(plaintext);
    let parsed: MessagePayload | null = null;
    try {
      parsed = JSON.parse(raw) as MessagePayload;
    } catch {
      parsed = null;
    }
    const roomId = (encryptedRow as any).bucket_id ?? (encryptedRow as any).room_id ?? null;
    const sentAt = parsed?.sentAt ?? (encryptedRow as any).sent_at ?? encryptedRow.updated_at;
    const senderId = parsed?.senderId ?? (encryptedRow as any).sender_id ?? encryptedRow.user_id;
    return {
      room_id: roomId,
      sender_id: senderId,
      text: parsed?.text ?? raw,
      sent_at: sentAt,
    } as any;
  },
  serializePlain: (message) => ({
    plaintext: utf8(JSON.stringify(message)),
    aad: 'chat-message-v1',
  }),
};

export const CHAT_PAIRS = [CHAT_ROOMS_PAIR, CHAT_MESSAGES_PAIR];
