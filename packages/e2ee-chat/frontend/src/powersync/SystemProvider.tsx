import React, { useEffect, useMemo } from 'react';
import { PowerSyncContext } from '@powersync/react';
import {
  PowerSyncDatabase,
  BaseObserver,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  AbstractPowerSyncDatabase,
  Schema,
  Table,
  column,
  CrudEntry,
  UpdateType,
  SyncClientImplementation,
} from '@powersync/web';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ensurePairsDDL, installPairsOnSchema } from '@crypto/sqlite';
import { CHAT_PAIRS } from '../encrypted/chatPairs';
import { getAccessToken, getSupabase } from '../utils/supabase';

class TokenConnector extends BaseObserver<{}> implements PowerSyncBackendConnector {
  private client: SupabaseClient | null;
  constructor(private endpoint: string) {
    super();
    this.client = getSupabase();
  }

  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return { endpoint: this.endpoint, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    while (true) {
      const tx = await database.getNextCrudTransaction();
      if (!tx) break;
      let lastOp: CrudEntry | null = null;
      try {
        if (!this.client) {
          await tx.complete();
          continue;
        }
        for (const op of tx.crud) {
          lastOp = op;
          const table = this.client.from(op.table);
          let result: any = null;
          switch (op.op) {
            case UpdateType.PUT: {
              const record = { ...op.opData, id: op.id };
              result = await table.upsert(record);
              break;
            }
            case UpdateType.PATCH: {
              result = await table.update(op.opData).eq('id', op.id);
              break;
            }
            case UpdateType.DELETE: {
              result = await table.delete().eq('id', op.id);
              break;
            }
          }
          if (result?.error) {
            throw new Error(result.error.message || 'Supabase error');
          }
        }
        await tx.complete();
      } catch (err) {
        console.error('uploadData error', err, 'last op', lastOp);
        throw err;
      }
    }
  }
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const endpoint = import.meta.env.VITE_POWERSYNC_URL;
  const db = useMemo(() => {
    const chat_e2ee_keys = new Table({
      id: column.text,
      user_id: column.text,
      provider: column.text,
      alg: column.text,
      aad: column.text,
      nonce_b64: column.text,
      cipher_b64: column.text,
      kdf_salt_b64: column.text,
      created_at: column.text,
    });

    const chat_identity_private_keys = new Table({
      id: column.text,
      user_id: column.text,
      alg: column.text,
      aad: column.text,
      nonce_b64: column.text,
      cipher_b64: column.text,
      kdf_salt_b64: column.text,
      created_at: column.text,
    });

    const chat_identity_public_keys = new Table({
      id: column.text,
      user_id: column.text,
      key_version: column.text,
      public_key_b64: column.text,
      created_at: column.text,
      updated_at: column.text,
    });

    const chat_room_members = new Table({
      id: column.text,
      room_id: column.text,
      user_id: column.text,
      invited_by: column.text,
      role: column.text,
      joined_at: column.text,
    });

    const chat_room_keys = new Table({
      id: column.text,
      room_id: column.text,
      user_id: column.text,
      wrapped_by: column.text,
      alg: column.text,
      aad: column.text,
      nonce_b64: column.text,
      cipher_b64: column.text,
      kdf_salt_b64: column.text,
      created_at: column.text,
    });

    const baseSchema = new Schema({
      chat_e2ee_keys,
      chat_identity_private_keys,
      chat_identity_public_keys,
      chat_room_members,
      chat_room_keys,
    });

    const schema = installPairsOnSchema(baseSchema, CHAT_PAIRS);

    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__powersyncRawTables = schema.rawTables.map((table) => table.name);
    }

    return new PowerSyncDatabase({
      database: { dbFilename: 'powersync-chat-e2ee.db' },
      schema,
      flags: { disableSSRWarning: true },
    });
  }, []);

  useEffect(() => {
    if (!endpoint) return;
    const connector = new TokenConnector(endpoint);
    let cancelled = false;
    (async () => {
      try {
        await db.init();
        if (cancelled) return;
        await ensurePairsDDL(db, CHAT_PAIRS);
        if (cancelled) return;
        await db.connect(connector, { clientImplementation: SyncClientImplementation.RUST });
        if (cancelled) return;
        await db.waitForReady();
      } catch (err: any) {
        const msg = err?.message ?? String(err ?? '');
        if (msg.includes('powersync_replace_schema') || msg.includes('powersync_drop_view')) {
          console.warn('PowerSync schema mismatch. Clearing local DB and retrying.');
          try {
            await db.disconnectAndClear({ clearLocal: true });
          } catch (clearErr) {
            console.error('Failed to clear PowerSync DB', clearErr);
          }
          if (cancelled) return;
          try {
            await db.init();
            if (cancelled) return;
            await ensurePairsDDL(db, CHAT_PAIRS);
            if (cancelled) return;
            await db.connect(connector, { clientImplementation: SyncClientImplementation.RUST });
            if (cancelled) return;
            await db.waitForReady();
          } catch (retryErr) {
            console.error('PowerSync init/connect failed after reset', retryErr);
          }
        } else {
          console.error('PowerSync init/connect failed', err);
        }
      }
    })();
    return () => {
      cancelled = true;
      db.disconnect().catch((disconnectErr) => console.warn('PowerSync disconnect error', disconnectErr));
    };
  }, [db, endpoint]);

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}

export default SystemProvider;
