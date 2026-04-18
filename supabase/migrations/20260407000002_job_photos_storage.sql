-- Create storage bucket for job photos
-- Note: RLS policies for storage.objects must be configured via Supabase Dashboard
-- See comments below for the policies to add:
--
-- Policy 1 - Allow authenticated users to upload:
-- CREATE POLICY "Users can upload job photos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'job-photos');
--
-- Policy 2 - Allow public read:
-- CREATE POLICY "Anyone can view job photos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'job-photos');
--
-- Policy 3 - Allow users to delete:
-- CREATE POLICY "Users can delete their job photos"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'job-photos');

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;
