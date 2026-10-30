-- ROOMS M5.60 - ENSAYO QA REVERSIBLE
-- NO ES UNA MIGRACION PARA PRODUCCION.
-- Mantiene cerrado el registro beta.
-- Ejecutar exclusivamente contra rooms-beta-qa.
-- Toda la instalacion se revierte mediante ROLLBACK.
-- Requiere revision antes de cualquier instalacion permanente.


\set ON_ERROR_STOP on
BEGIN;

DO $rooms_qa_guard$
BEGIN
  IF current_database() <> 'postgres'
     OR session_user NOT IN (
       'postgres',
       'postgres.gpfmocptevpyzrwsubkj'
     )
  THEN
    RAISE EXCEPTION
      'STOP: instalador exclusivo de ROOMS QA';
  END IF;
END;
$rooms_qa_guard$;

SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $qa$
BEGIN
  IF current_database() <> 'postgres'
     OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: contexto PostgreSQL inesperado';
  END IF;
END;
$qa$;

\echo === 1/41 20260901_initial_schema.sql ===
-- ROOMS · baseline histórico recuperado del Supabase remoto
-- Generado a partir del inventario estructural auditado el 2026-10-07.
-- Debe ejecutarse antes de las migraciones fechadas 20260924+ en un proyecto nuevo.
-- No contiene datos de usuarios.

create extension if not exists pgcrypto;

create table if not exists public.communities (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  name text not null,
  description text,
  image_url text,
  visibility text default 'public'::text not null,
  status text default 'active'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.community_members (
  community_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null,
  status text default 'active'::text not null,
  joined_at timestamptz default now()
);

create table if not exists public.connections (
  id uuid default gen_random_uuid() not null,
  requester_id uuid not null,
  recipient_id uuid not null,
  status text default 'pending'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.conversation_preferences (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  other_user_id uuid not null,
  muted boolean default false not null,
  deleted_before timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.household_candidate_votes (
  id uuid default gen_random_uuid() not null,
  household_id uuid not null,
  candidate_type text not null,
  candidate_id uuid not null,
  user_id uuid not null,
  vote text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.household_candidates (
  household_id uuid not null,
  listing_id uuid not null,
  added_by uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists public.household_invitations (
  id uuid default gen_random_uuid() not null,
  household_id uuid not null,
  invited_by uuid not null,
  token uuid default gen_random_uuid() not null,
  status text default 'pending'::text not null,
  expires_at timestamptz default (now() + '7 days'::interval) not null,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

create table if not exists public.household_members (
  household_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null,
  status text default 'accepted'::text not null,
  joined_at timestamptz default now() not null
);

create table if not exists public.household_person_candidates (
  household_id uuid not null,
  user_id uuid not null,
  added_by uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists public.households (
  id uuid default gen_random_uuid() not null,
  name text not null,
  owner_id uuid not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.listing_private_locations (
  listing_id uuid not null,
  owner_id uuid not null,
  exact_address text not null,
  exact_latitude double precision not null,
  exact_longitude double precision not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.listings (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  kind text not null,
  title text not null,
  zone text not null,
  price integer not null,
  available_from date,
  duration text,
  rooms integer,
  baths integer,
  area integer,
  furnished boolean,
  features text[] default '{}'::text[],
  photos text[] default '{}'::text[],
  description text,
  source_url text,
  status text default 'published'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  latitude double precision,
  longitude double precision,
  location_precision text default 'approximate'::text
);

create table if not exists public.match_preferences (
  user_id uuid not null,
  version integer default 1 not null,
  living_self jsonb default '{}'::jsonb not null,
  living_importance jsonb default '{}'::jsonb not null,
  dealbreakers jsonb default '{}'::jsonb not null,
  home_preferences jsonb default '{}'::jsonb not null,
  neighborhood_preferences jsonb default '{}'::jsonb not null,
  interests text[] default '{}'::text[] not null,
  traits text[] default '{}'::text[] not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.messages (
  id bigint generated always as identity not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

create table if not exists public.onboarding_preferences (
  user_id uuid not null,
  answers jsonb default '{}'::jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.post_comments (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  author_id uuid not null,
  body text not null,
  status text default 'published'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.post_likes (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid default gen_random_uuid() not null,
  author_id uuid not null,
  post_type text default 'question'::text not null,
  body text not null,
  zone text,
  listing_id uuid,
  status text default 'published'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  community_id uuid,
  media_urls text[] default '{}'::text[],
  expires_at date
);

create table if not exists public.profiles (
  id uuid not null,
  name text,
  alias text,
  avatar_url text,
  bio text,
  age integer,
  seeking text[] default '{}'::text[],
  zones text[] default '{}'::text[],
  budget_min integer,
  budget_max integer,
  move_in_date date,
  duration text,
  interests text[] default '{}'::text[],
  traits text[] default '{}'::text[],
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid default gen_random_uuid() not null,
  reporter_id uuid not null,
  reported_user_id uuid,
  target_type text default 'user'::text not null,
  target_id text,
  reason text not null,
  details text,
  status text default 'pending'::text not null,
  created_at timestamptz default now() not null
);

create table if not exists public.rooms_dna (
  user_id uuid not null,
  model_version integer not null,
  answers jsonb default '{}'::jsonb not null,
  dimensions jsonb default '{}'::jsonb not null,
  categories jsonb default '{}'::jsonb not null,
  classification jsonb default '{}'::jsonb not null,
  evidence jsonb default '[]'::jsonb not null,
  calculated_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.saved_collection_items (
  collection_id uuid not null,
  saved_item_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists public.saved_collections (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  visibility text default 'private'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.saved_items (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  item_type text not null,
  item_id text not null,
  created_at timestamptz default now()
);

create table if not exists public.user_blocks (
  id uuid default gen_random_uuid() not null,
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists public.user_intents (
  user_id uuid not null,
  intent text not null,
  created_at timestamptz default now() not null
);

create table if not exists public.user_roles (
  user_id uuid not null,
  role text default 'member'::text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);


-- QA: claves primarias y unicas antes de FK
alter table public.communities
  add constraint communities_pkey PRIMARY KEY (id);
alter table public.community_members
  add constraint community_members_pkey PRIMARY KEY (community_id, user_id);
alter table public.connections
  add constraint connections_pkey PRIMARY KEY (id);
alter table public.conversation_preferences
  add constraint conversation_preferences_pkey PRIMARY KEY (id);
alter table public.conversation_preferences
  add constraint conversation_preferences_unique_pair UNIQUE (user_id, other_user_id);
alter table public.household_candidate_votes
  add constraint household_candidate_votes_household_id_candidate_type_candi_key UNIQUE (household_id, candidate_type, candidate_id, user_id);
alter table public.household_candidate_votes
  add constraint household_candidate_votes_pkey PRIMARY KEY (id);
alter table public.household_candidates
  add constraint household_candidates_pkey PRIMARY KEY (household_id, listing_id);
alter table public.household_invitations
  add constraint household_invitations_pkey PRIMARY KEY (id);
alter table public.household_invitations
  add constraint household_invitations_token_key UNIQUE (token);
alter table public.household_members
  add constraint household_members_pkey PRIMARY KEY (household_id, user_id);
alter table public.household_person_candidates
  add constraint household_person_candidates_pkey PRIMARY KEY (household_id, user_id);
alter table public.households
  add constraint households_pkey PRIMARY KEY (id);
alter table public.listing_private_locations
  add constraint listing_private_locations_pkey PRIMARY KEY (listing_id);
alter table public.listings
  add constraint listings_pkey PRIMARY KEY (id);
alter table public.match_preferences
  add constraint match_preferences_pkey PRIMARY KEY (user_id);
alter table public.messages
  add constraint messages_pkey PRIMARY KEY (id);
alter table public.onboarding_preferences
  add constraint onboarding_preferences_pkey PRIMARY KEY (user_id);
alter table public.post_comments
  add constraint post_comments_pkey PRIMARY KEY (id);
alter table public.post_likes
  add constraint post_likes_pkey PRIMARY KEY (post_id, user_id);
alter table public.posts
  add constraint posts_pkey PRIMARY KEY (id);
alter table public.profiles
  add constraint profiles_pkey PRIMARY KEY (id);
alter table public.reports
  add constraint reports_pkey PRIMARY KEY (id);
alter table public.rooms_dna
  add constraint rooms_dna_pkey PRIMARY KEY (user_id);
alter table public.saved_collection_items
  add constraint saved_collection_items_pkey PRIMARY KEY (collection_id, saved_item_id);
alter table public.saved_collections
  add constraint saved_collections_pkey PRIMARY KEY (id);
alter table public.saved_items
  add constraint saved_items_pkey PRIMARY KEY (id);
alter table public.saved_items
  add constraint saved_items_user_id_item_type_item_id_key UNIQUE (user_id, item_type, item_id);
alter table public.user_blocks
  add constraint user_blocks_pkey PRIMARY KEY (id);
alter table public.user_blocks
  add constraint user_blocks_unique UNIQUE (blocker_id, blocked_id);
alter table public.user_intents
  add constraint user_intents_pkey PRIMARY KEY (user_id, intent);
alter table public.user_roles
  add constraint user_roles_pkey PRIMARY KEY (user_id);
alter table public.communities
  add constraint communities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.communities
  add constraint communities_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));

alter table public.communities
  add constraint communities_visibility_check CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text]));

alter table public.community_members
  add constraint community_members_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;



alter table public.community_members
  add constraint community_members_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]));

alter table public.community_members
  add constraint community_members_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text]));

alter table public.community_members
  add constraint community_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.connections
  add constraint connections_check CHECK (requester_id <> recipient_id);



alter table public.connections
  add constraint connections_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.connections
  add constraint connections_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.connections
  add constraint connections_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]));

alter table public.conversation_preferences
  add constraint conversation_preferences_not_self CHECK (user_id <> other_user_id);

alter table public.conversation_preferences
  add constraint conversation_preferences_other_user_id_fkey FOREIGN KEY (other_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;





alter table public.conversation_preferences
  add constraint conversation_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_candidate_votes
  add constraint household_candidate_votes_candidate_type_check CHECK (candidate_type = ANY (ARRAY['listing'::text, 'person'::text]));



alter table public.household_candidate_votes
  add constraint household_candidate_votes_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;



alter table public.household_candidate_votes
  add constraint household_candidate_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_candidate_votes
  add constraint household_candidate_votes_vote_check CHECK (vote = ANY (ARRAY['like'::text, 'maybe'::text, 'dislike'::text]));

alter table public.household_candidates
  add constraint household_candidates_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_candidates
  add constraint household_candidates_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

alter table public.household_candidates
  add constraint household_candidates_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;



alter table public.household_invitations
  add constraint household_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.household_invitations
  add constraint household_invitations_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

alter table public.household_invitations
  add constraint household_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.household_invitations
  add constraint household_invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text, 'expired'::text]));



alter table public.household_members
  add constraint household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;



alter table public.household_members
  add constraint household_members_role_check CHECK (role = ANY (ARRAY['owner'::text, 'member'::text]));

alter table public.household_members
  add constraint household_members_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]));

alter table public.household_members
  add constraint household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_person_candidates
  add constraint household_person_candidates_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_person_candidates
  add constraint household_person_candidates_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;



alter table public.household_person_candidates
  add constraint household_person_candidates_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.households
  add constraint households_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.listing_private_locations
  add constraint listing_private_latitude_check CHECK (exact_latitude >= '-90'::integer::double precision AND exact_latitude <= 90::double precision);

alter table public.listing_private_locations
  add constraint listing_private_locations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;

alter table public.listing_private_locations
  add constraint listing_private_locations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;



alter table public.listing_private_locations
  add constraint listing_private_longitude_check CHECK (exact_longitude >= '-180'::integer::double precision AND exact_longitude <= 180::double precision);

alter table public.listings
  add constraint listings_kind_check CHECK (kind = ANY (ARRAY['room'::text, 'apartment'::text, 'external'::text]));

alter table public.listings
  add constraint listings_latitude_check CHECK (latitude IS NULL OR latitude >= '-90'::integer::double precision AND latitude <= 90::double precision);

alter table public.listings
  add constraint listings_location_precision_check CHECK (location_precision = ANY (ARRAY['approximate'::text, 'exact'::text]));

alter table public.listings
  add constraint listings_longitude_check CHECK (longitude IS NULL OR longitude >= '-180'::integer::double precision AND longitude <= 180::double precision);

alter table public.listings
  add constraint listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.listings
  add constraint listings_price_check CHECK (price > 0);

alter table public.listings
  add constraint listings_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));



alter table public.match_preferences
  add constraint match_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.messages
  add constraint messages_body_check CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 2000);

alter table public.messages
  add constraint messages_check CHECK (sender_id <> recipient_id);



alter table public.messages
  add constraint messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.messages
  add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.onboarding_preferences
  add constraint onboarding_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.post_comments
  add constraint post_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.post_comments
  add constraint post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

alter table public.post_comments
  add constraint post_comments_status_check CHECK (status = ANY (ARRAY['published'::text, 'deleted'::text]));



alter table public.post_likes
  add constraint post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

alter table public.post_likes
  add constraint post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.posts
  add constraint posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.posts
  add constraint posts_body_check CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 2000);

alter table public.posts
  add constraint posts_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table public.posts
  add constraint posts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;



alter table public.posts
  add constraint posts_post_type_check CHECK (post_type = ANY (ARRAY['question'::text, 'recommendation'::text, 'neighborhood'::text, 'warning'::text, 'experience'::text, 'housing'::text]));

alter table public.posts
  add constraint posts_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

alter table public.profiles
  add constraint profiles_age_check CHECK (age IS NULL OR age >= 18);

alter table public.profiles
  add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;





alter table public.reports
  add constraint reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.reports
  add constraint reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.reports
  add constraint reports_status_check CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text]));

alter table public.reports
  add constraint reports_target_type_check CHECK (target_type = ANY (ARRAY['user'::text, 'profile'::text, 'listing'::text, 'post'::text, 'community'::text, 'message'::text]));

alter table public.rooms_dna
  add constraint rooms_dna_answers_object CHECK (jsonb_typeof(answers) = 'object'::text);

alter table public.rooms_dna
  add constraint rooms_dna_categories_object CHECK (jsonb_typeof(categories) = 'object'::text);

alter table public.rooms_dna
  add constraint rooms_dna_classification_object CHECK (jsonb_typeof(classification) = 'object'::text);

alter table public.rooms_dna
  add constraint rooms_dna_dimensions_object CHECK (jsonb_typeof(dimensions) = 'object'::text);

alter table public.rooms_dna
  add constraint rooms_dna_evidence_array CHECK (jsonb_typeof(evidence) = 'array'::text);

alter table public.rooms_dna
  add constraint rooms_dna_model_version_positive CHECK (model_version > 0);



alter table public.rooms_dna
  add constraint rooms_dna_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.saved_collection_items
  add constraint saved_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES saved_collections(id) ON DELETE CASCADE;



alter table public.saved_collection_items
  add constraint saved_collection_items_saved_item_id_fkey FOREIGN KEY (saved_item_id) REFERENCES saved_items(id) ON DELETE CASCADE;



alter table public.saved_collections
  add constraint saved_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.saved_collections
  add constraint saved_collections_visibility_check CHECK (visibility = ANY (ARRAY['private'::text, 'shared'::text]));

alter table public.saved_items
  add constraint saved_items_item_type_check CHECK (item_type = ANY (ARRAY['room'::text, 'apartment'::text, 'person'::text, 'community'::text, 'post'::text]));



alter table public.saved_items
  add constraint saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.user_blocks
  add constraint user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_blocks
  add constraint user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_blocks
  add constraint user_blocks_not_self CHECK (blocker_id <> blocked_id);





alter table public.user_intents
  add constraint user_intents_intent_check CHECK (intent = ANY (ARRAY['find_apartment'::text, 'find_room'::text, 'find_mates_for_home'::text, 'find_mates_to_search'::text, 'offer_apartment'::text, 'offer_room'::text]));



alter table public.user_intents
  add constraint user_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



alter table public.user_roles
  add constraint user_roles_role_check CHECK (role = ANY (ARRAY['member'::text, 'admin'::text, 'professional'::text]));

alter table public.user_roles
  add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX connections_unique_pair ON public.connections USING btree (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
CREATE INDEX listings_status_created_idx ON public.listings USING btree (status, created_at DESC);
CREATE INDEX listings_zone_price_idx ON public.listings USING btree (zone, price);
CREATE INDEX messages_users_created_idx ON public.messages USING btree (sender_id, recipient_id, created_at DESC);
CREATE INDEX post_comments_post_created_at_idx ON public.post_comments USING btree (post_id, created_at);
CREATE INDEX post_comments_post_id_idx ON public.post_comments USING btree (post_id);
CREATE INDEX post_likes_post_id_idx ON public.post_likes USING btree (post_id);
CREATE INDEX posts_community_created_at_idx ON public.posts USING btree (community_id, created_at DESC);
CREATE INDEX posts_community_id_idx ON public.posts USING btree (community_id);
CREATE INDEX posts_expires_at_idx ON public.posts USING btree (expires_at);
CREATE INDEX posts_status_created_idx ON public.posts USING btree (status, created_at DESC);
CREATE INDEX posts_type_idx ON public.posts USING btree (post_type);
CREATE INDEX reports_reported_user_id_idx ON public.reports USING btree (reported_user_id);
CREATE INDEX reports_reporter_id_idx ON public.reports USING btree (reporter_id);
CREATE INDEX reports_status_idx ON public.reports USING btree (status);
CREATE INDEX user_blocks_blocked_id_idx ON public.user_blocks USING btree (blocked_id);
CREATE INDEX user_blocks_blocker_id_idx ON public.user_blocks USING btree (blocker_id);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.connections enable row level security;
alter table public.conversation_preferences enable row level security;
alter table public.household_candidate_votes enable row level security;
alter table public.household_candidates enable row level security;
alter table public.household_invitations enable row level security;
alter table public.household_members enable row level security;
alter table public.household_person_candidates enable row level security;
alter table public.households enable row level security;
alter table public.listing_private_locations enable row level security;
alter table public.listings enable row level security;
alter table public.match_preferences enable row level security;
alter table public.messages enable row level security;
alter table public.onboarding_preferences enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.rooms_dna enable row level security;
alter table public.saved_collection_items enable row level security;
alter table public.saved_collections enable row level security;
alter table public.saved_items enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_intents enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.touch_match_preferences_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.users_are_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$function$;

create or replace function public.is_household_member(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.household_members
    where household_id = _household_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$function$;

create or replace function public.is_household_owner(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.households
    where id = _household_id
      and owner_id = auth.uid()
  );
$function$;

create or replace function public.can_access_community(
  target_community_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.communities c
    where c.id = target_community_id
      and (
        (c.status = 'active' and c.visibility = 'public')
        or c.owner_id = target_user_id
        or exists (
          select 1 from public.community_members cm
          where cm.community_id = c.id
            and cm.user_id = target_user_id
            and cm.status = 'active'
        )
      )
  );
$function$;

create or replace function public.is_public_active_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.communities
    where id = target_community_id
      and visibility = 'public'
      and status = 'active'
  );
$function$;

create or replace function public.can_participate_community(
  target_community_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.communities c
    where c.id = target_community_id
      and (
        c.owner_id = target_user_id
        or exists (
          select 1 from public.community_members cm
          where cm.community_id = c.id
            and cm.user_id = target_user_id
            and cm.status = 'active'
        )
      )
  );
$function$;

create or replace function public.can_interact_with_post(
  target_post_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.posts p
    where p.id = target_post_id
      and p.status = 'published'
      and (
        p.author_id = target_user_id
        or (
          not public.users_are_blocked(target_user_id, p.author_id)
          and (
            p.community_id is null
            or public.can_access_community(p.community_id, target_user_id)
          )
        )
      )
  );
$function$;

create or replace function public.add_community_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.community_members (community_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  return new;
end;
$function$;

create or replace function public.validate_household_candidate_vote()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.candidate_type = 'listing' then
    if not exists (
      select 1 from public.household_candidates hc
      where hc.household_id = new.household_id
        and hc.listing_id = new.candidate_id
    ) then
      raise exception 'Listing candidate does not exist in this household';
    end if;
  elsif new.candidate_type = 'person' then
    if not exists (
      select 1 from public.household_person_candidates hpc
      where hpc.household_id = new.household_id
        and hpc.user_id = new.candidate_id
    ) then
      raise exception 'Person candidate does not exist in this household';
    end if;
  else
    raise exception 'Invalid candidate type';
  end if;
  return new;
end;
$function$;

revoke all on function public.users_are_blocked(uuid, uuid) from public;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;
revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_owner(uuid) to authenticated;
revoke all on function public.can_access_community(uuid, uuid) from public;
grant execute on function public.can_access_community(uuid, uuid) to authenticated;
revoke all on function public.is_public_active_community(uuid) from public;
grant execute on function public.is_public_active_community(uuid) to authenticated;
revoke all on function public.can_participate_community(uuid, uuid) from public;
grant execute on function public.can_participate_community(uuid, uuid) to authenticated;
revoke all on function public.can_interact_with_post(uuid, uuid) from public;
grant execute on function public.can_interact_with_post(uuid, uuid) to authenticated;
revoke all on function public.add_community_owner() from public;
revoke all on function public.validate_household_candidate_vote() from public;

drop policy if exists "Crear comunidades" on public.communities;
create policy "Crear comunidades" on public.communities
for insert
to authenticated
with check ((owner_id = auth.uid()))
;

drop policy if exists "Editar comunidades propias" on public.communities;
create policy "Editar comunidades propias" on public.communities
for update
to authenticated
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()))
;

drop policy if exists "Eliminar comunidades propias" on public.communities;
create policy "Eliminar comunidades propias" on public.communities
for delete
to authenticated
using ((owner_id = auth.uid()))
;

drop policy if exists "Ver comunidades accesibles" on public.communities;
create policy "Ver comunidades accesibles" on public.communities
for select
to authenticated
using (can_access_community(id, auth.uid()))
;

drop policy if exists "communities_delete_own" on public.communities;
create policy "communities_delete_own" on public.communities
for delete
to authenticated
using ((owner_id = auth.uid()))
;

drop policy if exists "communities_insert_own" on public.communities;
create policy "communities_insert_own" on public.communities
for insert
to authenticated
with check ((owner_id = auth.uid()))
;

drop policy if exists "communities_update_own" on public.communities;
create policy "communities_update_own" on public.communities
for update
to authenticated
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()))
;

drop policy if exists "Salir de comunidades" on public.community_members;
create policy "Salir de comunidades" on public.community_members
for delete
to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM communities
  WHERE ((communities.id = community_members.community_id) AND (communities.owner_id = auth.uid()))))))
;

drop policy if exists "Unirse a comunidades públicas" on public.community_members;
create policy "Unirse a comunidades públicas" on public.community_members
for insert
to authenticated
with check (((user_id = auth.uid()) AND (role = 'member'::text) AND (status = 'active'::text) AND is_public_active_community(community_id)))
;

drop policy if exists "Ver miembros de comunidades accesibles" on public.community_members;
create policy "Ver miembros de comunidades accesibles" on public.community_members
for select
to authenticated
using (((user_id = auth.uid()) OR ((NOT users_are_blocked(auth.uid(), user_id)) AND can_access_community(community_id, auth.uid()))))
;

drop policy if exists "El destinatario responde la conexión" on public.connections;
create policy "El destinatario responde la conexión" on public.connections
for update
to authenticated
using (((auth.uid() = recipient_id) AND (NOT users_are_blocked(requester_id, recipient_id))))
with check (((auth.uid() = recipient_id) AND (NOT users_are_blocked(requester_id, recipient_id))))
;

drop policy if exists "Los participantes eliminan una conexión" on public.connections;
create policy "Los participantes eliminan una conexión" on public.connections
for delete
to authenticated
using (((auth.uid() = requester_id) OR (auth.uid() = recipient_id)))
;

drop policy if exists "Los participantes ven sus conexiones" on public.connections;
create policy "Los participantes ven sus conexiones" on public.connections
for select
to authenticated
using ((((auth.uid() = requester_id) OR (auth.uid() = recipient_id)) AND (NOT users_are_blocked(requester_id, recipient_id))))
;

drop policy if exists "Un usuario envía una conexión" on public.connections;
create policy "Un usuario envía una conexión" on public.connections
for insert
to authenticated
with check (((auth.uid() = requester_id) AND (requester_id <> recipient_id) AND (NOT users_are_blocked(requester_id, recipient_id))))
;

drop policy if exists "Usuarios actualizan preferencias propias" on public.conversation_preferences;
create policy "Usuarios actualizan preferencias propias" on public.conversation_preferences
for update
to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()))
;

drop policy if exists "Usuarios crean preferencias propias" on public.conversation_preferences;
create policy "Usuarios crean preferencias propias" on public.conversation_preferences
for insert
to authenticated
with check (((user_id = auth.uid()) AND (other_user_id <> auth.uid())))
;

drop policy if exists "Usuarios eliminan preferencias propias" on public.conversation_preferences;
create policy "Usuarios eliminan preferencias propias" on public.conversation_preferences
for delete
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "Usuarios ven preferencias propias" on public.conversation_preferences;
create policy "Usuarios ven preferencias propias" on public.conversation_preferences
for select
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "Miembros actualizan sus votos" on public.household_candidate_votes;
create policy "Miembros actualizan sus votos" on public.household_candidate_votes
for update
to authenticated
using (((user_id = auth.uid()) AND (is_household_member(household_id) OR is_household_owner(household_id))))
with check (((user_id = auth.uid()) AND (is_household_member(household_id) OR is_household_owner(household_id))))
;

drop policy if exists "Miembros crean sus votos" on public.household_candidate_votes;
create policy "Miembros crean sus votos" on public.household_candidate_votes
for insert
to authenticated
with check (((user_id = auth.uid()) AND (is_household_member(household_id) OR is_household_owner(household_id))))
;

drop policy if exists "Miembros eliminan sus votos" on public.household_candidate_votes;
create policy "Miembros eliminan sus votos" on public.household_candidate_votes
for delete
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "Miembros ven votos" on public.household_candidate_votes;
create policy "Miembros ven votos" on public.household_candidate_votes
for select
to authenticated
using ((is_household_member(household_id) OR is_household_owner(household_id)))
;

drop policy if exists "Miembros añaden candidatos" on public.household_candidates;
create policy "Miembros añaden candidatos" on public.household_candidates
for insert
to authenticated
with check (((added_by = auth.uid()) AND (is_household_member(household_id) OR is_household_owner(household_id))))
;

drop policy if exists "Miembros eliminan candidatos" on public.household_candidates;
create policy "Miembros eliminan candidatos" on public.household_candidates
for delete
to authenticated
using ((is_household_member(household_id) OR is_household_owner(household_id)))
;

drop policy if exists "Miembros ven candidatos" on public.household_candidates;
create policy "Miembros ven candidatos" on public.household_candidates
for select
to authenticated
using ((is_household_member(household_id) OR is_household_owner(household_id)))
;

drop policy if exists "Propietario actualiza invitaciones" on public.household_invitations;
create policy "Propietario actualiza invitaciones" on public.household_invitations
for update
to authenticated
using (is_household_owner(household_id))
;

drop policy if exists "Propietario crea invitaciones" on public.household_invitations;
create policy "Propietario crea invitaciones" on public.household_invitations
for insert
to authenticated
with check (((invited_by = auth.uid()) AND is_household_owner(household_id)))
;

drop policy if exists "Propietario elimina invitaciones" on public.household_invitations;
create policy "Propietario elimina invitaciones" on public.household_invitations
for delete
to authenticated
using (is_household_owner(household_id))
;

drop policy if exists "Propietario ve invitaciones" on public.household_invitations;
create policy "Propietario ve invitaciones" on public.household_invitations
for select
to authenticated
using ((is_household_owner(household_id) OR (invited_by = auth.uid())))
;

drop policy if exists "Usuarios ven miembros de su hogar" on public.household_members;
create policy "Usuarios ven miembros de su hogar" on public.household_members
for select
to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM households h
  WHERE ((h.id = household_members.household_id) AND (h.owner_id = auth.uid()))))))
;

drop policy if exists "Miembros añaden personas candidatas" on public.household_person_candidates;
create policy "Miembros añaden personas candidatas" on public.household_person_candidates
for insert
to authenticated
with check (((added_by = auth.uid()) AND (user_id <> auth.uid()) AND (is_household_member(household_id) OR is_household_owner(household_id))))
;

drop policy if exists "Miembros eliminan personas candidatas" on public.household_person_candidates;
create policy "Miembros eliminan personas candidatas" on public.household_person_candidates
for delete
to authenticated
using ((is_household_member(household_id) OR is_household_owner(household_id)))
;

drop policy if exists "Miembros ven personas candidatas" on public.household_person_candidates;
create policy "Miembros ven personas candidatas" on public.household_person_candidates
for select
to authenticated
using ((is_household_member(household_id) OR is_household_owner(household_id)))
;

drop policy if exists "Propietario actualiza hogar" on public.households;
create policy "Propietario actualiza hogar" on public.households
for update
to authenticated
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()))
;

drop policy if exists "Propietario elimina hogar" on public.households;
create policy "Propietario elimina hogar" on public.households
for delete
to authenticated
using ((owner_id = auth.uid()))
;

drop policy if exists "Usuarios crean hogares" on public.households;
create policy "Usuarios crean hogares" on public.households
for insert
to authenticated
with check ((auth.uid() = owner_id))
;

drop policy if exists "Usuarios ven sus hogares" on public.households;
create policy "Usuarios ven sus hogares" on public.households
for select
to authenticated
using (((owner_id = auth.uid()) OR is_household_member(id)))
;

drop policy if exists "Owners can delete private listing locations" on public.listing_private_locations;
create policy "Owners can delete private listing locations" on public.listing_private_locations
for delete
to public
using ((auth.uid() = owner_id))
;

drop policy if exists "Owners can insert private listing locations" on public.listing_private_locations;
create policy "Owners can insert private listing locations" on public.listing_private_locations
for insert
to public
with check ((auth.uid() = owner_id))
;

drop policy if exists "Owners can update private listing locations" on public.listing_private_locations;
create policy "Owners can update private listing locations" on public.listing_private_locations
for update
to public
using ((auth.uid() = owner_id))
with check ((auth.uid() = owner_id))
;

drop policy if exists "Owners can view private listing locations" on public.listing_private_locations;
create policy "Owners can view private listing locations" on public.listing_private_locations
for select
to public
using ((auth.uid() = owner_id))
;

drop policy if exists "Crear anuncios propios" on public.listings;
create policy "Crear anuncios propios" on public.listings
for insert
to authenticated
with check ((owner_id = auth.uid()))
;

drop policy if exists "Editar anuncios propios" on public.listings;
create policy "Editar anuncios propios" on public.listings
for update
to authenticated
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()))
;

drop policy if exists "Eliminar anuncios propios" on public.listings;
create policy "Eliminar anuncios propios" on public.listings
for delete
to authenticated
using ((owner_id = auth.uid()))
;

drop policy if exists "Ver anuncios publicados" on public.listings;
create policy "Ver anuncios publicados" on public.listings
for select
to authenticated
using (((owner_id = auth.uid()) OR ((status = 'published'::text) AND (NOT users_are_blocked(auth.uid(), owner_id)))))
;

drop policy if exists "Usuarios crean sus preferencias de match" on public.match_preferences;
create policy "Usuarios crean sus preferencias de match" on public.match_preferences
for insert
to authenticated
with check ((user_id = auth.uid()))
;

drop policy if exists "Usuarios editan sus preferencias de match" on public.match_preferences;
create policy "Usuarios editan sus preferencias de match" on public.match_preferences
for update
to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()))
;

drop policy if exists "Usuarios eliminan sus preferencias de match" on public.match_preferences;
create policy "Usuarios eliminan sus preferencias de match" on public.match_preferences
for delete
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "Usuarios ven sus preferencias de match" on public.match_preferences;
create policy "Usuarios ven sus preferencias de match" on public.match_preferences
for select
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "El destinatario marca mensajes como leídos" on public.messages;
create policy "El destinatario marca mensajes como leídos" on public.messages
for update
to authenticated
using (((auth.uid() = recipient_id) AND (NOT users_are_blocked(sender_id, recipient_id))))
with check (((auth.uid() = recipient_id) AND (NOT users_are_blocked(sender_id, recipient_id))))
;

drop policy if exists "Los participantes ven sus mensajes" on public.messages;
create policy "Los participantes ven sus mensajes" on public.messages
for select
to authenticated
using ((((auth.uid() = sender_id) OR (auth.uid() = recipient_id)) AND (NOT users_are_blocked(sender_id, recipient_id))))
;

drop policy if exists "Usuarios conectados envían mensajes" on public.messages;
create policy "Usuarios conectados envían mensajes" on public.messages
for insert
to authenticated
with check (((auth.uid() = sender_id) AND (NOT users_are_blocked(sender_id, recipient_id)) AND (EXISTS ( SELECT 1
   FROM connections
  WHERE ((connections.status = 'accepted'::text) AND (((connections.requester_id = messages.sender_id) AND (connections.recipient_id = messages.recipient_id)) OR ((connections.recipient_id = messages.sender_id) AND (connections.requester_id = messages.recipient_id))))))))
;

drop policy if exists "Cada usuario crea sus preferencias" on public.onboarding_preferences;
create policy "Cada usuario crea sus preferencias" on public.onboarding_preferences
for insert
to authenticated
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario edita sus preferencias" on public.onboarding_preferences;
create policy "Cada usuario edita sus preferencias" on public.onboarding_preferences
for update
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario ve sus preferencias" on public.onboarding_preferences;
create policy "Cada usuario ve sus preferencias" on public.onboarding_preferences
for select
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments
for delete
to authenticated
using ((author_id = auth.uid()))
;

drop policy if exists "post_comments_insert_accessible" on public.post_comments;
create policy "post_comments_insert_accessible" on public.post_comments
for insert
to authenticated
with check (((author_id = auth.uid()) AND can_interact_with_post(post_id, auth.uid())))
;

drop policy if exists "post_comments_select_accessible" on public.post_comments;
create policy "post_comments_select_accessible" on public.post_comments
for select
to authenticated
using (can_interact_with_post(post_id, auth.uid()))
;

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own" on public.post_comments
for update
to authenticated
using ((author_id = auth.uid()))
with check (((author_id = auth.uid()) AND can_interact_with_post(post_id, auth.uid())))
;

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own" on public.post_likes
for delete
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "post_likes_insert_accessible" on public.post_likes;
create policy "post_likes_insert_accessible" on public.post_likes
for insert
to authenticated
with check (((user_id = auth.uid()) AND can_interact_with_post(post_id, auth.uid())))
;

drop policy if exists "post_likes_select_accessible" on public.post_likes;
create policy "post_likes_select_accessible" on public.post_likes
for select
to authenticated
using (can_interact_with_post(post_id, auth.uid()))
;

drop policy if exists "Crear publicaciones propias" on public.posts;
create policy "Crear publicaciones propias" on public.posts
for insert
to authenticated
with check (((author_id = auth.uid()) AND ((community_id IS NULL) OR can_participate_community(community_id, auth.uid()))))
;

drop policy if exists "Editar publicaciones propias" on public.posts;
create policy "Editar publicaciones propias" on public.posts
for update
to authenticated
using ((author_id = auth.uid()))
with check (((author_id = auth.uid()) AND ((community_id IS NULL) OR can_participate_community(community_id, auth.uid()))))
;

drop policy if exists "Eliminar publicaciones propias" on public.posts;
create policy "Eliminar publicaciones propias" on public.posts
for delete
to authenticated
using ((author_id = auth.uid()))
;

drop policy if exists "Ver publicaciones accesibles" on public.posts;
create policy "Ver publicaciones accesibles" on public.posts
for select
to authenticated
using (((author_id = auth.uid()) OR ((status = 'published'::text) AND (NOT users_are_blocked(auth.uid(), author_id)) AND ((community_id IS NULL) OR can_access_community(community_id, auth.uid())))))
;

drop policy if exists "Cada usuario crea su perfil" on public.profiles;
create policy "Cada usuario crea su perfil" on public.profiles
for insert
to authenticated
with check ((auth.uid() = id))
;

drop policy if exists "Cada usuario edita su perfil" on public.profiles;
create policy "Cada usuario edita su perfil" on public.profiles
for update
to authenticated
using ((auth.uid() = id))
with check ((auth.uid() = id))
;

drop policy if exists "Cada usuario ve su propio perfil" on public.profiles;
create policy "Cada usuario ve su propio perfil" on public.profiles
for select
to authenticated
using ((auth.uid() = id))
;

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports" on public.reports
for insert
to authenticated
with check ((reporter_id = auth.uid()))
;

drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports" on public.reports
for select
to authenticated
using ((reporter_id = auth.uid()))
;

drop policy if exists "rooms_dna_delete_own" on public.rooms_dna;
create policy "rooms_dna_delete_own" on public.rooms_dna
for delete
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "rooms_dna_insert_own" on public.rooms_dna;
create policy "rooms_dna_insert_own" on public.rooms_dna
for insert
to authenticated
with check ((auth.uid() = user_id))
;

drop policy if exists "rooms_dna_select_own" on public.rooms_dna;
create policy "rooms_dna_select_own" on public.rooms_dna
for select
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "rooms_dna_update_own" on public.rooms_dna;
create policy "rooms_dna_update_own" on public.rooms_dna
for update
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario añade elementos a sus colecciones" on public.saved_collection_items;
create policy "Cada usuario añade elementos a sus colecciones" on public.saved_collection_items
for insert
to authenticated
with check (((EXISTS ( SELECT 1
   FROM saved_collections c
  WHERE ((c.id = saved_collection_items.collection_id) AND (c.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM saved_items s
  WHERE ((s.id = saved_collection_items.saved_item_id) AND (s.user_id = auth.uid()))))))
;

drop policy if exists "Cada usuario elimina elementos de sus colecciones" on public.saved_collection_items;
create policy "Cada usuario elimina elementos de sus colecciones" on public.saved_collection_items
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM saved_collections c
  WHERE ((c.id = saved_collection_items.collection_id) AND (c.user_id = auth.uid())))))
;

drop policy if exists "Cada usuario ve elementos de sus colecciones" on public.saved_collection_items;
create policy "Cada usuario ve elementos de sus colecciones" on public.saved_collection_items
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM saved_collections c
  WHERE ((c.id = saved_collection_items.collection_id) AND (c.user_id = auth.uid())))))
;

drop policy if exists "Cada usuario crea sus colecciones" on public.saved_collections;
create policy "Cada usuario crea sus colecciones" on public.saved_collections
for insert
to authenticated
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario edita sus colecciones" on public.saved_collections;
create policy "Cada usuario edita sus colecciones" on public.saved_collections
for update
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario elimina sus colecciones" on public.saved_collections;
create policy "Cada usuario elimina sus colecciones" on public.saved_collections
for delete
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario ve sus colecciones" on public.saved_collections;
create policy "Cada usuario ve sus colecciones" on public.saved_collections
for select
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario actualiza sus guardados" on public.saved_items;
create policy "Cada usuario actualiza sus guardados" on public.saved_items
for update
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario elimina sus guardados" on public.saved_items;
create policy "Cada usuario elimina sus guardados" on public.saved_items
for delete
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario guarda elementos" on public.saved_items;
create policy "Cada usuario guarda elementos" on public.saved_items
for insert
to authenticated
with check ((auth.uid() = user_id))
;

drop policy if exists "Cada usuario ve sus guardados" on public.saved_items;
create policy "Cada usuario ve sus guardados" on public.saved_items
for select
to authenticated
using ((auth.uid() = user_id))
;

drop policy if exists "Users can block users" on public.user_blocks;
create policy "Users can block users" on public.user_blocks
for insert
to authenticated
with check (((blocker_id = auth.uid()) AND (blocked_id <> auth.uid())))
;

drop policy if exists "Users can unblock users" on public.user_blocks;
create policy "Users can unblock users" on public.user_blocks
for delete
to authenticated
using ((blocker_id = auth.uid()))
;

drop policy if exists "Users can view own blocks" on public.user_blocks;
create policy "Users can view own blocks" on public.user_blocks
for select
to authenticated
using ((blocker_id = auth.uid()))
;

drop policy if exists "Usuarios crean sus intenciones" on public.user_intents;
create policy "Usuarios crean sus intenciones" on public.user_intents
for insert
to authenticated
with check ((user_id = auth.uid()))
;

drop policy if exists "Usuarios eliminan sus intenciones" on public.user_intents;
create policy "Usuarios eliminan sus intenciones" on public.user_intents
for delete
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "Usuarios ven sus intenciones" on public.user_intents;
create policy "Usuarios ven sus intenciones" on public.user_intents
for select
to authenticated
using ((user_id = auth.uid()))
;

drop policy if exists "Usuarios ven su rol" on public.user_roles;
create policy "Usuarios ven su rol" on public.user_roles
for select
to authenticated
using ((user_id = auth.uid()))
;

drop trigger if exists communities_set_updated_at on public.communities;
create trigger communities_set_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

drop trigger if exists on_community_created on public.communities;
create trigger on_community_created
after insert on public.communities
for each row execute function public.add_community_owner();

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
before update on public.connections
for each row execute function public.set_updated_at();

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

drop trigger if exists match_preferences_touch_updated_at on public.match_preferences;
create trigger match_preferences_touch_updated_at
before update on public.match_preferences
for each row execute function public.touch_match_preferences_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists validate_household_candidate_vote_trigger on public.household_candidate_votes;
create trigger validate_household_candidate_vote_trigger
before insert or update on public.household_candidate_votes
for each row execute function public.validate_household_candidate_vote();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('community-images', 'community-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('community-post-media', 'community-post-media', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('listing-images', 'listing-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies recovered from production.
drop policy if exists "Actualizar avatar propio" on storage.objects;
create policy "Actualizar avatar propio" on storage.objects for update to authenticated
using ((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text))
with check ((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "Eliminar avatar propio" on storage.objects;
create policy "Eliminar avatar propio" on storage.objects for delete to authenticated
using ((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "Subir avatar propio" on storage.objects;
create policy "Subir avatar propio" on storage.objects for insert to authenticated
with check ((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "Ver avatares" on storage.objects;
create policy "Ver avatares" on storage.objects for select to public
using (bucket_id = 'avatars'::text);

drop policy if exists "Actualizar imágenes propias" on storage.objects;
create policy "Actualizar imágenes propias" on storage.objects for update to authenticated
using ((bucket_id = 'listing-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text))
with check ((bucket_id = 'listing-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "Eliminar imágenes propias" on storage.objects;
create policy "Eliminar imágenes propias" on storage.objects for delete to authenticated
using ((bucket_id = 'listing-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "Subir imágenes propias" on storage.objects;
create policy "Subir imágenes propias" on storage.objects for insert to authenticated
with check ((bucket_id = 'listing-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "Ver imágenes de anuncios" on storage.objects;
create policy "Ver imágenes de anuncios" on storage.objects for select to public
using (bucket_id = 'listing-images'::text);

drop policy if exists community_images_delete_own on storage.objects;
create policy community_images_delete_own on storage.objects for delete to authenticated
using ((bucket_id = 'community-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists community_images_insert_own on storage.objects;
create policy community_images_insert_own on storage.objects for insert to authenticated
with check ((bucket_id = 'community-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists community_images_update_own on storage.objects;
create policy community_images_update_own on storage.objects for update to authenticated
using ((bucket_id = 'community-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text))
with check ((bucket_id = 'community-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists community_post_media_delete_own on storage.objects;
create policy community_post_media_delete_own on storage.objects for delete to authenticated
using ((bucket_id = 'community-post-media'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists community_post_media_insert_own on storage.objects;
create policy community_post_media_insert_own on storage.objects for insert to authenticated
with check ((bucket_id = 'community-post-media'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));




\echo === 2/41 20260924_get_profile_visibility.sql ===
CREATE OR REPLACE FUNCTION public.get_profile_visibility(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  viewer_id uuid := auth.uid();
  privacy_data jsonb := '{}'::jsonb;
  controls jsonb := '{}'::jsonb;

  viewer_scope text := 'public';

  living_scope text := 'public';
  search_scope text := 'public';
  budget_scope text := 'public';
  activity_scope text := 'public';

  is_connection boolean := false;
begin
  if viewer_id is not null and viewer_id = target_user_id then
    return jsonb_build_object(
      'viewer_scope', 'owner',
      'living', true,
      'search', true,
      'budget', true,
      'activity', true
    );
  end if;

  select
    coalesce(answers -> 'privacy', '{}'::jsonb)
  into privacy_data
  from public.onboarding_preferences
  where user_id = target_user_id
  limit 1;

  controls :=
    coalesce(
      privacy_data -> 'controls',
      '{}'::jsonb
    );

  if viewer_id is not null then
    select exists (
      select 1
      from public.connections
      where status = 'accepted'
        and (
          (
            requester_id = viewer_id
            and recipient_id = target_user_id
          )
          or
          (
            requester_id = target_user_id
            and recipient_id = viewer_id
          )
        )
    )
    into is_connection;
  end if;

  if is_connection then
    viewer_scope := 'connections';
  end if;

  living_scope :=
    case
      when controls ? 'living'
        then controls ->> 'living'
      when controls ? 'habits'
        and (controls ->> 'habits')::boolean = false
        then 'private'
      else 'public'
    end;

  search_scope :=
    case
      when controls ? 'search'
        then controls ->> 'search'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      else 'public'
    end;

  budget_scope :=
    case
      when controls ? 'budget'
        then controls ->> 'budget'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      when privacy_data ->> 'level' = 'private'
        then 'private'
      when privacy_data ->> 'level' = 'balanced'
        then 'connections'
      else 'public'
    end;

  activity_scope :=
    case
      when controls ? 'activity'
        then controls ->> 'activity'
      when controls ? 'posts'
        and (controls ->> 'posts')::boolean = false
        then 'private'
      else 'public'
    end;

  return jsonb_build_object(
    'viewer_scope',
      viewer_scope,

    'living',
      living_scope = 'public'
      or (
        living_scope = 'connections'
        and is_connection
      ),

    'search',
      search_scope = 'public'
      or (
        search_scope = 'connections'
        and is_connection
      ),

    'budget',
      budget_scope = 'public'
      or (
        budget_scope = 'connections'
        and is_connection
      ),

    'activity',
      activity_scope = 'public'
      or (
        activity_scope = 'connections'
        and is_connection
      )
  );
end;
$function$;


/*
 * Normalización del esquema antiguo de privacidad.
 *
 * Legacy:
 *   habits / searching / posts / communities -> boolean
 *
 * Actual:
 *   living / search / budget / activity
 *   public / connections / private
 */
update public.onboarding_preferences
set answers = jsonb_set(
  jsonb_set(
    answers,
    '{privacy,controls}',
    jsonb_build_object(
      'living',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'habits')::boolean,
            true
          )
            then 'public'
          else 'private'
        end,

      'search',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'searching')::boolean,
            true
          )
            then 'public'
          else 'private'
        end,

      'budget',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'searching')::boolean,
            true
          ) = false
            then 'private'
          when answers -> 'privacy' ->> 'level' = 'private'
            then 'private'
          when answers -> 'privacy' ->> 'level' = 'balanced'
            then 'connections'
          else 'public'
        end,

      'activity',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'posts')::boolean,
            true
          )
            then 'public'
          else 'private'
        end
    ),
    true
  ),
  '{privacy,level}',
  to_jsonb(
    case
      when answers -> 'privacy' ->> 'level' = 'public'
        then 'open'
      when answers -> 'privacy' ->> 'level'
        in ('open', 'balanced', 'private')
        then answers -> 'privacy' ->> 'level'
      else 'balanced'
    end
  ),
  true
)
where
  answers -> 'privacy' -> 'controls' ? 'habits'
  or answers -> 'privacy' -> 'controls' ? 'searching'
  or answers -> 'privacy' -> 'controls' ? 'posts'
  or answers -> 'privacy' -> 'controls' ? 'communities';


/*
 * El nivel es un preset.
 * Si los controles modernos no coinciden exactamente con un preset,
 * la configuración es personalizada.
 */
update public.onboarding_preferences
set answers = jsonb_set(
  answers,
  '{privacy,level}',
  to_jsonb(
    case
      when answers -> 'privacy' -> 'controls' = jsonb_build_object(
        'living', 'public',
        'search', 'public',
        'budget', 'public',
        'activity', 'public'
      )
        then 'open'

      when answers -> 'privacy' -> 'controls' = jsonb_build_object(
        'living', 'public',
        'search', 'public',
        'budget', 'connections',
        'activity', 'public'
      )
        then 'balanced'

      when answers -> 'privacy' -> 'controls' = jsonb_build_object(
        'living', 'private',
        'search', 'private',
        'budget', 'private',
        'activity', 'private'
      )
        then 'private'

      else 'custom'
    end
  ),
  true
)
where
  answers -> 'privacy' -> 'controls' ? 'living'
  and answers -> 'privacy' -> 'controls' ? 'search'
  and answers -> 'privacy' -> 'controls' ? 'budget'
  and answers -> 'privacy' -> 'controls' ? 'activity';



\echo === 3/41 20260928_community_security.sql ===
/*
 * Seguridad y acceso de Comunidades.
 *
 * - Comunidades privadas: solo propietario o miembros activos.
 * - Auto-unión: únicamente comunidades públicas activas.
 * - Posts comunitarios: lectura/escritura según acceso.
 * - Likes y comentarios: solo sobre posts accesibles.
 * - Sin UPDATE libre de community_members para evitar escalada de rol.
 */


/* ---------------------------------------------------------
   Helpers de acceso
   --------------------------------------------------------- */

create or replace function public.can_access_community(
  target_community_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities c
    where c.id = target_community_id
      and (
        (
          c.status = 'active'
          and c.visibility = 'public'
        )
        or c.owner_id = target_user_id
        or exists (
          select 1
          from public.community_members cm
          where cm.community_id = c.id
            and cm.user_id = target_user_id
            and cm.status = 'active'
        )
      )
  );
$$;

revoke all
on function public.can_access_community(uuid, uuid)
from public;

grant execute
on function public.can_access_community(uuid, uuid)
to authenticated;


create or replace function public.is_public_active_community(
  target_community_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities
    where id = target_community_id
      and visibility = 'public'
      and status = 'active'
  );
$$;

revoke all
on function public.is_public_active_community(uuid)
from public;

grant execute
on function public.is_public_active_community(uuid)
to authenticated;


create or replace function public.can_participate_community(
  target_community_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities c
    where c.id = target_community_id
      and (
        c.owner_id = target_user_id
        or exists (
          select 1
          from public.community_members cm
          where cm.community_id = c.id
            and cm.user_id = target_user_id
            and cm.status = 'active'
        )
      )
  );
$$;

revoke all
on function public.can_participate_community(uuid, uuid)
from public;

grant execute
on function public.can_participate_community(uuid, uuid)
to authenticated;


create or replace function public.can_interact_with_post(
  target_post_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = target_post_id
      and p.status = 'published'
      and (
        p.author_id = target_user_id
        or (
          not public.users_are_blocked(
            target_user_id,
            p.author_id
          )
          and (
            p.community_id is null
            or public.can_access_community(
              p.community_id,
              target_user_id
            )
          )
        )
      )
  );
$$;

revoke all
on function public.can_interact_with_post(uuid, uuid)
from public;

grant execute
on function public.can_interact_with_post(uuid, uuid)
to authenticated;


/* ---------------------------------------------------------
   communities
   --------------------------------------------------------- */

drop policy if exists "communities_select_active"
on public.communities;

drop policy if exists "Ver comunidades públicas o propias"
on public.communities;

drop policy if exists "Ver comunidades accesibles"
on public.communities;

create policy "Ver comunidades accesibles"
on public.communities
for select
to authenticated
using (
  public.can_access_community(
    id,
    auth.uid()
  )
);


/* ---------------------------------------------------------
   community_members
   --------------------------------------------------------- */

drop policy if exists "Unirse a comunidades"
on public.community_members;

drop policy if exists "Unirse a comunidades públicas"
on public.community_members;

create policy "Unirse a comunidades públicas"
on public.community_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
  and status = 'active'
  and public.is_public_active_community(
    community_id
  )
);


drop policy if exists "Ver miembros de comunidades públicas"
on public.community_members;

drop policy if exists "Ver miembros de comunidades accesibles"
on public.community_members;

create policy "Ver miembros de comunidades accesibles"
on public.community_members
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    not public.users_are_blocked(
      auth.uid(),
      user_id
    )
    and public.can_access_community(
      community_id,
      auth.uid()
    )
  )
);


drop policy if exists "community_members_update_self"
on public.community_members;


/* ---------------------------------------------------------
   posts
   --------------------------------------------------------- */

drop policy if exists "Ver publicaciones"
on public.posts;

drop policy if exists "Ver publicaciones accesibles"
on public.posts;

create policy "Ver publicaciones accesibles"
on public.posts
for select
to authenticated
using (
  author_id = auth.uid()
  or (
    status = 'published'
    and not public.users_are_blocked(
      auth.uid(),
      author_id
    )
    and (
      community_id is null
      or public.can_access_community(
        community_id,
        auth.uid()
      )
    )
  )
);


drop policy if exists "Crear publicaciones propias"
on public.posts;

create policy "Crear publicaciones propias"
on public.posts
for insert
to authenticated
with check (
  author_id = auth.uid()
  and (
    community_id is null
    or public.can_participate_community(
      community_id,
      auth.uid()
    )
  )
);


drop policy if exists "Editar publicaciones propias"
on public.posts;

create policy "Editar publicaciones propias"
on public.posts
for update
to authenticated
using (
  author_id = auth.uid()
)
with check (
  author_id = auth.uid()
  and (
    community_id is null
    or public.can_participate_community(
      community_id,
      auth.uid()
    )
  )
);


/* ---------------------------------------------------------
   post_likes
   --------------------------------------------------------- */

drop policy if exists "post_likes_select"
on public.post_likes;

drop policy if exists "post_likes_select_accessible"
on public.post_likes;

create policy "post_likes_select_accessible"
on public.post_likes
for select
to authenticated
using (
  public.can_interact_with_post(
    post_id,
    auth.uid()
  )
);


drop policy if exists "post_likes_insert_own"
on public.post_likes;

drop policy if exists "post_likes_insert_accessible"
on public.post_likes;

create policy "post_likes_insert_accessible"
on public.post_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_interact_with_post(
    post_id,
    auth.uid()
  )
);


/* ---------------------------------------------------------
   post_comments
   --------------------------------------------------------- */

drop policy if exists "post_comments_select"
on public.post_comments;

drop policy if exists "post_comments_select_accessible"
on public.post_comments;

create policy "post_comments_select_accessible"
on public.post_comments
for select
to authenticated
using (
  public.can_interact_with_post(
    post_id,
    auth.uid()
  )
);


drop policy if exists "post_comments_insert_own"
on public.post_comments;

drop policy if exists "post_comments_insert_accessible"
on public.post_comments;

create policy "post_comments_insert_accessible"
on public.post_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.can_interact_with_post(
    post_id,
    auth.uid()
  )
);


drop policy if exists "post_comments_update_own"
on public.post_comments;

create policy "post_comments_update_own"
on public.post_comments
for update
to authenticated
using (
  author_id = auth.uid()
)
with check (
  author_id = auth.uid()
  and public.can_interact_with_post(
    post_id,
    auth.uid()
  )
);



\echo === 4/41 20260928_household_security.sql ===
-- Seguridad y consistencia de Hogares / grupos de búsqueda.


-- Miembros reales de un Hogar.
-- Solo un miembro aceptado puede consultar la lista.
create or replace function public.get_household_members(
  _household_id uuid
)
returns table(
  household_id uuid,
  user_id uuid,
  role text,
  status text,
  joined_at timestamptz,
  name text,
  alias text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hm.household_id,
    hm.user_id,
    hm.role,
    hm.status,
    hm.joined_at,
    p.name,
    p.alias,
    p.avatar_url
  from public.household_members hm
  join public.profiles p
    on p.id = hm.user_id
  where hm.household_id = _household_id
    and hm.status = 'accepted'
    and public.is_household_member(_household_id)
  order by hm.joined_at asc;
$$;

revoke all
on function public.get_household_members(uuid)
from public;

grant execute
on function public.get_household_members(uuid)
to authenticated;


-- Un usuario solo puede actualizar su voto
-- mientras siga perteneciendo al Hogar.
drop policy if exists "Miembros actualizan sus votos"
on public.household_candidate_votes;

create policy "Miembros actualizan sus votos"
on public.household_candidate_votes
for update
to authenticated
using (
  user_id = auth.uid()
  and (
    public.is_household_member(household_id)
    or public.is_household_owner(household_id)
  )
)
with check (
  user_id = auth.uid()
  and (
    public.is_household_member(household_id)
    or public.is_household_owner(household_id)
  )
);


-- Un voto solo puede apuntar a un candidato
-- que exista realmente dentro del mismo Hogar.
create or replace function public.validate_household_candidate_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.candidate_type = 'listing' then

    if not exists (
      select 1
      from public.household_candidates hc
      where hc.household_id = new.household_id
        and hc.listing_id = new.candidate_id
    ) then
      raise exception
        'Listing candidate does not exist in this household';
    end if;

  elsif new.candidate_type = 'person' then

    if not exists (
      select 1
      from public.household_person_candidates hpc
      where hpc.household_id = new.household_id
        and hpc.user_id = new.candidate_id
    ) then
      raise exception
        'Person candidate does not exist in this household';
    end if;

  else
    raise exception 'Invalid candidate type';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_household_candidate_vote_trigger
on public.household_candidate_votes;

create trigger validate_household_candidate_vote_trigger
before insert or update
on public.household_candidate_votes
for each row
execute function public.validate_household_candidate_vote();



\echo === 5/41 20261005_rooms_dna_v2.sql ===
create table if not exists public.rooms_dna (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  model_version integer not null,

  answers jsonb not null
    default '{}'::jsonb,

  dimensions jsonb not null
    default '{}'::jsonb,

  categories jsonb not null
    default '{}'::jsonb,

  classification jsonb not null
    default '{}'::jsonb,

  evidence jsonb not null
    default '[]'::jsonb,

  calculated_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint rooms_dna_model_version_positive
    check (model_version > 0),

  constraint rooms_dna_answers_object
    check (jsonb_typeof(answers) = 'object'),

  constraint rooms_dna_dimensions_object
    check (jsonb_typeof(dimensions) = 'object'),

  constraint rooms_dna_categories_object
    check (jsonb_typeof(categories) = 'object'),

  constraint rooms_dna_classification_object
    check (jsonb_typeof(classification) = 'object'),

  constraint rooms_dna_evidence_array
    check (jsonb_typeof(evidence) = 'array')
);

alter table public.rooms_dna
  enable row level security;

drop policy if exists
  "rooms_dna_select_own"
  on public.rooms_dna;

create policy
  "rooms_dna_select_own"
  on public.rooms_dna
  for select
  to authenticated
  using (
    auth.uid() = user_id
  );

drop policy if exists
  "rooms_dna_insert_own"
  on public.rooms_dna;

create policy
  "rooms_dna_insert_own"
  on public.rooms_dna
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
  );

drop policy if exists
  "rooms_dna_update_own"
  on public.rooms_dna;

create policy
  "rooms_dna_update_own"
  on public.rooms_dna
  for update
  to authenticated
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

drop policy if exists
  "rooms_dna_delete_own"
  on public.rooms_dna;

create policy
  "rooms_dna_delete_own"
  on public.rooms_dna
  for delete
  to authenticated
  using (
    auth.uid() = user_id
  );



\echo === 6/41 20261007_harden_rpc_permissions.sql ===
-- ROOMS
-- Harden SECURITY DEFINER RPC permissions.
-- These RPCs are application functions and must not be executable by PUBLIC.

revoke execute on function
  public.get_profile_visibility(uuid)
from public;

grant execute on function
  public.get_profile_visibility(uuid)
to authenticated;


-- Removed incomplete permission statements.


revoke execute on function
  public.is_household_member(uuid)
from public;

grant execute on function
  public.is_household_member(uuid)
to authenticated;


revoke execute on function
  public.is_household_owner(uuid)
from public;

grant execute on function
  public.is_household_owner(uuid)
to authenticated;


revoke execute on function
  public.users_are_blocked(uuid, uuid)
from public;

grant execute on function
  public.users_are_blocked(uuid, uuid)
to authenticated;



\echo === 7/41 20261007_restore_core_rpcs.sql ===
-- ROOMS
-- RPCs recuperadas del proyecto Supabase remoto.
-- Fuente: definiciones reales auditadas el 2026-10-07.
--
-- Importante:
-- Estas funciones dependen de tablas históricas que todavía deben
-- incorporarse al historial completo de migraciones del repositorio.

create or replace function public.create_community(
  _name text,
  _description text default null::text,
  _visibility text default 'public'::text
)
returns public.communities
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _user_id uuid;
  _community public.communities;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Community name is required';
  end if;

  if _visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;

  insert into public.communities (
    id,
    owner_id,
    name,
    description,
    visibility,
    status
  )
  values (
    gen_random_uuid(),
    _user_id,
    trim(_name),
    nullif(trim(_description), ''),
    _visibility,
    'active'
  )
  returning *
  into _community;

  insert into public.community_members (
    community_id,
    user_id,
    role,
    status
  )
  values (
    _community.id,
    _user_id,
    'owner',
    'active'
  )
  on conflict (community_id, user_id)
  do update set
    role = 'owner',
    status = 'active';

  return _community;
end;
$function$;


create or replace function public.users_are_blocked(
  user_a uuid,
  user_b uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.user_blocks
    where
      (
        blocker_id = user_a
        and blocked_id = user_b
      )
      or
      (
        blocker_id = user_b
        and blocked_id = user_a
      )
  );
$function$;


create or replace function public.is_household_member(
  _household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.household_members
    where household_id = _household_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$function$;


create or replace function public.is_household_owner(
  _household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.households
    where id = _household_id
      and owner_id = auth.uid()
  );
$function$;


create or replace function public.get_visible_profiles(
  _target_user_id uuid default null::uuid
)
returns table(
  id uuid,
  name text,
  alias text,
  avatar_url text,
  bio text,
  age integer,
  seeking text[],
  zones text[],
  budget_min integer,
  budget_max integer,
  move_in_date date,
  traits text[],
  viewer_scope text
)
language sql
security definer
set search_path to 'public'
as $function$

  select
    p.id,
    p.name,
    p.alias,
    p.avatar_url,
    p.bio,
    p.age,

    case
      when visibility.search_visible
        then p.seeking
      else null
    end as seeking,

    case
      when visibility.search_visible
        then p.zones
      else null
    end as zones,

    case
      when visibility.budget_visible
        then p.budget_min
      else null
    end as budget_min,

    case
      when visibility.budget_visible
        then p.budget_max
      else null
    end as budget_max,

    case
      when visibility.search_visible
        then p.move_in_date
      else null
    end as move_in_date,

    p.traits,

    visibility.viewer_scope

  from public.profiles p

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

  cross join lateral (
    select

      case
        when exists (
          select 1
          from public.connections c
          where c.status = 'accepted'
            and (
              (
                c.requester_id = auth.uid()
                and c.recipient_id = p.id
              )
              or
              (
                c.requester_id = p.id
                and c.recipient_id = auth.uid()
              )
            )
        )
        then 'connection'
        else 'public'
      end as viewer_scope,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'search',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'search',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as search_visible,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'budget',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'budget',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as budget_visible

  ) visibility

  where
    p.onboarding_completed = true

    and p.id <> auth.uid()

    and not public.users_are_blocked(
      auth.uid(),
      p.id
    )

    and (
      _target_user_id is null
      or p.id = _target_user_id
    );

$function$;


revoke execute on function
  public.create_community(text, text, text)
from public;

grant execute on function
  public.create_community(text, text, text)
to authenticated;


revoke execute on function
  public.get_visible_profiles(uuid)
from public;

grant execute on function
  public.get_visible_profiles(uuid)
to authenticated;


revoke execute on function
  public.users_are_blocked(uuid, uuid)
from public;

grant execute on function
  public.users_are_blocked(uuid, uuid)
to authenticated;


revoke execute on function
  public.is_household_member(uuid)
from public;

grant execute on function
  public.is_household_member(uuid)
to authenticated;


revoke execute on function
  public.is_household_owner(uuid)
from public;

grant execute on function
  public.is_household_owner(uuid)
to authenticated;



\echo === 8/41 20261013_get_match_profile_v2.sql ===
-- ROOMS: Matching DNA V2
-- Datos minimos, autorizacion por usuario y privacidad.
-- No expone respuestas ni evidencias individuales.

create or replace function public.get_match_profile(
  target_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  viewer_id uuid := auth.uid();
  result jsonb;
begin
  if viewer_id is null
     or target_user_id is null
     or viewer_id = target_user_id then
    return null;
  end if;

  -- Comprobar bloqueo antes de devolver cualquier dato.
  if public.users_are_blocked(
    viewer_id, target_user_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,

    'viewer_scope',
      visibility.permissions ->> 'viewer_scope',

    'search_visible',
      coalesce(
        (visibility.permissions ->> 'search')::boolean,
        false
      ),

    'budget_visible',
      coalesce(
        (visibility.permissions ->> 'budget')::boolean,
        false
      ),

    'seeking',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.seeking)
      else null end,

    'zones',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.zones)
      else null end,

    'move_in_date',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.move_in_date)
      else null end,

    'duration',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.duration)
      else null end,

    'budget_min',
      case when
        (visibility.permissions ->> 'budget')::boolean
      then to_jsonb(p.budget_min)
      else null end,

    'budget_max',
      case when
        (visibility.permissions ->> 'budget')::boolean
      then to_jsonb(p.budget_max)
      else null end,

    'living_visible',
      coalesce(
        (visibility.permissions ->> 'living')::boolean,
        false
      ),

    -- Compatibilidad temporal con la version publicada.
    'living',
      case
        when coalesce(
          (visibility.permissions ->> 'living')::boolean,
          false
        )
        then coalesce(
          pref.answers -> 'living',
          '{}'::jsonb
        )
        else null
      end,

    'move_flexible',
      case
        when coalesce(
          (visibility.permissions ->> 'search')::boolean,
          false
        )
        then coalesce(
          pref.answers #> '{move,flexible}',
          'false'::jsonb
        )
        else null
      end,

    'dna_dimensions',
      case
        when
          coalesce(
            (visibility.permissions ->> 'living')::boolean,
            false
          )
          and d.model_version = 2
        then (
          select coalesce(
            jsonb_object_agg(
              dimension.key,
              jsonb_build_object(
                'self', jsonb_build_object(
                  'score',
                    dimension.value #> '{self,score}',
                  'confidence',
                    dimension.value #> '{self,confidence}'
                ),
                'preferred', jsonb_build_object(
                  'score',
                    dimension.value #> '{preferred,score}',
                  'confidence',
                    dimension.value #> '{preferred,confidence}'
                ),
                'importance', jsonb_build_object(
                  'score',
                    dimension.value #> '{importance,score}',
                  'confidence',
                    dimension.value #> '{importance,confidence}'
                )
              )
            ),
            '{}'::jsonb
          )
          from jsonb_each(
            coalesce(d.dimensions, '{}'::jsonb)
          ) as dimension(key, value)
          where dimension.key in (
            'privacy',
            'cleanliness',
            'visitor_tolerance',
            'sharing_style'
          )
        )
        else null
      end
  )
  into result

  from public.profiles p

  cross join lateral (
    select public.get_profile_visibility(
      p.id
    ) as permissions
  ) visibility

  left join public.rooms_dna d
    on d.user_id = p.id

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

  where p.id = target_user_id
    and p.onboarding_completed = true
    and p.id <> viewer_id;

  return result;
end;
$function$;

revoke all on function
  public.get_match_profile(uuid)
from public;

revoke all on function
  public.get_match_profile(uuid)
from anon;

grant execute on function
  public.get_match_profile(uuid)
to authenticated;



\echo === 9/41 20261013_rooms_dna_revision.sql ===
-- ROOMS DNA V2
-- Control de concurrencia optimista mediante revision.

alter table public.rooms_dna
  add column if not exists revision bigint not null default 0;

create or replace function public.rooms_dna_increment_revision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

drop trigger if exists
  rooms_dna_revision_before_update
on public.rooms_dna;

create trigger rooms_dna_revision_before_update
before update on public.rooms_dna
for each row
execute function public.rooms_dna_increment_revision();

revoke all on function
  public.rooms_dna_increment_revision()
from public;

revoke all on function
  public.rooms_dna_increment_revision()
from anon;

revoke all on function
  public.rooms_dna_increment_revision()
from authenticated;



\echo === 10/41 20261014165000_visible_profiles_v2.sql ===
-- ROOMS: visible profile V2 contract. Review remote schema before running.
-- IMPORTANT: this migration is coupled to frontend switching to get_visible_profiles_v2.
-- Do not run independently while the published frontend still uses the old RPC.
-- The historical RPC is denied to app roles to close its unfiltered traits exposure.
-- No rows are updated by this migration.
create or replace function public.get_visible_profiles_v2(
  _target_user_id uuid default null::uuid
)
returns table(
  id uuid,
  name text,
  alias text,
  avatar_url text,
  bio text,
  age integer,
  seeking text[],
  zones text[],
  budget_min integer,
  budget_max integer,
  move_in_date date,
  traits text[],
  interests text[],
  viewer_scope text
)
language sql
security definer
set search_path = public, pg_temp
as $function$

  select
    p.id,
    p.name,
    p.alias,
    p.avatar_url,
    p.bio,
    p.age,

    case
      when visibility.search_visible
        then p.seeking
      else null
    end as seeking,

    case
      when visibility.search_visible
        then p.zones
      else null
    end as zones,

    case
      when visibility.budget_visible
        then p.budget_min
      else null
    end as budget_min,

    case
      when visibility.budget_visible
        then p.budget_max
      else null
    end as budget_max,

    case
      when visibility.search_visible
        then p.move_in_date
      else null
    end as move_in_date,

    -- Legacy traits are not equivalent to DNA V2 living answers.
    -- Never expose V2 living signals through the legacy field.
    case when visibility.living_visible and (dna.model_version is distinct from 2)
      then p.traits else null end as traits,

    -- Only the user's chosen public interest categories; no full DNA payload.
    case when dna.model_version = 2 then
      case when jsonb_typeof(dna.answers -> 'world_interests') = 'array'
        then array(
          select distinct item.value
          from jsonb_array_elements_text(dna.answers -> 'world_interests')
            with ordinality as item(value, position)
          where item.value = any(array[
            'sport','music','food','travel','nightlife','cinema',
            'gaming','art','reading','nature','fashion','pets'
          ])
          order by item.value
        )
        else array[]::text[] end
      else p.interests
    end as interests,

    visibility.viewer_scope

  from public.profiles p

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

  left join public.rooms_dna dna
    on dna.user_id = p.id

  cross join lateral (
    select

      case
        when exists (
          select 1
          from public.connections c
          where c.status = 'accepted'
            and (
              (
                c.requester_id = auth.uid()
                and c.recipient_id = p.id
              )
              or
              (
                c.requester_id = p.id
                and c.recipient_id = auth.uid()
              )
            )
        )
        then 'connection'
        else 'public'
      end as viewer_scope,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'search',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'search',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as search_visible,

      (
        coalesce(pref.answers -> 'privacy' -> 'controls' ->> 'living', 'private') = 'public'
        or (
          coalesce(pref.answers -> 'privacy' -> 'controls' ->> 'living', 'private') = 'connections'
          and exists (
            select 1 from public.connections c
            where c.status = 'accepted'
              and ((c.requester_id = auth.uid() and c.recipient_id = p.id)
                or (c.requester_id = p.id and c.recipient_id = auth.uid()))
          )
        )
      ) as living_visible,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'budget',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'budget',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as budget_visible

  ) visibility

  where
    p.onboarding_completed = true

    and p.id <> auth.uid()

    and not public.users_are_blocked(
      auth.uid(),
      p.id
    )

    and (
      _target_user_id is null
      or p.id = _target_user_id
    );

$function$;

revoke all on function public.get_visible_profiles_v2(uuid) from public, anon;
grant execute on function public.get_visible_profiles_v2(uuid) to authenticated;

-- Revoke the legacy definer RPC; it returned unfiltered p.traits.
revoke all on function public.get_visible_profiles(uuid) from public, anon, authenticated;



\echo === 11/41 20261014203000_legacy_visible_profiles_privacy.sql ===
-- Compatibility security patch for existing frontend.
-- Keeps get_visible_profiles(uuid) signature and original 13 output columns.
-- Restricts legacy traits by living privacy (defaults private).
-- Supersedes legacy behavior without revoking EXECUTE for existing clients.
-- Install manually after review; do not run db push on out-of-sync history.
create or replace function public.get_visible_profiles(
  _target_user_id uuid default null::uuid
)
returns table(
  id uuid,
  name text,
  alias text,
  avatar_url text,
  bio text,
  age integer,
  seeking text[],
  zones text[],
  budget_min integer,
  budget_max integer,
  move_in_date date,
  traits text[],
  viewer_scope text
)
language sql
security definer
set search_path = public, pg_temp
as $function$

  select
    p.id,
    p.name,
    p.alias,
    p.avatar_url,
    p.bio,
    p.age,

    case
      when visibility.search_visible
        then p.seeking
      else null
    end as seeking,

    case
      when visibility.search_visible
        then p.zones
      else null
    end as zones,

    case
      when visibility.budget_visible
        then p.budget_min
      else null
    end as budget_min,

    case
      when visibility.budget_visible
        then p.budget_max
      else null
    end as budget_max,

    case
      when visibility.search_visible
        then p.move_in_date
      else null
    end as move_in_date,

    -- Legacy traits are not equivalent to DNA V2 living answers.
    -- Never expose V2 living signals through the legacy field.
    case when visibility.living_visible and (dna.model_version is distinct from 2)
      then p.traits else null end as traits,

    visibility.viewer_scope

  from public.profiles p

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

  left join public.rooms_dna dna
    on dna.user_id = p.id

  cross join lateral (
    select

      case
        when exists (
          select 1
          from public.connections c
          where c.status = 'accepted'
            and (
              (
                c.requester_id = auth.uid()
                and c.recipient_id = p.id
              )
              or
              (
                c.requester_id = p.id
                and c.recipient_id = auth.uid()
              )
            )
        )
        then 'connection'
        else 'public'
      end as viewer_scope,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'search',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'search',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as search_visible,

      (
        coalesce(pref.answers -> 'privacy' -> 'controls' ->> 'living', 'private') = 'public'
        or (
          coalesce(pref.answers -> 'privacy' -> 'controls' ->> 'living', 'private') = 'connections'
          and exists (
            select 1 from public.connections c
            where c.status = 'accepted'
              and ((c.requester_id = auth.uid() and c.recipient_id = p.id)
                or (c.requester_id = p.id and c.recipient_id = auth.uid()))
          )
        )
      ) as living_visible,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'budget',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'budget',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as budget_visible

  ) visibility

  where
    p.onboarding_completed = true

    and p.id <> auth.uid()

    and not public.users_are_blocked(
      auth.uid(),
      p.id
    )

    and (
      _target_user_id is null
      or p.id = _target_user_id
    );

$function$;

revoke all on function public.get_visible_profiles(uuid) from public, anon;
grant execute on function public.get_visible_profiles(uuid) to authenticated;



\echo === 12/41 20261014_household_owner_membership.sql ===
-- Permite al propietario crear su membresia inicial.

DROP POLICY IF EXISTS "Propietario crea su membresia"
ON public.household_members;

CREATE POLICY "Propietario crea su membresia"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND role = 'owner'
  AND status = 'accepted'
  AND EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_id
      AND h.owner_id = (SELECT auth.uid())
  )
);



\echo === 13/41 20261014_update_profile_interests_v2.sql ===
-- Apply manually only after approval; no db push.
-- Safe because world_interests options have no dimensional signals in DNA V2.
-- Server owns interest categories and legacy mirror; never accepts derived DNA from client.
create or replace function public.update_profile_interests_v2(
  p_expected_revision bigint,
  p_interests jsonb,
  p_name text,
  p_age integer,
  p_bio text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_current public.rooms_dna%rowtype;
  v_dna public.rooms_dna%rowtype;
  v_profile public.profiles%rowtype;
  v_count integer;
  v_legacy text[];
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if jsonb_typeof(p_interests) is distinct from 'array' or
     jsonb_array_length(p_interests) > 5 then
    raise exception 'Invalid interests selection' using errcode = '22023';
  end if;
  select count(*) into v_count
    from jsonb_array_elements(p_interests) as e(value)
   where jsonb_typeof(e.value) is distinct from 'string'
      or not (e.value #>> '{}' = any(array[
        'sport','music','food','travel','nightlife','cinema','gaming',
        'art','reading','nature','fashion','pets'
      ]));
  if v_count <> 0 or (
    select count(*) from (select distinct value from jsonb_array_elements(p_interests)) t
  ) <> jsonb_array_length(p_interests) then
    raise exception 'Invalid interests selection' using errcode = '22023';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(p_name) > 40
     or char_length(coalesce(p_bio,'')) > 500
     or (p_age is not null and (p_age < 18 or p_age > 99)) then
    raise exception 'Invalid profile fields' using errcode = '22023';
  end if;

  -- Lock serializes same-user edits; reject stale writers before modifying either table.
  select * into v_current from public.rooms_dna
   where user_id = v_uid for update;
  if not found or v_current.model_version <> 2 or
     v_current.revision <> p_expected_revision then
    raise exception 'DNA revision conflict' using errcode = '40001';
  end if;
  if jsonb_typeof(v_current.answers) is distinct from 'object' or
     jsonb_typeof(v_current.categories) is distinct from 'object' then
    raise exception 'DNA data not compatible' using errcode = '22023';
  end if;

  -- The server derives both projections from the validated canonical selection.
  select coalesce(array_agg(
    case e.value #>> '{}'
      when 'food' then 'cooking'
      when 'nightlife' then 'going-out'
      else e.value #>> '{}'
    end order by e.ordinality
  ) filter (where e.value #>> '{}' = any(array[
    'sport','music','food','travel','nightlife','gaming','reading','pets'
  ])), array[]::text[]) into v_legacy
  from jsonb_array_elements(p_interests) with ordinality e(value, ordinality);

  update public.rooms_dna set
    answers = jsonb_set(v_current.answers, '{world_interests}', p_interests, true),
    categories = jsonb_set(v_current.categories, '{interests}', p_interests, true),
    calculated_at = clock_timestamp()
  where user_id = v_uid
  returning * into v_dna;

  update public.profiles set
    name = btrim(p_name), alias = btrim(p_name), age = p_age,
    bio = coalesce(p_bio,''), interests = v_legacy
  where id = v_uid
  returning * into v_profile;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('dna', to_jsonb(v_dna), 'profile', to_jsonb(v_profile));
end;
$function$;

revoke all on function public.update_profile_interests_v2(
  bigint, jsonb, text, integer, text
) from public, anon;
grant execute on function public.update_profile_interests_v2(
  bigint, jsonb, text, integer, text
) to authenticated;



\echo === 14/41 20261015_private_living_default.sql ===
-- ROOMS DNA V2: convivencia privada por defecto.
-- Conserva las preferencias explicitas del usuario.

-- QA: limite transaccional externo

DO $$
DECLARE
  definition text;
  living_section text;
  living_start integer;
  search_start integer;
BEGIN
  definition := pg_get_functiondef(
    'public.get_profile_visibility(uuid)'::regprocedure
  );

  living_start := strpos(definition, '  living_scope :=');
  search_start := strpos(definition, '  search_scope :=');

  IF living_start = 0 OR search_start <= living_start THEN
    RAISE EXCEPTION 'Estructura inesperada. Sin cambios.';
  END IF;

  living_section := substring(
    definition FROM living_start
    FOR search_start - living_start
  );

  IF living_section NOT LIKE '%else ''public''%' THEN
    IF living_section LIKE '%else ''private''%' THEN
      RAISE NOTICE 'Privacidad por defecto ya corregida.';
      RETURN;
    END IF;

    RAISE EXCEPTION 'Valor inesperado. Sin cambios.';
  END IF;

  definition :=
    left(definition, living_start - 1)
    || replace(
      living_section,
      'else ''public''',
      'else ''private'''
    )
    || substring(definition FROM search_start);

  EXECUTE definition;
END;
$$;

-- QA: limite transaccional externo



\echo === M5.48 INICIALIZACION AUTH ===

-- ROOMS M5.48 - BORRADOR. NO INSTALAR EN PRODUCCION.
-- Inicializacion minima de perfil y rol al crear auth.users.
-- El onboarding completa posteriormente el perfil.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_name text;
BEGIN
  v_name := nullif(
    left(
      btrim(coalesce(NEW.raw_user_meta_data ->> 'name', '')),
      100
    ),
    ''
  );

  INSERT INTO public.profiles (id, name, alias)
  VALUES (NEW.id, v_name, v_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_default_user_role()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rooms_initialize_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER rooms_create_default_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_default_user_role();

\echo === 15/41 20261019120000_restrict_internal_trigger_execution.sql ===
-- ROOMS: restringir ejecucion directa de funciones internas.
-- Estos triggers se ejecutan por PostgreSQL, no mediante llamadas RPC.
-- Cambio aplicado y verificado previamente en Supabase.

revoke execute on function public.add_community_owner()
from public, anon, authenticated;


DO $qa_guard$
BEGIN
  IF to_regprocedure('public.create_default_user_role()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_default_user_role() FROM public, anon, authenticated';
  ELSE
    RAISE NOTICE 'QA: funcion ausente public.create_default_user_role()';
  END IF;
END
$qa_guard$;



DO $qa_guard$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated';
  ELSE
    RAISE NOTICE 'QA: funcion ausente public.handle_new_user()';
  END IF;
END
$qa_guard$;


revoke execute on function public.validate_household_candidate_vote()
from public, anon, authenticated;




-- QA: permiso minimo ausente del baseline historico
GRANT UPDATE (read_at)
ON TABLE public.messages
TO authenticated;

\echo === 16/41 20261020121500_restrict_message_insert_metadata.sql ===
-- ROOMS: restringir metadatos de mensajes.
-- Aplicacion manual tras revision. No db push.
--
-- Solo se permite INSERT de sender_id, recipient_id y body.
-- created_at utiliza DEFAULT now().
-- read_at utiliza DEFAULT NULL.
-- UPDATE(read_at) y las politicas RLS se conservan.

-- QA: limite transaccional externo

-- Retirar permisos generales y especificos heredados
-- para el rol authenticated.
REVOKE INSERT ON TABLE public.messages
FROM authenticated;

REVOKE INSERT (created_at, read_at)
ON TABLE public.messages
FROM authenticated;

-- Conceder exclusivamente las columnas necesarias.
GRANT INSERT (sender_id, recipient_id, body)
ON TABLE public.messages
TO authenticated;

-- Verificar privilegios efectivos antes del COMMIT.
DO $$
BEGIN
  IF has_table_privilege(
    'authenticated', 'public.messages', 'INSERT'
  ) OR has_column_privilege(
    'authenticated', 'public.messages', 'created_at', 'INSERT'
  ) OR has_column_privilege(
    'authenticated', 'public.messages', 'read_at', 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Persisten permisos de INSERT no autorizados';
  END IF;

  IF NOT (
    has_column_privilege(
      'authenticated', 'public.messages', 'sender_id', 'INSERT'
    )
    AND has_column_privilege(
      'authenticated', 'public.messages', 'recipient_id', 'INSERT'
    )
    AND has_column_privilege(
      'authenticated', 'public.messages', 'body', 'INSERT'
    )
    AND has_column_privilege(
      'authenticated', 'public.messages', 'read_at', 'UPDATE'
    )
  ) THEN
    RAISE EXCEPTION 'Faltan permisos necesarios para mensajeria';
  END IF;
END;
$$;

-- QA: limite transaccional externo



\echo === 17/41 20261020_account_deletion_requests.sql ===
-- ROOMS M4
-- Solicitudes autenticadas de eliminación de cuenta.
-- No elimina cuentas ni archivos automáticamente.

create table if not exists public.account_deletion_requests (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'rejected'))
);

alter table public.account_deletion_requests
  enable row level security;

drop policy if exists
  "account_deletion_requests_select_own"
  on public.account_deletion_requests;

create policy "account_deletion_requests_select_own"
on public.account_deletion_requests
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists
  "account_deletion_requests_insert_own"
  on public.account_deletion_requests;

create policy "account_deletion_requests_insert_own"
on public.account_deletion_requests
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

revoke all on public.account_deletion_requests
  from public, anon, authenticated;

grant select (user_id, requested_at, status)
on public.account_deletion_requests
to authenticated;

grant insert (user_id)
on public.account_deletion_requests
to authenticated;

comment on table public.account_deletion_requests is
  'Solicitudes de supresion de cuentas ROOMS. La ejecucion requiere gestion autorizada.';



\echo === 18/41 20261021_account_deletion_audit.sql ===
-- ROOMS M4: evidencia administrativa de bajas.
-- NO ejecuta eliminaciones.
-- NO modifica auth.users ni las tablas de usuarios.
-- Pendiente de definir politica de conservacion antes de uso real.

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  target_user_id uuid NOT NULL,
  operator_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'failed')),

  storage_verified boolean NOT NULL DEFAULT false,
  auth_verified boolean NOT NULL DEFAULT false,
  database_verified boolean NOT NULL DEFAULT false,
  shared_impact_verified boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,

  CONSTRAINT account_deletion_completed_verified
    CHECK (
      status <> 'completed'
      OR (
        storage_verified
        AND auth_verified
        AND database_verified
        AND shared_impact_verified
        AND finished_at IS NOT NULL
      )
    )
);

-- No FK a auth.users: el registro debe sobrevivir a la baja.

ALTER TABLE public.account_deletion_audit
  ENABLE ROW LEVEL SECURITY;

-- Solo backend administrativo autorizado.
-- No crear politicas para anon ni authenticated.

REVOKE ALL ON public.account_deletion_audit
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.account_deletion_audit IS
  'Evidencia administrativa restringida de bajas de ROOMS. '
  'Retencion pendiente de validacion legal.';



\echo === 33/41 20261021_legal_acceptances.sql ===
-- ROOMS: registro versionado de aceptaciones legales.
-- No activa el registro de usuarios ni publica documentos.

create table if not exists public.legal_document_versions (
  document_type text not null
    check (document_type in ('terms', 'privacy')),
  version text not null
    check (length(version) between 1 and 60),
  published_at timestamptz,
  primary key (document_type, version)
);

create table if not exists public.legal_acceptances (
  user_id uuid not null
    references auth.users(id) on delete cascade,
  document_type text not null
    check (document_type = 'terms'),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_type, version),
  foreign key (document_type, version)
    references public.legal_document_versions
      (document_type, version)
);

alter table public.legal_document_versions
  enable row level security;

alter table public.legal_acceptances
  enable row level security;

revoke all on public.legal_document_versions
  from public, anon, authenticated;

revoke all on public.legal_acceptances
  from public, anon, authenticated;

grant select on public.legal_document_versions
  to anon, authenticated;

grant select on public.legal_acceptances
  to authenticated;

create policy "Published legal versions are readable"
on public.legal_document_versions
for select
to anon, authenticated
using (published_at is not null);

create policy "Users read own legal acceptances"
on public.legal_acceptances
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.record_terms_acceptance(
  p_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.legal_document_versions
    where document_type = 'terms'
      and version = p_version
      and published_at is not null
  ) then
    raise exception 'Terms version not published';
  end if;

  insert into public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  values (
    v_user_id,
    'terms',
    p_version,
    now()
  )
  on conflict (user_id, document_type, version)
    do nothing;
end;
$$;

revoke all on function public.record_terms_acceptance(text)
  from public, anon;

grant execute on function
  public.record_terms_acceptance(text)
  to authenticated;




\echo === 19/41 20261021_admin_account_inventory_read.sql ===
-- ROOMS M4: permisos de lectura administrativa
-- aplicados previamente en Supabase SQL Editor.
-- Sin cambios en RLS ni permisos de usuarios normales.

GRANT SELECT ON TABLE
  public.account_deletion_requests,
  public.connections,
  public.legal_acceptances,
  public.match_preferences,
  public.messages,
  public.reports,
  public.rooms_dna,
  public.saved_collections,
  public.saved_items,
  public.user_intents
TO service_role;



\echo === 20/41 20261021_admin_attest_shared_impact.sql ===
-- ROOMS M4: evidencia previa de impacto compartido.
-- Aplicada previamente en Supabase SQL Editor.
-- No reclama auditorias ni elimina datos.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_admin_attest_shared_impact(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_rel record;
  v_count integer := 0;
  v_profiles integer := 0;
  v_roles integer := 0;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.id = p_audit_id
      AND a.target_user_id = p_target_id
      AND a.claim_token = p_claim_token
      AND a.status = 'processing'
      AND a.finished_at IS NULL
      AND a.shared_impact_verified = false
  ) THEN
    RAISE EXCEPTION 'Reclamacion incompatible';
  END IF;

  FOR v_rel IN
    SELECT *
    FROM public.rooms_admin_user_fk_inventory(
      p_target_id
    )
  LOOP
    v_count := v_count + 1;

    IF v_rel.tabla = 'profiles'
       AND v_rel.columna = 'id'
       AND v_rel.referencia = 'auth.users' THEN

      IF v_rel.registros <> 1 THEN
        RAISE EXCEPTION 'Perfil inesperado';
      END IF;

      v_profiles := v_profiles + 1;

    ELSIF v_rel.tabla = 'user_roles'
       AND v_rel.columna = 'user_id'
       AND v_rel.referencia = 'auth.users' THEN

      IF v_rel.registros <> 1 THEN
        RAISE EXCEPTION 'Rol inesperado';
      END IF;

      v_roles := v_roles + 1;

    ELSIF v_rel.registros <> 0 THEN

      RAISE EXCEPTION
        'Dependencia existente en %.%',
        v_rel.tabla,
        v_rel.columna;

    END IF;
  END LOOP;

  IF v_count < 35
     OR v_profiles <> 1
     OR v_roles <> 1 THEN
    RAISE EXCEPTION
      'Inventario incompleto o estructura inesperada';
  END IF;

  UPDATE public.account_deletion_audit a
  SET shared_impact_verified = true
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.claim_token = p_claim_token
    AND a.status = 'processing'
    AND a.finished_at IS NULL
    AND a.shared_impact_verified = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo registrar la evidencia';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_attest_shared_impact(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_attest_shared_impact(uuid,uuid,uuid)
TO service_role;

-- QA: limite transaccional externo



\echo === 21/41 20261021_admin_complete_deleted_account_disabled.sql ===
-- ROOMS M4: cierre administrativo deliberadamente deshabilitado.
-- Aplicado y verificado previamente en Supabase.
-- No ejecuta bajas ni completa auditorias.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_admin_complete_deleted_account(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  fk record;
  v_count bigint;
  v_checked integer := 0;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  PERFORM 1
  FROM public.account_deletion_audit a
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.claim_token = p_claim_token
    AND a.status = 'processing'
    AND a.finished_at IS NULL
    AND a.shared_impact_verified = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auditoria no autorizada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_target_id
  ) THEN
    RAISE EXCEPTION 'Auth todavia contiene la cuenta';
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS esquema,
      t.relname AS tabla,
      a.attname AS columna,
      cardinality(c.conkey) AS columnas_fk,
      a.atttypid AS tipo_columna
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.confrelid IN (
        'auth.users'::regclass,
        'public.profiles'::regclass
      )
  LOOP
    IF fk.columnas_fk <> 1
       OR fk.columna IS NULL
       OR fk.tipo_columna <> 'uuid'::regtype THEN
      RAISE EXCEPTION 'FK no soportada';
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      fk.esquema, fk.tabla, fk.columna
    )
    INTO v_count
    USING p_target_id;

    IF v_count <> 0 THEN
      RAISE EXCEPTION
        'Persisten registros en %.%',
        fk.tabla, fk.columna;
    END IF;

    v_checked := v_checked + 1;
  END LOOP;

  IF v_checked < 35 THEN
    RAISE EXCEPTION 'Cobertura FK insuficiente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.owner = p_target_id
       OR o.owner_id = p_target_id::text
       OR o.name LIKE p_target_id::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Persisten archivos en Storage';
  END IF;

  -- Bloqueo deliberado: falta evidencia independiente
  -- de la API de Storage y proteccion de concurrencia.
  RAISE EXCEPTION
    'Cierre deshabilitado: falta evidencia API Storage';
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_complete_deleted_account(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated, service_role;

-- QA: limite transaccional externo



\echo === 22/41 20261021_admin_deletion_audit_permissions.sql ===
-- ROOMS M4 - Permisos administrativos de auditoria
-- Aplicados previamente en Supabase SQL Editor.
-- No modifica usuarios ni ejecuta eliminaciones.

REVOKE ALL ON TABLE public.account_deletion_audit
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.account_deletion_audit
TO service_role;

REVOKE DELETE
ON TABLE public.account_deletion_audit
FROM service_role;



\echo === 23/41 20261021_admin_deletion_claim.sql ===
-- ROOMS M4: control de concurrencia en bajas administrativas.
-- Aplicado y comprobado previamente en Supabase SQL Editor.
-- No reclama auditorias ni elimina cuentas.

-- QA: limite transaccional externo

ALTER TABLE public.account_deletion_audit
  DROP CONSTRAINT IF EXISTS account_deletion_audit_status_check;

ALTER TABLE public.account_deletion_audit
  ADD CONSTRAINT account_deletion_audit_status_check
  CHECK (
    status IN ('started', 'processing', 'completed', 'failed')
  );

CREATE UNIQUE INDEX IF NOT EXISTS
  account_deletion_one_active_per_user
ON public.account_deletion_audit (target_user_id)
WHERE status IN ('started', 'processing');

ALTER TABLE public.account_deletion_audit
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.account_deletion_audit
  DROP CONSTRAINT IF EXISTS account_deletion_processing_claim_check;

ALTER TABLE public.account_deletion_audit
  ADD CONSTRAINT account_deletion_processing_claim_check
  CHECK (
    status <> 'processing'
    OR (claim_token IS NOT NULL AND claimed_at IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION
  public.rooms_admin_claim_disposable_deletion(
    p_audit_id uuid,
    p_target_id uuid
  )
RETURNS TABLE (
  audit_id uuid,
  execution_token uuid,
  claimed_timestamp timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_audit_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  RETURN QUERY
  UPDATE public.account_deletion_audit a
  SET
    status = 'processing',
    claim_token = gen_random_uuid(),
    claimed_at = clock_timestamp()
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.status = 'started'
    AND a.finished_at IS NULL
    AND a.claim_token IS NULL
    AND a.storage_verified = false
    AND a.auth_verified = false
    AND a.database_verified = false
    AND a.shared_impact_verified = false
  RETURNING
    a.id,
    a.claim_token,
    a.claimed_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Auditoria ya reclamada o estado incompatible';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_claim_disposable_deletion(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_claim_disposable_deletion(uuid, uuid)
TO service_role;

-- QA: limite transaccional externo



\echo === 24/41 20261021_admin_household_read.sql ===
-- ROOMS M4
-- Permisos de lectura para inspeccion administrativa.
-- Aplicado previamente en Supabase SQL Editor.
-- No concede acceso a anon ni authenticated.

GRANT SELECT ON TABLE
  public.households,
  public.household_members
TO service_role;



\echo === 25/41 20261021_admin_mark_deletion_failed.sql ===
-- ROOMS M4: cierre controlado de auditorias fallidas.
-- Aplicado y verificado previamente en Supabase.
-- No elimina cuentas ni ejecuta la funcion.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_admin_mark_deletion_failed(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  UPDATE public.account_deletion_audit a
  SET
    status = 'failed',
    finished_at = clock_timestamp()
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.claim_token = p_claim_token
    AND a.status = 'processing'
    AND a.finished_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 1 THEN
    RAISE EXCEPTION
      'Auditoria no reclamada por esta ejecucion';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_mark_deletion_failed(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_mark_deletion_failed(uuid,uuid,uuid)
TO service_role;

REVOKE UPDATE
ON TABLE public.account_deletion_audit
FROM service_role;

-- QA: limite transaccional externo



\echo === 26/41 20261021_admin_shared_dependencies_read.sql ===
-- ROOMS M4: lectura administrativa de dependencias indirectas.
-- Permisos aplicados previamente mediante Supabase SQL Editor.
-- Sin cambios en RLS ni permisos de usuarios normales.

GRANT SELECT ON TABLE
  public.household_person_candidates,
  public.listing_private_locations
TO service_role;



\echo === 27/41 20261021_admin_storage_inventory.sql ===
-- ROOMS M4: inventario integral de Storage previo a una baja.
-- Ya instalado y comprobado en Supabase SQL Editor.
-- Exclusivamente lectura.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_admin_storage_inventory(p_target_id uuid)
RETURNS TABLE (
  archivos_encontrados bigint,
  por_owner bigint,
  por_owner_id bigint,
  por_ruta bigint,
  fuera_de_buckets_previstos bigint,
  buckets_afectados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'UUID requerido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(*) FILTER (
      WHERE o.owner = p_target_id
    )::bigint,
    count(*) FILTER (
      WHERE o.owner_id = p_target_id::text
    )::bigint,
    count(*) FILTER (
      WHERE o.name LIKE p_target_id::text || '/%'
    )::bigint,
    count(*) FILTER (
      WHERE o.bucket_id NOT IN (
        'avatars',
        'listing-images',
        'community-images',
        'community-post-media'
      )
    )::bigint,
    count(DISTINCT o.bucket_id)::bigint
  FROM storage.objects o
  WHERE
    o.owner = p_target_id
    OR o.owner_id = p_target_id::text
    OR o.name LIKE p_target_id::text || '/%';
END;
$$;

REVOKE ALL
ON FUNCTION public.rooms_admin_storage_inventory(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.rooms_admin_storage_inventory(uuid)
TO service_role;

-- QA: limite transaccional externo



\echo === 28/41 20261021_admin_user_fk_inventory.sql ===
-- ROOMS M4: inventario dinamico de FK de usuarios.
-- Funcion aplicada y comprobada en Supabase SQL Editor.
-- No elimina ni modifica registros.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION public.rooms_admin_user_fk_inventory(
  target_user_id uuid
)
RETURNS TABLE (
  tabla text,
  columna text,
  referencia text,
  registros bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  fk record;
  total bigint;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'UUID requerido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = target_user_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS esquema,
      t.relname AS nombre_tabla,
      a.attname AS nombre_columna,
      c.confrelid::regclass::text AS destino,
      cardinality(c.conkey) AS numero_columnas,
      a.atttypid AS tipo_columna
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t
      ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n
      ON n.oid = t.relnamespace
    LEFT JOIN pg_catalog.pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.confrelid IN (
        'auth.users'::regclass,
        'public.profiles'::regclass
      )
    ORDER BY n.nspname, t.relname, a.attname
  LOOP
    IF fk.numero_columnas <> 1
       OR fk.nombre_columna IS NULL
       OR fk.tipo_columna <> 'uuid'::regtype THEN
      RAISE EXCEPTION
        'Relacion no soportada: %.%',
        fk.nombre_tabla,
        fk.nombre_columna;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      fk.esquema,
      fk.nombre_tabla,
      fk.nombre_columna
    )
    INTO total
    USING target_user_id;

    tabla := fk.nombre_tabla;
    columna := fk.nombre_columna;
    referencia := fk.destino;
    registros := total;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_user_fk_inventory(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_user_fk_inventory(uuid)
TO service_role;

-- QA: limite transaccional externo



\echo === 29/41 20261021_admin_user_roles_read.sql ===
-- ROOMS M4: lectura administrativa de roles.
-- Permiso ya aplicado en Supabase SQL Editor.
-- No modifica registros ni concede acceso publico.

GRANT SELECT ON TABLE public.user_roles TO service_role;



\echo === 30/41 20261021_admin_verify_deleted_storage.sql ===
-- ROOMS M4: verificacion posterior de Storage.
-- Instalada previamente mediante Supabase SQL Editor.
-- No borra archivos, usuarios ni actualiza auditorias.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_admin_verify_deleted_storage(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS TABLE (
  archivos_restantes bigint,
  por_owner bigint,
  por_owner_id bigint,
  por_ruta bigint,
  fuera_de_buckets_previstos bigint,
  buckets_afectados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.id = p_audit_id
      AND a.target_user_id = p_target_id
      AND a.claim_token = p_claim_token
      AND a.status = 'processing'
      AND a.finished_at IS NULL
      AND a.shared_impact_verified = true
  ) THEN
    RAISE EXCEPTION 'Ejecucion administrativa no autorizada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
  ) THEN
    RAISE EXCEPTION 'La cuenta sigue existiendo en Auth';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,

    count(*) FILTER (
      WHERE o.owner = p_target_id
    )::bigint,

    count(*) FILTER (
      WHERE o.owner_id = p_target_id::text
    )::bigint,

    count(*) FILTER (
      WHERE o.name LIKE p_target_id::text || '/%'
    )::bigint,

    count(*) FILTER (
      WHERE o.bucket_id NOT IN (
        'avatars',
        'listing-images',
        'community-images',
        'community-post-media'
      )
    )::bigint,

    count(DISTINCT o.bucket_id)::bigint

  FROM storage.objects o
  WHERE
    o.owner = p_target_id
    OR o.owner_id = p_target_id::text
    OR o.name LIKE p_target_id::text || '/%';
END;
$$;

REVOKE ALL
ON FUNCTION
  public.rooms_admin_verify_deleted_storage(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION
  public.rooms_admin_verify_deleted_storage(uuid,uuid,uuid)
TO service_role;

-- QA: limite transaccional externo



\echo === 31/41 20261021_admin_verify_deleted_user.sql ===
-- ROOMS M4: verificacion administrativa posterior a una baja.
-- Ya instalada mediante Supabase SQL Editor.
-- No elimina cuentas ni modifica auditorias.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_admin_verify_deleted_user(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS TABLE (
  auth_absent boolean,
  fk_relations_checked integer,
  remaining_fk_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  fk record;
  v_count bigint;
  v_checked integer := 0;
  v_remaining bigint := 0;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.id = p_audit_id
      AND a.target_user_id = p_target_id
      AND a.claim_token = p_claim_token
      AND a.status = 'processing'
      AND a.finished_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ejecucion administrativa no autorizada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
  ) THEN
    RAISE EXCEPTION 'La cuenta sigue existiendo en Auth';
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      t.relname AS table_name,
      a.attname AS column_name,
      cardinality(c.conkey) AS column_count,
      a.atttypid AS column_type
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t
      ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n
      ON n.oid = t.relnamespace
    LEFT JOIN pg_catalog.pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.confrelid IN (
        'auth.users'::regclass,
        'public.profiles'::regclass
      )
  LOOP
    IF fk.column_count <> 1
       OR fk.column_name IS NULL
       OR fk.column_type <> 'uuid'::regtype THEN
      RAISE EXCEPTION
        'Relacion FK no soportada: %.%',
        fk.table_name,
        fk.column_name;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      fk.schema_name,
      fk.table_name,
      fk.column_name
    )
    INTO v_count
    USING p_target_id;

    v_checked := v_checked + 1;
    v_remaining := v_remaining + v_count;
  END LOOP;

  IF v_checked < 35 THEN
    RAISE EXCEPTION 'Cobertura FK inferior a la validada';
  END IF;

  auth_absent := true;
  fk_relations_checked := v_checked;
  remaining_fk_rows := v_remaining;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_verify_deleted_user(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_verify_deleted_user(uuid, uuid, uuid)
TO service_role;

-- QA: limite transaccional externo



\echo === 32/41 20261021_current_legal_terms.sql ===
-- ROOMS: una sola version vigente de condiciones.
-- No publica documentos ni abre el registro.

ALTER TABLE public.legal_document_versions
ADD COLUMN IF NOT EXISTS is_current boolean
NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS
  legal_document_versions_one_current
ON public.legal_document_versions(document_type)
WHERE is_current = true;

ALTER TABLE public.legal_document_versions
DROP CONSTRAINT IF EXISTS
  legal_document_versions_current_requires_publication;

ALTER TABLE public.legal_document_versions
ADD CONSTRAINT
  legal_document_versions_current_requires_publication
CHECK (
  is_current = false
  OR published_at IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  p_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.legal_document_versions
    WHERE document_type = 'terms'
      AND version = p_version
      AND published_at IS NOT NULL
      AND is_current = true
  ) THEN
    RAISE EXCEPTION 'Terms version not current';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  VALUES (
    v_user_id,
    'terms',
    p_version,
    now()
  )
  ON CONFLICT (user_id, document_type, version)
    DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION
  public.record_terms_acceptance(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.record_terms_acceptance(text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_signup_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version text;
  v_current_version text;
BEGIN
  SELECT version
  INTO v_current_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  -- Ninguna version vigente: beta aun sin activar.
  IF v_current_version IS NULL THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.raw_user_meta_data -> 'rooms_terms_accepted'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Terms acceptance required';
  END IF;

  v_version :=
    NEW.raw_user_meta_data ->> 'rooms_terms_version';

  IF v_version IS DISTINCT FROM v_current_version THEN
    RAISE EXCEPTION 'Terms version not current';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  VALUES (
    NEW.id,
    'terms',
    v_version,
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.capture_signup_terms_acceptance()
FROM PUBLIC, anon, authenticated;



\echo === 34/41 20261021_legal_document_urls.sql ===
-- ROOMS: asociar cada version legal publicada
-- con una URL y una huella del documento.
-- No publica ni activa ninguna version.

ALTER TABLE public.legal_document_versions
ADD COLUMN IF NOT EXISTS document_url text;

ALTER TABLE public.legal_document_versions
ADD COLUMN IF NOT EXISTS document_sha256 text;

ALTER TABLE public.legal_document_versions
ADD CONSTRAINT legal_document_url_required_when_published
CHECK (
  published_at IS NULL
  OR (
    document_url IS NOT NULL
    AND document_url ~ '^https://'
    AND length(document_url) <= 2000
  )
);

ALTER TABLE public.legal_document_versions
ADD CONSTRAINT legal_document_hash_required_when_published
CHECK (
  published_at IS NULL
  OR (
    document_sha256 IS NOT NULL
    AND document_sha256 ~ '^[0-9a-f]{64}$'
  )
);



\echo === 35/41 20261021_signup_adult_guard.sql ===
-- ROOMS: exigir declaracion 18+ y condiciones vigentes
-- durante el alta de usuarios.
--
-- No publica condiciones ni activa el registro.
-- Mientras no exista una version vigente de condiciones,
-- las cuentas QA administrativas pueden seguir creandose.
--
-- IMPORTANTE: la declaracion de edad es autodeclarada,
-- no una comprobacion documental independiente.

CREATE OR REPLACE FUNCTION public.capture_signup_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version text;
  v_current_version text;
BEGIN
  SELECT version
  INTO v_current_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  -- El lanzamiento no se activa desde esta migracion.
  IF v_current_version IS NULL THEN
    RETURN NEW;
  END IF;

  -- Comprobacion de la declaracion 18+.
  IF (
    NEW.raw_user_meta_data -> 'rooms_age_18_confirmed'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Adult declaration required';
  END IF;

  -- Aceptacion expresa de condiciones.
  IF (
    NEW.raw_user_meta_data -> 'rooms_terms_accepted'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Terms acceptance required';
  END IF;

  v_version :=
    NEW.raw_user_meta_data ->> 'rooms_terms_version';

  IF v_version IS DISTINCT FROM v_current_version THEN
    RAISE EXCEPTION 'Terms version not current';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  VALUES (
    NEW.id,
    'terms',
    v_version,
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.capture_signup_terms_acceptance()
FROM PUBLIC, anon, authenticated;



\echo === 36/41 20261021_signup_terms_trigger.sql ===
-- ROOMS: registrar aceptacion durante la creacion de Auth.
-- No publicar versiones ni abrir el registro desde esta migracion.
-- Solo se ejecuta para usuarios creados DESPUES de instalar el trigger.

create or replace function public.capture_signup_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text;
  v_terms_published boolean;
begin
  -- Mientras no existan condiciones publicadas, no hay
  -- aceptacion registrable. Las altas administrativas QA
  -- anteriores al lanzamiento no quedan bloqueadas.
  select exists (
    select 1
    from public.legal_document_versions
    where document_type = 'terms'
      and published_at is not null
  )
  into v_terms_published;

  if not v_terms_published then
    return new;
  end if;

  -- Una vez publicadas condiciones, toda cuenta nueva
  -- debe declarar la aceptacion de una version publicada.
  if (
    new.raw_user_meta_data
      -> 'rooms_terms_accepted'
  ) is distinct from 'true'::jsonb then
    raise exception 'Terms acceptance required';
  end if;

  v_version :=
    new.raw_user_meta_data ->> 'rooms_terms_version';

  if v_version is null or not exists (
    select 1
    from public.legal_document_versions
    where document_type = 'terms'
      and version = v_version
      and published_at is not null
  ) then
    raise exception 'Terms version not published';
  end if;

  insert into public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  values (
    new.id,
    'terms',
    v_version,
    now()
  );

  return new;
end;
$$;

revoke all
on function public.capture_signup_terms_acceptance()
from public, anon, authenticated;

drop trigger if exists rooms_capture_signup_terms
on auth.users;

create trigger rooms_capture_signup_terms
after insert on auth.users
for each row
execute function public.capture_signup_terms_acceptance();



\echo === 37/41 20261023_private_visibility_defaults.sql ===
-- ROOMS M2.1: privacidad conservadora por defecto.
-- Respeta controles explicitos y permisos del propietario.
-- No modifica datos de usuarios.

CREATE OR REPLACE FUNCTION public.get_profile_visibility(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  viewer_id uuid := auth.uid();
  privacy_data jsonb := '{}'::jsonb;
  controls jsonb := '{}'::jsonb;

  viewer_scope text := 'public';

  living_scope text := 'private';
  search_scope text := 'private';
  budget_scope text := 'private';
  activity_scope text := 'private';

  is_connection boolean := false;
begin
  if viewer_id is not null and viewer_id = target_user_id then
    return jsonb_build_object(
      'viewer_scope', 'owner',
      'living', true,
      'search', true,
      'budget', true,
      'activity', true
    );
  end if;

  select
    coalesce(answers -> 'privacy', '{}'::jsonb)
  into privacy_data
  from public.onboarding_preferences
  where user_id = target_user_id
  limit 1;

  controls :=
    coalesce(
      privacy_data -> 'controls',
      '{}'::jsonb
    );

  if viewer_id is not null then
    select exists (
      select 1
      from public.connections
      where status = 'accepted'
        and (
          (
            requester_id = viewer_id
            and recipient_id = target_user_id
          )
          or
          (
            requester_id = target_user_id
            and recipient_id = viewer_id
          )
        )
    )
    into is_connection;
  end if;

  if is_connection then
    viewer_scope := 'connections';
  end if;

  living_scope :=
    case
      when controls ? 'living'
        then controls ->> 'living'
      when controls ? 'habits'
        and (controls ->> 'habits')::boolean = false
        then 'private'
      else 'private'
    end;

  search_scope :=
    case
      when controls ? 'search'
        then controls ->> 'search'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      else 'private'
    end;

  budget_scope :=
    case
      when controls ? 'budget'
        then controls ->> 'budget'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      when privacy_data ->> 'level' = 'private'
        then 'private'
      when privacy_data ->> 'level' = 'balanced'
        then 'connections'
      else 'private'
    end;

  activity_scope :=
    case
      when controls ? 'activity'
        then controls ->> 'activity'
      when controls ? 'posts'
        and (controls ->> 'posts')::boolean = false
        then 'private'
      else 'private'
    end;

  return jsonb_build_object(
    'viewer_scope',
      viewer_scope,

    'living',
      living_scope = 'public'
      or (
        living_scope = 'connections'
        and is_connection
      ),

    'search',
      search_scope = 'public'
      or (
        search_scope = 'connections'
        and is_connection
      ),

    'budget',
      budget_scope = 'public'
      or (
        budget_scope = 'connections'
        and is_connection
      ),

    'activity',
      activity_scope = 'public'
      or (
        activity_scope = 'connections'
        and is_connection
      )
  );
end;
$function$;

revoke all on function public.get_profile_visibility(uuid) from public, anon;
grant execute on function public.get_profile_visibility(uuid) to authenticated;



\echo === M5.40 RPC DE RECUPERACION QA ===
-- ROOMS M5.40
-- BORRADOR: NO APLICAR DIRECTAMENTE EN PRODUCCION.
-- Cuatro RPC que faltan en una instalacion nueva.
-- Revisar y probar en QA antes de convertir en migracion.

-- 1. Consultar invitacion por token.
CREATE OR REPLACE FUNCTION public.get_household_invitation(
  _token uuid
)
RETURNS TABLE (
  household_id uuid,
  household_name text,
  invitation_status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    i.household_id,
    h.name,
    i.status,
    i.expires_at
  FROM public.household_invitations i
  JOIN public.households h
    ON h.id = i.household_id
  WHERE i.token = _token
    AND auth.uid() IS NOT NULL
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION
  public.get_household_invitation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_household_invitation(uuid)
TO authenticated;


-- 2. Aceptar invitacion y crear membresia.
CREATE OR REPLACE FUNCTION public.accept_household_invitation(
  _token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inv public.household_invitations%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_inv
  FROM public.household_invitations
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND
     OR v_inv.status <> 'pending'
     OR v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.households
    WHERE id = v_inv.household_id
      AND owner_id = v_user
  ) THEN
    RAISE EXCEPTION 'Already household owner';
  END IF;

  INSERT INTO public.household_members (
    household_id, user_id, role, status
  )
  VALUES (
    v_inv.household_id, v_user, 'member', 'accepted'
  )
  ON CONFLICT (household_id, user_id)
  DO UPDATE SET
    status = 'accepted'
  WHERE public.household_members.role = 'member';

  UPDATE public.household_invitations
  SET
    status = 'accepted',
    accepted_by = v_user,
    accepted_at = now()
  WHERE id = v_inv.id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.accept_household_invitation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.accept_household_invitation(uuid)
TO authenticated;


-- 3. Obtener exclusivamente los usuarios bloqueados.
CREATE OR REPLACE FUNCTION public.get_blocked_profiles()
RETURNS TABLE (
  id uuid,
  alias text,
  name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    p.id,
    p.alias,
    p.name,
    p.avatar_url
  FROM public.user_blocks b
  JOIN public.profiles p
    ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
    AND auth.uid() IS NOT NULL
  ORDER BY b.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION
  public.get_blocked_profiles()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_blocked_profiles()
TO authenticated;


-- 4. Guardar la ubicacion exacta de un anuncio propio.
CREATE OR REPLACE FUNCTION public.set_listing_private_location(
  target_listing_id uuid,
  target_exact_address text,
  target_exact_latitude double precision,
  target_exact_longitude double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.listings
    WHERE id = target_listing_id
      AND owner_id = v_user
  ) THEN
    RAISE EXCEPTION 'Listing not owned by user';
  END IF;

  IF target_exact_address IS NULL
     OR length(btrim(target_exact_address)) = 0
     OR target_exact_latitude IS NULL
     OR target_exact_longitude IS NULL
     OR NOT isfinite(target_exact_latitude)
     OR NOT isfinite(target_exact_longitude)
     OR target_exact_latitude NOT BETWEEN -90 AND 90
     OR target_exact_longitude NOT BETWEEN -180 AND 180
  THEN
    RAISE EXCEPTION 'Invalid private location';
  END IF;

  INSERT INTO public.listing_private_locations (
    listing_id,
    owner_id,
    exact_address,
    exact_latitude,
    exact_longitude
  )
  VALUES (
    target_listing_id,
    v_user,
    target_exact_address,
    target_exact_latitude,
    target_exact_longitude
  )
  ON CONFLICT (listing_id)
  DO UPDATE SET
    exact_address = EXCLUDED.exact_address,
    exact_latitude = EXCLUDED.exact_latitude,
    exact_longitude = EXCLUDED.exact_longitude,
    updated_at = now()
  WHERE public.listing_private_locations.owner_id = v_user;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.set_listing_private_location(
    uuid, text, double precision, double precision
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.set_listing_private_location(
    uuid, text, double precision, double precision
  )
TO authenticated;

\echo === 38/41 20261023_restrict_anonymous_rpc_execution.sql ===
-- ROOMS M2.4: restringir RPC al minimo privilegio.
-- Reproduce los permisos verificados en Supabase.
-- No modifica datos ni elimina funciones.

REVOKE EXECUTE ON FUNCTION
  public.accept_household_invitation(uuid)
FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION
  public.get_blocked_profiles()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.accept_household_invitation(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_blocked_profiles()
TO authenticated;

-- get_household_invitation(uuid) permanece sin cambios.



\echo === 39/41 20261026_admin_shared_preflight_permissions.sql ===
-- ROOMS M6.7B
-- Lectura exclusiva del preflight administrativo de bajas.
-- Reproduce los permisos SELECT confirmados en Supabase.
-- No modifica RLS, datos ni permisos de anon/authenticated.

GRANT SELECT ON TABLE
  public.conversation_preferences,
  public.household_candidate_votes,
  public.household_candidates,
  public.household_invitations,
  public.post_comments,
  public.post_likes,
  public.user_blocks
TO service_role;



\echo === 40/41 20261026_signup_registration_guard.sql ===
-- ROOMS M6.2D
-- Propuesta de proteccion del registro.
-- NO APLICAR sin revisar el estado real de Supabase.
--
-- Requisitos para toda nueva cuenta:
-- 1. Declaracion expresa de mayoria de edad.
-- 2. Aceptacion expresa de las condiciones.
-- 3. Version de condiciones vigente y publicada.
--
-- Esta version elimina la excepcion historica que
-- permitia altas sin documentos vigentes.

CREATE OR REPLACE FUNCTION
  public.capture_signup_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_version text;
  v_accepted_version text;
BEGIN
  SELECT version
    INTO v_current_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION
      'Registration unavailable: no current terms';
  END IF;

  IF (
    NEW.raw_user_meta_data -> 'rooms_age_18_confirmed'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Adult declaration required';
  END IF;

  IF (
    NEW.raw_user_meta_data -> 'rooms_terms_accepted'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Terms acceptance required';
  END IF;

  v_accepted_version :=
    NEW.raw_user_meta_data ->> 'rooms_terms_version';

  IF v_accepted_version IS DISTINCT FROM v_current_version THEN
    RAISE EXCEPTION 'Terms version not current';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  VALUES (
    NEW.id,
    'terms',
    v_accepted_version,
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.capture_signup_terms_acceptance()
FROM PUBLIC, anon, authenticated;

-- No se modifica el trigger existente.
-- Se debe verificar que rooms_capture_signup_terms
-- sigue asociado a auth.users antes de aplicar.



\echo === 41/41 20261027_beta_registration_closed.sql ===
-- ROOMS M6.13E
-- Reproduce el bloqueo temporal instalado en Supabase.
-- No elimina usuarios existentes.
-- ADVERTENCIA: bloquea toda insercion nueva en auth.users,
-- incluidas cuentas QA y altas administrativas.
-- No ejecutar nuevamente en produccion sin plan de cambios.

-- QA: limite transaccional externo

CREATE OR REPLACE FUNCTION
  public.rooms_block_beta_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'ROOMS registration temporarily closed'
    USING ERRCODE = 'P0001';

  RETURN NULL;
END;
$$;

REVOKE ALL
ON FUNCTION public.rooms_block_beta_registration()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
  rooms_beta_registration_closed
ON auth.users;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_block_beta_registration();

-- QA: limite transaccional externo



\echo === M5.59 INVITACIONES BETA ===

DO $preflight$
BEGIN
  IF to_regclass('rooms_private.beta_invitations') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: tabla beta ya instalada';
  END IF;

  IF to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'STOP: pgcrypto digest no disponible';
  END IF;
END;
$preflight$;

-- ROOMS M5.59 - BORRADOR QA, NO APROBADO.

-- Esquema extraido de la base local original M5.58.

-- No activa el registro beta.

CREATE SCHEMA IF NOT EXISTS rooms_private;

CREATE TABLE rooms_private.beta_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_normalized text NOT NULL,
    token_digest bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    CONSTRAINT beta_invitations_check CHECK ((expires_at > created_at)),
    CONSTRAINT beta_invitations_check1 CHECK (((used_at IS NULL) OR (revoked_at IS NULL))),
    CONSTRAINT beta_invitations_email_normalized_check CHECK (((email_normalized = lower(TRIM(BOTH FROM email_normalized))) AND ((length(email_normalized) >= 3) AND (length(email_normalized) <= 254)) AND (POSITION(('@'::text) IN (email_normalized)) > 1))),
    CONSTRAINT beta_invitations_token_digest_check CHECK ((octet_length(token_digest) = 32))
);

ALTER TABLE ONLY rooms_private.beta_invitations
    ADD CONSTRAINT beta_invitations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY rooms_private.beta_invitations
    ADD CONSTRAINT beta_invitations_token_digest_key UNIQUE (token_digest);

CREATE INDEX rooms_beta_invitations_email_idx ON rooms_private.beta_invitations USING btree (email_normalized);

ALTER TABLE rooms_private.beta_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA rooms_private FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE rooms_private.beta_invitations FROM PUBLIC, anon, authenticated;



CREATE OR REPLACE FUNCTION
  rooms_private.consume_beta_invite_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
  v_terms_version text;
  v_invitation_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Operacion no permitida';
  END IF;

  -- Exigir documentos legales vigentes.
  IF NOT EXISTS (
    SELECT 1
    FROM public.legal_document_versions
    WHERE document_type = 'privacy'
      AND is_current = true
      AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Registro no autorizado';
  END IF;

  SELECT version INTO v_terms_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  IF v_terms_version IS NULL
     OR NEW.raw_user_meta_data
       -> 'rooms_age_18_confirmed'
       IS DISTINCT FROM 'true'::jsonb
     OR NEW.raw_user_meta_data
       -> 'rooms_terms_accepted'
       IS DISTINCT FROM 'true'::jsonb
     OR NEW.raw_user_meta_data
       ->> 'rooms_terms_version'
       IS DISTINCT FROM v_terms_version THEN
    RAISE EXCEPTION 'Registro no autorizado';
  END IF;

  v_token :=
    NEW.raw_user_meta_data
      ->> 'rooms_beta_invite_token';

  IF NEW.email IS NULL
     OR v_token IS NULL
     OR v_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'Invitacion no valida';
  END IF;

  -- UPDATE condicional: bloquea la fila y
  -- permite que solo una transaccion la consuma.
  UPDATE rooms_private.beta_invitations
  SET used_at = transaction_timestamp()
  WHERE token_digest =
    extensions.digest(v_token, 'sha256')
    AND email_normalized =
      pg_catalog.lower(pg_catalog.btrim(NEW.email))
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > statement_timestamp()
  RETURNING id INTO v_invitation_id;

  IF v_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invitacion no valida';
  END IF;

  -- Evitar almacenar el token en los metadatos
  -- persistidos del nuevo usuario.
  NEW.raw_user_meta_data :=
    NEW.raw_user_meta_data
      - 'rooms_beta_invite_token';

  RETURN NEW;
END;
$$;

-- Las funciones PostgreSQL pueden heredar EXECUTE
-- para PUBLIC. Retirar esos permisos en la misma
-- transaccion que crea o actualiza la funcion.
REVOKE ALL ON FUNCTION
  rooms_private.consume_beta_invite_on_signup()
FROM PUBLIC, anon, authenticated;


DO $m559$
BEGIN
  IF to_regclass('rooms_private.beta_invitations') IS NULL THEN
    RAISE EXCEPTION 'FAIL: tabla privada ausente';
  END IF;

  IF to_regprocedure(
    'rooms_private.consume_beta_invite_on_signup()'
  ) IS NULL THEN
    RAISE EXCEPTION 'FAIL: consumidor ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'rooms_private.beta_invitations'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS no habilitado';
  END IF;

  IF has_table_privilege(
    'authenticated',
    'rooms_private.beta_invitations',
    'SELECT'
  ) OR has_table_privilege(
    'authenticated',
    'rooms_private.beta_invitations',
    'UPDATE'
  ) OR has_function_privilege(
    'authenticated',
    'rooms_private.consume_beta_invite_on_signup()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: privilegios de invitacion inseguros';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgfoid =
        'public.rooms_block_beta_registration()'::regprocedure
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'FAIL: registro beta no permanece cerrado';
  END IF;

  RAISE NOTICE 'OK esquema privado de invitaciones';
  RAISE NOTICE 'OK RLS y privilegios';
  RAISE NOTICE 'OK consumidor instalado sin activacion';
  RAISE NOTICE 'OK registro beta cerrado';
END;
$m559$;

\echo OK_ROOMS_M559_INVITATIONS_INTEGRATED

\echo === M5.49 VERIFICACION INTEGRACION AUTH ===

DO $check$
DECLARE
  v_trigger text;
BEGIN
  FOREACH v_trigger IN ARRAY ARRAY[
    'rooms_initialize_profile',
    'rooms_create_default_role',
    'rooms_capture_signup_terms',
    'rooms_beta_registration_closed'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass
        AND tgname = v_trigger
        AND tgenabled = 'O'
        AND NOT tgisinternal
    ) THEN
      RAISE EXCEPTION 'Trigger ausente o desactivado: %', v_trigger;
    END IF;
  END LOOP;

  IF to_regprocedure('public.handle_new_user()') IS NULL
     OR to_regprocedure('public.create_default_user_role()') IS NULL
     OR to_regprocedure('public.capture_signup_terms_acceptance()') IS NULL
     OR to_regprocedure('public.rooms_block_beta_registration()') IS NULL
  THEN
    RAISE EXCEPTION 'Faltan funciones de registro';
  END IF;

  IF has_function_privilege(
    'anon', 'public.handle_new_user()', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.create_default_user_role()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Permisos inseguros de funciones internas';
  END IF;

  RAISE NOTICE 'OK 4 triggers Auth activos';
  RAISE NOTICE 'OK funciones de inicializacion y legal';
  RAISE NOTICE 'OK registro beta permanece bloqueado';
END;
$check$;

\echo OK_ROOMS_M549_AUTH_INTEGRATION

\echo === VERIFICACION ANTES DE ROLLBACK ===

DO $qa$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.listings') IS NULL
     OR to_regclass('public.rooms_dna') IS NULL THEN
    RAISE EXCEPTION 'STOP: esquema final incompleto';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgenabled = 'O'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: bloqueo de registro ausente';
  END IF;
END;
$qa$;

\echo === ROLLBACK DE TODO EL ENSAYO ===
ROLLBACK;

DO $qa$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     OR to_regclass('public.listings') IS NOT NULL
     OR to_regclass('public.rooms_dna') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: quedan tablas tras rollback';
  END IF;
END;
$qa$;

\echo OK_ROOMS_M535_ROLLBACK_VERIFICADO
