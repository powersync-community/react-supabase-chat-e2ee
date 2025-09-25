drop trigger if exists "set_updated_at_identity" on "public"."chat_identity_public_keys";

drop trigger if exists "chat_message_defaults" on "public"."chat_messages";

drop trigger if exists "chat_room_defaults" on "public"."chat_rooms";

drop trigger if exists "set_updated_at" on "public"."chat_rooms";

drop policy "Users can manage chat keys" on "public"."chat_e2ee_keys";

drop policy "Users manage own identity secrets" on "public"."chat_identity_private_keys";

drop policy "Authenticated can read identity keys" on "public"."chat_identity_public_keys";

drop policy "Users manage own identity keys" on "public"."chat_identity_public_keys";

drop policy "Members read room messages" on "public"."chat_messages";

drop policy "Members write room messages" on "public"."chat_messages";

drop policy "Users manage own room keys" on "public"."chat_room_keys";

drop policy "Users read own room keys" on "public"."chat_room_keys";

drop policy "Members view room membership" on "public"."chat_room_members";

drop policy "Users manage membership" on "public"."chat_room_members";

drop policy "Members can read rooms" on "public"."chat_rooms";

drop policy "Members can write rooms" on "public"."chat_rooms";

revoke delete on table "public"."chat_e2ee_keys" from "anon";

revoke insert on table "public"."chat_e2ee_keys" from "anon";

revoke references on table "public"."chat_e2ee_keys" from "anon";

revoke select on table "public"."chat_e2ee_keys" from "anon";

revoke trigger on table "public"."chat_e2ee_keys" from "anon";

revoke truncate on table "public"."chat_e2ee_keys" from "anon";

revoke update on table "public"."chat_e2ee_keys" from "anon";

revoke delete on table "public"."chat_e2ee_keys" from "authenticated";

revoke insert on table "public"."chat_e2ee_keys" from "authenticated";

revoke references on table "public"."chat_e2ee_keys" from "authenticated";

revoke select on table "public"."chat_e2ee_keys" from "authenticated";

revoke trigger on table "public"."chat_e2ee_keys" from "authenticated";

revoke truncate on table "public"."chat_e2ee_keys" from "authenticated";

revoke update on table "public"."chat_e2ee_keys" from "authenticated";

revoke delete on table "public"."chat_e2ee_keys" from "service_role";

revoke insert on table "public"."chat_e2ee_keys" from "service_role";

revoke references on table "public"."chat_e2ee_keys" from "service_role";

revoke select on table "public"."chat_e2ee_keys" from "service_role";

revoke trigger on table "public"."chat_e2ee_keys" from "service_role";

revoke truncate on table "public"."chat_e2ee_keys" from "service_role";

revoke update on table "public"."chat_e2ee_keys" from "service_role";

revoke delete on table "public"."chat_identity_private_keys" from "anon";

revoke insert on table "public"."chat_identity_private_keys" from "anon";

revoke references on table "public"."chat_identity_private_keys" from "anon";

revoke select on table "public"."chat_identity_private_keys" from "anon";

revoke trigger on table "public"."chat_identity_private_keys" from "anon";

revoke truncate on table "public"."chat_identity_private_keys" from "anon";

revoke update on table "public"."chat_identity_private_keys" from "anon";

revoke delete on table "public"."chat_identity_private_keys" from "authenticated";

revoke insert on table "public"."chat_identity_private_keys" from "authenticated";

revoke references on table "public"."chat_identity_private_keys" from "authenticated";

revoke select on table "public"."chat_identity_private_keys" from "authenticated";

revoke trigger on table "public"."chat_identity_private_keys" from "authenticated";

revoke truncate on table "public"."chat_identity_private_keys" from "authenticated";

revoke update on table "public"."chat_identity_private_keys" from "authenticated";

revoke delete on table "public"."chat_identity_private_keys" from "service_role";

revoke insert on table "public"."chat_identity_private_keys" from "service_role";

revoke references on table "public"."chat_identity_private_keys" from "service_role";

revoke select on table "public"."chat_identity_private_keys" from "service_role";

revoke trigger on table "public"."chat_identity_private_keys" from "service_role";

revoke truncate on table "public"."chat_identity_private_keys" from "service_role";

revoke update on table "public"."chat_identity_private_keys" from "service_role";

revoke delete on table "public"."chat_identity_public_keys" from "anon";

revoke insert on table "public"."chat_identity_public_keys" from "anon";

revoke references on table "public"."chat_identity_public_keys" from "anon";

revoke select on table "public"."chat_identity_public_keys" from "anon";

revoke trigger on table "public"."chat_identity_public_keys" from "anon";

revoke truncate on table "public"."chat_identity_public_keys" from "anon";

revoke update on table "public"."chat_identity_public_keys" from "anon";

revoke delete on table "public"."chat_identity_public_keys" from "authenticated";

revoke insert on table "public"."chat_identity_public_keys" from "authenticated";

revoke references on table "public"."chat_identity_public_keys" from "authenticated";

revoke select on table "public"."chat_identity_public_keys" from "authenticated";

revoke trigger on table "public"."chat_identity_public_keys" from "authenticated";

revoke truncate on table "public"."chat_identity_public_keys" from "authenticated";

revoke update on table "public"."chat_identity_public_keys" from "authenticated";

revoke delete on table "public"."chat_identity_public_keys" from "service_role";

revoke insert on table "public"."chat_identity_public_keys" from "service_role";

revoke references on table "public"."chat_identity_public_keys" from "service_role";

revoke select on table "public"."chat_identity_public_keys" from "service_role";

revoke trigger on table "public"."chat_identity_public_keys" from "service_role";

revoke truncate on table "public"."chat_identity_public_keys" from "service_role";

revoke update on table "public"."chat_identity_public_keys" from "service_role";

revoke delete on table "public"."chat_messages" from "anon";

revoke insert on table "public"."chat_messages" from "anon";

revoke references on table "public"."chat_messages" from "anon";

revoke select on table "public"."chat_messages" from "anon";

revoke trigger on table "public"."chat_messages" from "anon";

revoke truncate on table "public"."chat_messages" from "anon";

revoke update on table "public"."chat_messages" from "anon";

revoke delete on table "public"."chat_messages" from "authenticated";

revoke insert on table "public"."chat_messages" from "authenticated";

revoke references on table "public"."chat_messages" from "authenticated";

revoke select on table "public"."chat_messages" from "authenticated";

revoke trigger on table "public"."chat_messages" from "authenticated";

revoke truncate on table "public"."chat_messages" from "authenticated";

revoke update on table "public"."chat_messages" from "authenticated";

revoke delete on table "public"."chat_messages" from "service_role";

revoke insert on table "public"."chat_messages" from "service_role";

revoke references on table "public"."chat_messages" from "service_role";

revoke select on table "public"."chat_messages" from "service_role";

revoke trigger on table "public"."chat_messages" from "service_role";

revoke truncate on table "public"."chat_messages" from "service_role";

revoke update on table "public"."chat_messages" from "service_role";

revoke delete on table "public"."chat_room_keys" from "anon";

revoke insert on table "public"."chat_room_keys" from "anon";

revoke references on table "public"."chat_room_keys" from "anon";

revoke select on table "public"."chat_room_keys" from "anon";

revoke trigger on table "public"."chat_room_keys" from "anon";

revoke truncate on table "public"."chat_room_keys" from "anon";

revoke update on table "public"."chat_room_keys" from "anon";

revoke delete on table "public"."chat_room_keys" from "authenticated";

revoke insert on table "public"."chat_room_keys" from "authenticated";

revoke references on table "public"."chat_room_keys" from "authenticated";

revoke select on table "public"."chat_room_keys" from "authenticated";

revoke trigger on table "public"."chat_room_keys" from "authenticated";

revoke truncate on table "public"."chat_room_keys" from "authenticated";

revoke update on table "public"."chat_room_keys" from "authenticated";

revoke delete on table "public"."chat_room_keys" from "service_role";

revoke insert on table "public"."chat_room_keys" from "service_role";

revoke references on table "public"."chat_room_keys" from "service_role";

revoke select on table "public"."chat_room_keys" from "service_role";

revoke trigger on table "public"."chat_room_keys" from "service_role";

revoke truncate on table "public"."chat_room_keys" from "service_role";

revoke update on table "public"."chat_room_keys" from "service_role";

revoke delete on table "public"."chat_room_members" from "anon";

revoke insert on table "public"."chat_room_members" from "anon";

revoke references on table "public"."chat_room_members" from "anon";

revoke select on table "public"."chat_room_members" from "anon";

revoke trigger on table "public"."chat_room_members" from "anon";

revoke truncate on table "public"."chat_room_members" from "anon";

revoke update on table "public"."chat_room_members" from "anon";

revoke delete on table "public"."chat_room_members" from "authenticated";

revoke insert on table "public"."chat_room_members" from "authenticated";

revoke references on table "public"."chat_room_members" from "authenticated";

revoke select on table "public"."chat_room_members" from "authenticated";

revoke trigger on table "public"."chat_room_members" from "authenticated";

revoke truncate on table "public"."chat_room_members" from "authenticated";

revoke update on table "public"."chat_room_members" from "authenticated";

revoke delete on table "public"."chat_room_members" from "service_role";

revoke insert on table "public"."chat_room_members" from "service_role";

revoke references on table "public"."chat_room_members" from "service_role";

revoke select on table "public"."chat_room_members" from "service_role";

revoke trigger on table "public"."chat_room_members" from "service_role";

revoke truncate on table "public"."chat_room_members" from "service_role";

revoke update on table "public"."chat_room_members" from "service_role";

revoke delete on table "public"."chat_rooms" from "anon";

revoke insert on table "public"."chat_rooms" from "anon";

revoke references on table "public"."chat_rooms" from "anon";

revoke select on table "public"."chat_rooms" from "anon";

revoke trigger on table "public"."chat_rooms" from "anon";

revoke truncate on table "public"."chat_rooms" from "anon";

revoke update on table "public"."chat_rooms" from "anon";

revoke delete on table "public"."chat_rooms" from "authenticated";

revoke insert on table "public"."chat_rooms" from "authenticated";

revoke references on table "public"."chat_rooms" from "authenticated";

revoke select on table "public"."chat_rooms" from "authenticated";

revoke trigger on table "public"."chat_rooms" from "authenticated";

revoke truncate on table "public"."chat_rooms" from "authenticated";

revoke update on table "public"."chat_rooms" from "authenticated";

revoke delete on table "public"."chat_rooms" from "service_role";

revoke insert on table "public"."chat_rooms" from "service_role";

revoke references on table "public"."chat_rooms" from "service_role";

revoke select on table "public"."chat_rooms" from "service_role";

revoke trigger on table "public"."chat_rooms" from "service_role";

revoke truncate on table "public"."chat_rooms" from "service_role";

revoke update on table "public"."chat_rooms" from "service_role";

revoke delete on table "public"."e2ee_keys" from "anon";

revoke insert on table "public"."e2ee_keys" from "anon";

revoke references on table "public"."e2ee_keys" from "anon";

revoke select on table "public"."e2ee_keys" from "anon";

revoke trigger on table "public"."e2ee_keys" from "anon";

revoke truncate on table "public"."e2ee_keys" from "anon";

revoke update on table "public"."e2ee_keys" from "anon";

revoke delete on table "public"."e2ee_keys" from "authenticated";

revoke insert on table "public"."e2ee_keys" from "authenticated";

revoke references on table "public"."e2ee_keys" from "authenticated";

revoke select on table "public"."e2ee_keys" from "authenticated";

revoke trigger on table "public"."e2ee_keys" from "authenticated";

revoke truncate on table "public"."e2ee_keys" from "authenticated";

revoke update on table "public"."e2ee_keys" from "authenticated";

revoke delete on table "public"."e2ee_keys" from "service_role";

revoke insert on table "public"."e2ee_keys" from "service_role";

revoke references on table "public"."e2ee_keys" from "service_role";

revoke select on table "public"."e2ee_keys" from "service_role";

revoke trigger on table "public"."e2ee_keys" from "service_role";

revoke truncate on table "public"."e2ee_keys" from "service_role";

revoke update on table "public"."e2ee_keys" from "service_role";

revoke delete on table "public"."todos" from "anon";

revoke insert on table "public"."todos" from "anon";

revoke references on table "public"."todos" from "anon";

revoke select on table "public"."todos" from "anon";

revoke trigger on table "public"."todos" from "anon";

revoke truncate on table "public"."todos" from "anon";

revoke update on table "public"."todos" from "anon";

revoke delete on table "public"."todos" from "authenticated";

revoke insert on table "public"."todos" from "authenticated";

revoke references on table "public"."todos" from "authenticated";

revoke select on table "public"."todos" from "authenticated";

revoke trigger on table "public"."todos" from "authenticated";

revoke truncate on table "public"."todos" from "authenticated";

revoke update on table "public"."todos" from "authenticated";

revoke delete on table "public"."todos" from "service_role";

revoke insert on table "public"."todos" from "service_role";

revoke references on table "public"."todos" from "service_role";

revoke select on table "public"."todos" from "service_role";

revoke trigger on table "public"."todos" from "service_role";

revoke truncate on table "public"."todos" from "service_role";

revoke update on table "public"."todos" from "service_role";

alter table "public"."chat_e2ee_keys" drop constraint "chat_e2ee_keys_user_id_fkey";

alter table "public"."chat_identity_private_keys" drop constraint "chat_identity_private_keys_user_id_fkey";

alter table "public"."chat_identity_public_keys" drop constraint "chat_identity_public_keys_user_id_fkey";

alter table "public"."chat_messages" drop constraint "chat_messages_bucket_id_fkey";

alter table "public"."chat_messages" drop constraint "chat_messages_sender_id_fkey";

alter table "public"."chat_messages" drop constraint "chat_messages_user_id_fkey";

alter table "public"."chat_room_keys" drop constraint "chat_room_keys_room_id_fkey";

alter table "public"."chat_room_keys" drop constraint "chat_room_keys_user_id_fkey";

alter table "public"."chat_room_keys" drop constraint "chat_room_keys_wrapped_by_fkey";

alter table "public"."chat_room_members" drop constraint "chat_room_members_invited_by_fkey";

alter table "public"."chat_room_members" drop constraint "chat_room_members_room_id_fkey";

alter table "public"."chat_room_members" drop constraint "chat_room_members_user_id_fkey";

alter table "public"."chat_rooms" drop constraint "chat_rooms_user_id_fkey";

alter table "public"."chat_e2ee_keys" drop constraint "chat_e2ee_keys_pkey";

alter table "public"."chat_identity_private_keys" drop constraint "chat_identity_private_keys_pkey";

alter table "public"."chat_identity_public_keys" drop constraint "chat_identity_public_keys_pkey";

alter table "public"."chat_messages" drop constraint "chat_messages_pkey";

alter table "public"."chat_room_keys" drop constraint "chat_room_keys_pkey";

alter table "public"."chat_room_members" drop constraint "chat_room_members_pkey";

alter table "public"."chat_rooms" drop constraint "chat_rooms_pkey";

drop index if exists "public"."chat_e2ee_keys_pkey";

drop index if exists "public"."chat_identity_private_keys_pkey";

drop index if exists "public"."chat_identity_public_keys_pkey";

drop index if exists "public"."chat_messages_pkey";

drop index if exists "public"."chat_room_keys_pkey";

drop index if exists "public"."chat_room_members_pkey";

drop index if exists "public"."chat_rooms_pkey";

drop index if exists "public"."idx_chat_e2ee_keys_user";

drop index if exists "public"."idx_chat_e2ee_keys_user_provider";

drop index if exists "public"."idx_chat_identity_private_keys_user";

drop index if exists "public"."idx_chat_identity_public_keys_user";

drop index if exists "public"."idx_chat_identity_public_keys_user_version";

drop index if exists "public"."idx_chat_messages_room";

drop index if exists "public"."idx_chat_messages_sender";

drop index if exists "public"."idx_chat_messages_user";

drop index if exists "public"."idx_chat_room_keys_user";

drop index if exists "public"."idx_chat_room_keys_user_room";

drop index if exists "public"."idx_chat_room_members_room";

drop index if exists "public"."idx_chat_room_members_room_user";

drop index if exists "public"."idx_chat_room_members_user";

drop index if exists "public"."idx_chat_rooms_bucket";

drop index if exists "public"."idx_chat_rooms_user";

drop table "public"."chat_e2ee_keys";

drop table "public"."chat_identity_private_keys";

drop table "public"."chat_identity_public_keys";

drop table "public"."chat_messages";

drop table "public"."chat_room_keys";

drop table "public"."chat_room_members";

drop table "public"."chat_rooms";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.chat_message_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.chat_room_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.bucket_id is null then
    new.bucket_id := new.id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;



