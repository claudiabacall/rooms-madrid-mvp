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
