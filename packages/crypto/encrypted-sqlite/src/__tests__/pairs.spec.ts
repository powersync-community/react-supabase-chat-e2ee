import { describe, it, expect } from "vitest";
import { ensurePairsDDL } from "../pairs.js";
import { FakeDB } from "./fakes.js";

describe("ensurePairsDDL", () => {
  it("creates encrypted & mirror tables with custom columns and triggers", async () => {
    const db = new FakeDB();

    await ensurePairsDDL(db as any, [
      {
        name: "chat_messages",
        encryptedTable: "chat_messages_cipher",
        mirrorTable: "chat_messages_plain",
        mirrorColumns: [
          { name: "content", type: "TEXT", notNull: true, defaultExpr: "''" },
          { name: "is_edited", type: "INTEGER", notNull: true, defaultExpr: "0" }
        ],
        parsePlain: () => ({})
      }
    ]);

    const ddl = db.execCalls.map(c => c.sql).join("\n---\n");
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS chat_messages_cipher (");
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS chat_messages_plain (");
    expect(ddl).toContain("content TEXT NOT NULL DEFAULT ''");
    expect(ddl).toContain("is_edited INTEGER NOT NULL DEFAULT 0");
    expect(ddl).toContain("CREATE TRIGGER IF NOT EXISTS chat_messages_cipher_insert");
    expect(ddl).toContain("CREATE TRIGGER IF NOT EXISTS chat_messages_cipher_update");
    expect(ddl).toContain("CREATE TRIGGER IF NOT EXISTS chat_messages_cipher_delete");
  });
});
