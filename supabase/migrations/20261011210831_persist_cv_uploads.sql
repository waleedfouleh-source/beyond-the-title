alter table public.profiles add column if not exists cv_file_path text;
alter table public.profiles add column if not exists cv_file_name text;
alter table public.profiles add column if not exists cv_uploaded_at timestamptz;
