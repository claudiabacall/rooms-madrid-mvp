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

alter table public.communities
  add constraint communities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.communities
  add constraint communities_pkey PRIMARY KEY (id);

alter table public.communities
  add constraint communities_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));

alter table public.communities
  add constraint communities_visibility_check CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text]));

alter table public.community_members
  add constraint community_members_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table public.community_members
  add constraint community_members_pkey PRIMARY KEY (community_id, user_id);

alter table public.community_members
  add constraint community_members_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]));

alter table public.community_members
  add constraint community_members_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text]));

alter table public.community_members
  add constraint community_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.connections
  add constraint connections_check CHECK (requester_id <> recipient_id);

alter table public.connections
  add constraint connections_pkey PRIMARY KEY (id);

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
  add constraint conversation_preferences_pkey PRIMARY KEY (id);

alter table public.conversation_preferences
  add constraint conversation_preferences_unique_pair UNIQUE (user_id, other_user_id);

alter table public.conversation_preferences
  add constraint conversation_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_candidate_votes
  add constraint household_candidate_votes_candidate_type_check CHECK (candidate_type = ANY (ARRAY['listing'::text, 'person'::text]));

alter table public.household_candidate_votes
  add constraint household_candidate_votes_household_id_candidate_type_candi_key UNIQUE (household_id, candidate_type, candidate_id, user_id);

alter table public.household_candidate_votes
  add constraint household_candidate_votes_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

alter table public.household_candidate_votes
  add constraint household_candidate_votes_pkey PRIMARY KEY (id);

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

alter table public.household_candidates
  add constraint household_candidates_pkey PRIMARY KEY (household_id, listing_id);

alter table public.household_invitations
  add constraint household_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.household_invitations
  add constraint household_invitations_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

alter table public.household_invitations
  add constraint household_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.household_invitations
  add constraint household_invitations_pkey PRIMARY KEY (id);

alter table public.household_invitations
  add constraint household_invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text, 'expired'::text]));

alter table public.household_invitations
  add constraint household_invitations_token_key UNIQUE (token);

alter table public.household_members
  add constraint household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

alter table public.household_members
  add constraint household_members_pkey PRIMARY KEY (household_id, user_id);

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
  add constraint household_person_candidates_pkey PRIMARY KEY (household_id, user_id);

alter table public.household_person_candidates
  add constraint household_person_candidates_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.households
  add constraint households_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.households
  add constraint households_pkey PRIMARY KEY (id);

alter table public.listing_private_locations
  add constraint listing_private_latitude_check CHECK (exact_latitude >= '-90'::integer::double precision AND exact_latitude <= 90::double precision);

alter table public.listing_private_locations
  add constraint listing_private_locations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;

alter table public.listing_private_locations
  add constraint listing_private_locations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.listing_private_locations
  add constraint listing_private_locations_pkey PRIMARY KEY (listing_id);

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
  add constraint listings_pkey PRIMARY KEY (id);

alter table public.listings
  add constraint listings_price_check CHECK (price > 0);

alter table public.listings
  add constraint listings_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

alter table public.match_preferences
  add constraint match_preferences_pkey PRIMARY KEY (user_id);

alter table public.match_preferences
  add constraint match_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.messages
  add constraint messages_body_check CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 2000);

alter table public.messages
  add constraint messages_check CHECK (sender_id <> recipient_id);

alter table public.messages
  add constraint messages_pkey PRIMARY KEY (id);

alter table public.messages
  add constraint messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.messages
  add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.onboarding_preferences
  add constraint onboarding_preferences_pkey PRIMARY KEY (user_id);

alter table public.onboarding_preferences
  add constraint onboarding_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.post_comments
  add constraint post_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.post_comments
  add constraint post_comments_pkey PRIMARY KEY (id);

alter table public.post_comments
  add constraint post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

alter table public.post_comments
  add constraint post_comments_status_check CHECK (status = ANY (ARRAY['published'::text, 'deleted'::text]));

alter table public.post_likes
  add constraint post_likes_pkey PRIMARY KEY (post_id, user_id);

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
  add constraint posts_pkey PRIMARY KEY (id);

alter table public.posts
  add constraint posts_post_type_check CHECK (post_type = ANY (ARRAY['question'::text, 'recommendation'::text, 'neighborhood'::text, 'warning'::text, 'experience'::text, 'housing'::text]));

alter table public.posts
  add constraint posts_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

alter table public.profiles
  add constraint profiles_age_check CHECK (age IS NULL OR age >= 18);

alter table public.profiles
  add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.profiles
  add constraint profiles_pkey PRIMARY KEY (id);

alter table public.reports
  add constraint reports_pkey PRIMARY KEY (id);

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
  add constraint rooms_dna_pkey PRIMARY KEY (user_id);

alter table public.rooms_dna
  add constraint rooms_dna_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.saved_collection_items
  add constraint saved_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES saved_collections(id) ON DELETE CASCADE;

alter table public.saved_collection_items
  add constraint saved_collection_items_pkey PRIMARY KEY (collection_id, saved_item_id);

alter table public.saved_collection_items
  add constraint saved_collection_items_saved_item_id_fkey FOREIGN KEY (saved_item_id) REFERENCES saved_items(id) ON DELETE CASCADE;

alter table public.saved_collections
  add constraint saved_collections_pkey PRIMARY KEY (id);

alter table public.saved_collections
  add constraint saved_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.saved_collections
  add constraint saved_collections_visibility_check CHECK (visibility = ANY (ARRAY['private'::text, 'shared'::text]));

alter table public.saved_items
  add constraint saved_items_item_type_check CHECK (item_type = ANY (ARRAY['room'::text, 'apartment'::text, 'person'::text, 'community'::text, 'post'::text]));

alter table public.saved_items
  add constraint saved_items_pkey PRIMARY KEY (id);

alter table public.saved_items
  add constraint saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.saved_items
  add constraint saved_items_user_id_item_type_item_id_key UNIQUE (user_id, item_type, item_id);

alter table public.user_blocks
  add constraint user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_blocks
  add constraint user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_blocks
  add constraint user_blocks_not_self CHECK (blocker_id <> blocked_id);

alter table public.user_blocks
  add constraint user_blocks_pkey PRIMARY KEY (id);

alter table public.user_blocks
  add constraint user_blocks_unique UNIQUE (blocker_id, blocked_id);

alter table public.user_intents
  add constraint user_intents_intent_check CHECK (intent = ANY (ARRAY['find_apartment'::text, 'find_room'::text, 'find_mates_for_home'::text, 'find_mates_to_search'::text, 'offer_apartment'::text, 'offer_room'::text]));

alter table public.user_intents
  add constraint user_intents_pkey PRIMARY KEY (user_id, intent);

alter table public.user_intents
  add constraint user_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_roles
  add constraint user_roles_pkey PRIMARY KEY (user_id);

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

