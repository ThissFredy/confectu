-- H4: politica UPDATE de storage.objects con WITH CHECK y cast defensivo.
--
-- Antes la politica "Allow admin and owner update workshop logos" solo tenia
-- USING (validaba la fila vieja) sin WITH CHECK (validar la fila nueva): un
-- taller podia renombrar su objeto hacia la carpeta de otro taller. Ademas el
-- cast directo foldername()[1]::uuid fallaba con ruido ante rutas no-UUID.

create or replace function public.storage_folder_uuid(p_object_name text)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when (storage.foldername(p_object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(p_object_name))[1]::uuid
    else null
  end
$$;

drop policy if exists "Allow admin and owner select workshop logos" on storage.objects;
drop policy if exists "Allow admin and owner insert workshop logos" on storage.objects;
drop policy if exists "Allow admin and owner update workshop logos" on storage.objects;
drop policy if exists "Allow admin and owner delete workshop logos" on storage.objects;

create policy "Allow admin and owner select workshop logos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'workshop-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.workshops w
        where w.id = public.storage_folder_uuid(objects.name)
          and w.owner_id = auth.uid()
      )
    )
  );

create policy "Allow admin and owner insert workshop logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'workshop-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.workshops w
        where w.id = public.storage_folder_uuid(objects.name)
          and w.owner_id = auth.uid()
      )
    )
  );

create policy "Allow admin and owner update workshop logos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'workshop-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.workshops w
        where w.id = public.storage_folder_uuid(objects.name)
          and w.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'workshop-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.workshops w
        where w.id = public.storage_folder_uuid(objects.name)
          and w.owner_id = auth.uid()
      )
    )
  );

create policy "Allow admin and owner delete workshop logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'workshop-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.workshops w
        where w.id = public.storage_folder_uuid(objects.name)
          and w.owner_id = auth.uid()
      )
    )
  );

comment on function public.storage_folder_uuid(text) is
  'Extrae el primer segmento de la ruta de storage como uuid o null si la ruta no es un uuid valido.';
