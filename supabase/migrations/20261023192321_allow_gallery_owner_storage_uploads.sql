-- Allow authenticated gallery owners to add assets only to their own gallery folder.
-- Upload uses upsert=false, so INSERT is sufficient; no UPDATE/SELECT grants are added.
create policy "Gallery owners can upload gallery assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gallery-images'
  and storage.extension(name) in ('pdf', 'jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.galleries as gallery
    where gallery.id::text = (storage.foldername(name))[1]
      and gallery.user_id::text = (select auth.uid())::text
  )
);
