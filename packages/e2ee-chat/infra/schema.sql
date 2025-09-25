-- Supabase schema for the PowerSync E2EE Chat demo.
-- End-to-end encrypted rooms, messages, and per-user key wraps.

-- Shared key vault specifically for chat; safe to run multiple times
create table if not exists public.chat_e2ee_keys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  alg text not null,
  aad text null,
  nonce_b64 text not null,
  cipher_b64 text not null,
  kdf_salt_b64 text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_e2ee_keys enable row level security;

drop policy if exists "Users can manage chat keys" on public.chat_e2ee_keys;
create policy "Users can manage chat keys"
  on public.chat_e2ee_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_chat_e2ee_keys_user on public.chat_e2ee_keys(user_id);
create index if not exists idx_chat_e2ee_keys_user_provider on public.chat_e2ee_keys(user_id, provider);

-- Public identity directory: exposes X25519 public keys so peers can encrypt room keys.
create table if not exists public.chat_identity_public_keys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key_version integer not null default 1,
  public_key_b64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_chat_identity_public_keys_user_version
  on public.chat_identity_public_keys(user_id, key_version);

alter table public.chat_identity_public_keys enable row level security;

drop policy if exists "Authenticated can read identity keys" on public.chat_identity_public_keys;
create policy "Authenticated can read identity keys"
  on public.chat_identity_public_keys for select
  using (auth.uid() is not null);

drop policy if exists "Users manage own identity keys" on public.chat_identity_public_keys;
create policy "Users manage own identity keys"
  on public.chat_identity_public_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_chat_identity_public_keys_user on public.chat_identity_public_keys(user_id);

-- Private identity secret encrypted with the user vault key.
create table if not exists public.chat_identity_private_keys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  alg text not null,
  aad text null,
  nonce_b64 text not null,
  cipher_b64 text not null,
  kdf_salt_b64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_identity_private_keys_user on public.chat_identity_private_keys(user_id);

alter table public.chat_identity_private_keys enable row level security;

drop policy if exists "Users manage own identity secrets" on public.chat_identity_private_keys;
create policy "Users manage own identity secrets"
  on public.chat_identity_private_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Encrypted chat rooms; ciphertext stays opaque to the backend.
create table if not exists public.chat_rooms (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text null,
  alg text not null,
  aad text null,
  nonce_b64 text not null,
  cipher_b64 text not null,
  kdf_salt_b64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_rooms_user on public.chat_rooms(user_id);
create index if not exists idx_chat_rooms_bucket on public.chat_rooms(bucket_id);

-- Plaintext membership table that drives access control and sync fan-out.
create table if not exists public.chat_room_members (
  id text primary key,
  room_id text not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now()
);

create unique index if not exists idx_chat_room_members_room_user on public.chat_room_members(room_id, user_id);
create index if not exists idx_chat_room_members_user on public.chat_room_members(user_id);
create index if not exists idx_chat_room_members_room on public.chat_room_members(room_id);

alter table public.chat_room_members enable row level security;

drop policy if exists "Members view room membership" on public.chat_room_members;
create policy "Members view room membership"
  on public.chat_room_members for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
        from public.chat_room_members m
       where m.room_id = chat_room_members.room_id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage membership" on public.chat_room_members;
create policy "Users manage membership"
  on public.chat_room_members for all
  using (auth.uid() = invited_by)
  with check (auth.uid() = invited_by);

alter table public.chat_rooms enable row level security;

drop policy if exists "Members can read rooms" on public.chat_rooms;
create policy "Members can read rooms"
  on public.chat_rooms for select
  using (
    exists (
      select 1
        from public.chat_room_members m
       where m.room_id = coalesce(chat_rooms.bucket_id, chat_rooms.id)
         and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members can write rooms" on public.chat_rooms;
create policy "Members can write rooms"
  on public.chat_rooms for all
  using (
    chat_rooms.user_id = auth.uid()
    or exists (
      select 1
        from public.chat_room_members m
       where m.room_id = coalesce(chat_rooms.bucket_id, chat_rooms.id)
         and m.user_id = auth.uid()
    )
  )
  with check (
    chat_rooms.user_id = auth.uid()
    or exists (
      select 1
        from public.chat_room_members m
       where m.room_id = coalesce(chat_rooms.bucket_id, chat_rooms.id)
         and m.user_id = auth.uid()
    )
  );

-- Encrypted per-member room key wraps: each user gets a copy of the room DEK encrypted to them.
create table if not exists public.chat_room_keys (
  id text primary key,
  room_id text not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wrapped_by uuid null references auth.users(id) on delete set null,
  alg text not null,
  aad text null,
  nonce_b64 text not null,
  cipher_b64 text not null,
  kdf_salt_b64 text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_chat_room_keys_user_room on public.chat_room_keys(room_id, user_id);
create index if not exists idx_chat_room_keys_user on public.chat_room_keys(user_id);

alter table public.chat_room_keys enable row level security;

drop policy if exists "Users read own room keys" on public.chat_room_keys;
create policy "Users read own room keys"
  on public.chat_room_keys for select
  using (auth.uid() = user_id);

drop policy if exists "Users manage own room keys" on public.chat_room_keys;
create policy "Users manage own room keys"
  on public.chat_room_keys for all
  using (auth.uid() = wrapped_by or auth.uid() = user_id)
  with check (auth.uid() = wrapped_by or auth.uid() = user_id);

-- Encrypted chat messages; sender_id is populated from user_id via trigger for metadata.
create table if not exists public.chat_messages (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  alg text not null,
  aad text null,
  nonce_b64 text not null,
  cipher_b64 text not null,
  kdf_salt_b64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_room on public.chat_messages(bucket_id, sent_at desc);
create index if not exists idx_chat_messages_sender on public.chat_messages(sender_id);
create index if not exists idx_chat_messages_user on public.chat_messages(user_id);

alter table public.chat_messages enable row level security;

drop policy if exists "Members read room messages" on public.chat_messages;
create policy "Members read room messages"
  on public.chat_messages for select
  using (
    exists (
      select 1
        from public.chat_room_members m
       where m.room_id = chat_messages.bucket_id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members write room messages" on public.chat_messages;
create policy "Members write room messages"
  on public.chat_messages for all
  using (
    exists (
      select 1
        from public.chat_room_members m
       where m.room_id = chat_messages.bucket_id
         and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.chat_room_members m
       where m.room_id = chat_messages.bucket_id
         and m.user_id = auth.uid()
    )
  );

-- Shared trigger to bump updated timestamps.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach triggers to tables that expose updated_at.
drop trigger if exists set_updated_at on public.chat_rooms;
create trigger set_updated_at
before update on public.chat_rooms
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_identity on public.chat_identity_public_keys;
create trigger set_updated_at_identity
before update on public.chat_identity_public_keys
for each row execute procedure public.set_updated_at();

-- Ensure chat_messages fields default to useful values even when inserted via generic raw-table helpers.
create or replace function public.chat_message_defaults()
returns trigger as $$
begin
  if new.bucket_id is null then
    raise exception 'bucket_id is required for chat message';
  end if;
  if new.sender_id is null then
    new.sender_id := new.user_id;
  end if;
  if new.sent_at is null then
    new.sent_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists chat_message_defaults on public.chat_messages;
create trigger chat_message_defaults
before insert on public.chat_messages
for each row execute procedure public.chat_message_defaults();

create or replace function public.chat_room_defaults()
returns trigger as $$
begin
  if new.bucket_id is null then
    new.bucket_id := new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists chat_room_defaults on public.chat_rooms;
create trigger chat_room_defaults
before insert on public.chat_rooms
for each row execute procedure public.chat_room_defaults();
