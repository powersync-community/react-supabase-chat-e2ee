import { Schema } from "@powersync/web";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import type { EncryptedPairConfig, MirrorColumnDef } from "./types.js";
import { resolveTableShape } from "./types.js";

function jsonObjectFields(shape: ReturnType<typeof resolveTableShape>, source: 'NEW' | 'OLD') {
  return [
    `'${shape.userId}', ${source}.${shape.userId}`,
    `'${shape.bucketId}', ${source}.${shape.bucketId}`,
    `'${shape.alg}', ${source}.${shape.alg}`,
    `'${shape.aad}', ${source}.${shape.aad}`,
    `'${shape.nonce}', ${source}.${shape.nonce}`,
    `'${shape.cipher}', ${source}.${shape.cipher}`,
    `'${shape.kdfSalt}', ${source}.${shape.kdfSalt}`,
    `'${shape.createdAt}', ${source}.${shape.createdAt}`,
    `'${shape.updatedAt}', ${source}.${shape.updatedAt}`,
  ].join(',\n          ');
}

function columnDDL(col: MirrorColumnDef): string {
  return [
    col.name,
    col.type,
    col.notNull ? "NOT NULL" : "",
    col.defaultExpr ? `DEFAULT ${col.defaultExpr}` : ""
  ].filter(Boolean).join(" ");
}

/** Install raw-table mappings (PowerSync stays blind to your domain) */
export function installPairsOnSchema(base: Schema, pairs: EncryptedPairConfig[]) {
  const mappings: Record<string, any> = {};
  for (const p of pairs) {
    const shape = resolveTableShape(p.tableShape);
    mappings[p.encryptedTable] = {
      put: {
        sql: `
          INSERT INTO ${p.encryptedTable} (
            ${shape.id}, ${shape.userId}, ${shape.bucketId},
            ${shape.alg}, ${shape.aad}, ${shape.nonce}, ${shape.cipher}, ${shape.kdfSalt},
            ${shape.createdAt}, ${shape.updatedAt}
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(${shape.id}) DO UPDATE SET
            ${shape.userId}=excluded.${shape.userId},
            ${shape.bucketId}=excluded.${shape.bucketId},
            ${shape.alg}=excluded.${shape.alg},
            ${shape.aad}=excluded.${shape.aad},
            ${shape.nonce}=excluded.${shape.nonce},
            ${shape.cipher}=excluded.${shape.cipher},
            ${shape.kdfSalt}=excluded.${shape.kdfSalt},
            ${shape.createdAt}=excluded.${shape.createdAt},
            ${shape.updatedAt}=excluded.${shape.updatedAt}
        `.trim(),
        params: [
          "Id",
          { Column: shape.userId },
          { Column: shape.bucketId },
          { Column: shape.alg },
          { Column: shape.aad },
          { Column: shape.nonce },
          { Column: shape.cipher },
          { Column: shape.kdfSalt },
          { Column: shape.createdAt },
          { Column: shape.updatedAt }
        ]
      },
      delete: {
        sql: `DELETE FROM ${p.encryptedTable} WHERE ${shape.id} = ?`,
        params: ["Id"]
      }
    };
  }
  base.withRawTables(mappings);
  return base;
}

/** Create encrypted & mirror tables and upload triggers */
export async function ensurePairsDDL(db: AbstractPowerSyncDatabase, pairs: EncryptedPairConfig[]) {
  for (const p of pairs) {
    const enc = p.encryptedTable;
    const mir = p.mirrorTable;

    // Encrypted table (opaque)
    const shape = resolveTableShape(p.tableShape);
    const jsonNew = jsonObjectFields(shape, 'NEW');
    await db.execute(
      `
      CREATE TABLE IF NOT EXISTS ${enc} (
        ${shape.id} TEXT PRIMARY KEY,
        ${shape.userId} TEXT NOT NULL,
        ${shape.bucketId} TEXT,
        ${shape.alg} TEXT NOT NULL,
        ${shape.aad} TEXT,
        ${shape.nonce} TEXT NOT NULL,
        ${shape.cipher} TEXT NOT NULL,
        ${shape.kdfSalt} TEXT NOT NULL,
        ${shape.createdAt} TEXT NOT NULL,
        ${shape.updatedAt} TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${enc}_user_updated ON ${enc}(${shape.userId}, ${shape.updatedAt} DESC);
      `
    );

    // Mirror table with custom columns
    const customColsDDL = p.mirrorColumns.map(columnDDL).join(",\n        ");
    await db.execute(
      `
      CREATE TABLE IF NOT EXISTS ${mir} (
        ${shape.id} TEXT PRIMARY KEY,
        ${shape.userId} TEXT NOT NULL,
        ${shape.bucketId} TEXT,
        ${shape.updatedAt} TEXT NOT NULL,
        ${customColsDDL}
      );
      CREATE INDEX IF NOT EXISTS idx_${mir}_user_updated ON ${mir}(${shape.userId}, ${shape.updatedAt} DESC);
      `
    );
    if (p.mirrorExtraIndexes?.length) {
      for (const idx of p.mirrorExtraIndexes) {
        await db.execute(idx);
      }
    }

    // CRUD triggers to enqueue uploads
    await db.execute(
      `
      CREATE TRIGGER IF NOT EXISTS ${enc}_insert AFTER INSERT ON ${enc}
      BEGIN
        INSERT INTO powersync_crud (op, id, type, data)
        VALUES ('PUT', NEW.${shape.id}, '${enc}', json_object(
          ${jsonNew}
        ));
      END;

      CREATE TRIGGER IF NOT EXISTS ${enc}_update AFTER UPDATE ON ${enc}
      BEGIN
        INSERT INTO powersync_crud (op, id, type, data)
        VALUES ('PATCH', NEW.${shape.id}, '${enc}', json_object(
          ${jsonNew}
        ));
      END;

      CREATE TRIGGER IF NOT EXISTS ${enc}_delete AFTER DELETE ON ${enc}
      BEGIN
        INSERT INTO powersync_crud (op, id, type)
        VALUES ('DELETE', OLD.${shape.id}, '${enc}');
      END;

      CREATE TRIGGER IF NOT EXISTS ${enc}_mirror_cascade_delete
      AFTER DELETE ON ${enc}
      BEGIN
        DELETE FROM ${mir} WHERE ${shape.id} = OLD.${shape.id};
      END;
      `
    );
  }
}
