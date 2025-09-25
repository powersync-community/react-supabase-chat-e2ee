create table "public"."e2ee_keys" (
    "id" text not null,
    "user_id" uuid not null,
    "provider" text not null,
    "alg" text not null,
    "aad" text,
    "nonce_b64" text not null,
    "cipher_b64" text not null,
    "kdf_salt_b64" text not null,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."e2ee_keys" enable row level security;

create table "public"."todos" (
    "id" text not null,
    "user_id" uuid not null,
    "bucket_id" text,
    "alg" text not null,
    "aad" text,
    "nonce_b64" text not null,
    "cipher_b64" text not null,
    "kdf_salt_b64" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."todos" enable row level security;

CREATE UNIQUE INDEX e2ee_keys_pkey ON public.e2ee_keys USING btree (id);

CREATE INDEX idx_e2ee_keys_user ON public.e2ee_keys USING btree (user_id);

CREATE INDEX idx_e2ee_keys_user_provider ON public.e2ee_keys USING btree (user_id, provider);

CREATE INDEX idx_todos_user_created_at ON public.todos USING btree (user_id, created_at DESC);

CREATE INDEX idx_todos_user_id ON public.todos USING btree (user_id);

CREATE UNIQUE INDEX todos_pkey ON public.todos USING btree (id);

alter table "public"."e2ee_keys" add constraint "e2ee_keys_pkey" PRIMARY KEY using index "e2ee_keys_pkey";

alter table "public"."todos" add constraint "todos_pkey" PRIMARY KEY using index "todos_pkey";

alter table "public"."e2ee_keys" add constraint "e2ee_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."e2ee_keys" validate constraint "e2ee_keys_user_id_fkey";

alter table "public"."todos" add constraint "todos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."todos" validate constraint "todos_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end; $function$
;

create policy "Users can manage own keys"
on "public"."e2ee_keys"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can delete own todos"
on "public"."todos"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert own todos"
on "public"."todos"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update own todos"
on "public"."todos"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view own todos"
on "public"."todos"
as permissive
for select
to public
using ((auth.uid() = user_id));


CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION set_updated_at();



