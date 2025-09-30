import { describe, it, expect } from "vitest";
import { startEncryptedMirrors } from "../replicator.js";
import { FakeDB, MockCrypto } from "./fakes.js";

const CHAT_MESSAGES_PAIR = {
  name: "chat_messages",
  encryptedTable: "chat_messages_cipher",
  mirrorTable: "chat_messages_plain",
  mirrorColumns: [
    { name: "content", type: "TEXT", notNull: true, defaultExpr: "''" },
    { name: "is_edited", type: "INTEGER", notNull: true, defaultExpr: "0" }
  ],
  parsePlain: ({ plaintext }: any) => {
    const obj = JSON.parse(new TextDecoder().decode(plaintext));
    return { content: obj.content ?? "", is_edited: obj.isEdited ? 1 : 0 };
  }
};

describe("replicator", () => {
  it("decrypts, parses, and upserts into mirror columns", async () => {
    const db = new FakeDB();

    const stop = startEncryptedMirrors(
      { db: db as any, userId: "u1", crypto: MockCrypto as any },
      [CHAT_MESSAGES_PAIR],
      { throttleMs: 0 }
    );

    const reg = db.queries.find(q => q.sql.includes("FROM chat_messages_cipher"));
    expect(reg).toBeTruthy();

    await reg!.instance.emit({
      added: [{
        id: "m1",
        user_id: "u1",
        bucket_id: "room-1",
        alg: "test/raw",
        aad: null,
        nonce_b64: "N",
        cipher_b64: Buffer.from(
          JSON.stringify({ content: "Hello", isEdited: false }),
          "utf8"
        ).toString("base64"),
        kdf_salt_b64: "",
        updated_at: "2025-01-01T00:00:00.000Z"
      }]
    });

    const ins = db.lastTx!.calls.find(c => (c.sql as string).includes(`INSERT INTO ${CHAT_MESSAGES_PAIR.mirrorTable}`));
    expect(ins).toBeTruthy();
    expect(ins!.params![0]).toBe("m1");
    expect(ins!.params![1]).toBe("u1");
    expect(ins!.params![2]).toBe("room-1");
    expect(ins!.params![4]).toBe("Hello");
    expect(ins!.params![5]).toBe(0);

    db.lastTx = null;
    await reg!.instance.emit({
      updated: [{
        id: "m1",
        user_id: "u1",
        bucket_id: "room-1",
        alg: "test/raw",
        aad: null,
        nonce_b64: "N",
        cipher_b64: Buffer.from(
          JSON.stringify({ content: "Hello again", isEdited: true }),
          "utf8"
        ).toString("base64"),
        kdf_salt_b64: "",
        updated_at: "2025-01-01T01:00:00.000Z"
      }]
    });
    const updDelete = db.lastTx!.calls.find(c => (c.sql as string).startsWith(`DELETE FROM ${CHAT_MESSAGES_PAIR.mirrorTable}`));
    const updInsert = db.lastTx!.calls.find(c => (c.sql as string).includes(`INSERT INTO ${CHAT_MESSAGES_PAIR.mirrorTable}`));
    expect(updDelete).toBeTruthy();
    expect(updInsert).toBeTruthy();
    expect(updInsert!.params![4]).toBe("Hello again");
    expect(updInsert!.params![5]).toBe(1);

    db.lastTx = null;
    await reg!.instance.emit({ removed: [{ id: "m1" }] });
    const del = db.lastTx!.calls.find(c => (c.sql as string).startsWith(`DELETE FROM ${CHAT_MESSAGES_PAIR.mirrorTable}`));
    expect(del).toBeTruthy();

    stop();
  });
});
