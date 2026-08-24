-- Confectu: índice único parcial de documento por taller y bucket de logos.

-- ============================================================================
-- ÍNDICE ÚNICO PARCIAL
-- ============================================================================

-- Garantiza que dentro de un mismo taller no existan dos clientes con el mismo
-- tipo y número de documento. No afecta a clientes sin documento.
create unique index if not exists customers_workshop_document_unique_idx
  on public.customers (workshop_id, document_type_id, document_number)
  where document_type_id is not null and document_number is not null;

-- ============================================================================
-- BUCKET DE STORAGE PARA LOGOS DE TALLER
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workshop-logos',
  'workshop-logos',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- POLÍTICAS DE STORAGE
-- ADMIN y owner del taller pueden leer, escribir y eliminar logos.
-- La ruta de cada archivo es {workshop_id}/logo.{ext}.
-- ============================================================================

drop policy if exists "Allow admin and owner select workshop logos" on storage.objects;
drop policy if exists "Allow admin and owner insert workshop logos" on storage.objects;
drop policy if exists "Allow admin and owner update workshop logos" on storage.objects;
drop policy if exists "Allow admin and owner delete workshop logos" on storage.objects;

create policy "Allow admin and owner select workshop logos"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workshop-logos'
    and (
      exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'ADMIN'
          and is_active = true
      )
      or exists (
        select 1
        from public.workshops
        where id = (storage.foldername(name))[1]::uuid
          and owner_id = auth.uid()
      )
    )
  );

create policy "Allow admin and owner insert workshop logos"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workshop-logos'
    and (
      exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'ADMIN'
          and is_active = true
      )
      or exists (
        select 1
        from public.workshops
        where id = (storage.foldername(name))[1]::uuid
          and owner_id = auth.uid()
      )
    )
  );

create policy "Allow admin and owner update workshop logos"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workshop-logos'
    and (
      exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'ADMIN'
          and is_active = true
      )
      or exists (
        select 1
        from public.workshops
        where id = (storage.foldername(name))[1]::uuid
          and owner_id = auth.uid()
      )
    )
  );

create policy "Allow admin and owner delete workshop logos"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workshop-logos'
    and (
      exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'ADMIN'
          and is_active = true
      )
      or exists (
        select 1
        from public.workshops
        where id = (storage.foldername(name))[1]::uuid
          and owner_id = auth.uid()
      )
    )
  );
