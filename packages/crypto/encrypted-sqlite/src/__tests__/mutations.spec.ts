import { describe, it, expect } from "vitest";
import { insertEncrypted, updateEncrypted, deleteEncrypted } from "../mutations.js";
import { FakeDB, MockCrypto } from "./fakes";

const CHAT_MESSAGES_PAIR = {
  name: "chat_messages",
  encryptedTable: "chat_messages_cipher",
  mirrorTable: "chat_messages_plain",
  mirrorColumns: [
    { name: "content", type: "TEXT" },
    { name: "is_edited", type: "INTEGER" }
  ],
  parsePlain: () => ({}),
  serializePlain: (obj: any) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    return { plaintext: bytes, aad: "chat-message-v1" };
  }
};

describe("mutations", () => {
  it("insert/update/delete write opaque envelopes to encrypted table", async () => {
    const db = new FakeDB();
    const runtime = { db, userId: "u1", crypto: MockCrypto as any };

    await insertEncrypted(runtime as any, CHAT_MESSAGES_PAIR, {
      id: "m1",
      bucketId: "room-1",
      object: { content: "Hello", isEdited: false }
    });

    let call = db.execCalls.find(c => (c.sql as string).startsWith("INSERT INTO chat_messages_cipher"));
    expect(call).toBeTruthy();
    expect(call!.params![0]).toBe("m1");
    expect(call!.params![1]).toBe("u1");
    expect(call!.params![2]).toBe("room-1");
    expect(call!.params![3]).toBe("test/raw");
    expect(typeof call!.params![6]).toBe("string");

    await updateEncrypted(runtime as any, CHAT_MESSAGES_PAIR, {
      id: "m1",
      bucketId: "room-1",
      object: { content: "Hello again", isEdited: true }
    });
    call = db.execCalls.find(c => (c.sql as string).startsWith("UPDATE chat_messages_cipher"));
    expect(call).toBeTruthy();
    expect(call!.params![0]).toBe("test/raw");

    await deleteEncrypted(runtime as any, CHAT_MESSAGES_PAIR, { id: "m1" });
    call = db.execCalls.find(c => (c.sql as string).startsWith("DELETE FROM chat_messages_cipher"));
    expect(call).toBeTruthy();
    expect(call!.params![0]).toBe("m1");
    expect(call!.params![1]).toBe("u1");
  });
});
