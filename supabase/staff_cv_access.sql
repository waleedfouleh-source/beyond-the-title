-- Apply ONCE in the Supabase SQL editor of the Beyond the Title project.
-- This script is idempotent. It does not alter member roles or private files.
-- IMPORTANT: confirm you are in project obndotlxnzkiaalycumh.
BEGIN;

DROP POLICY IF EXISTS "profile read own or admin" ON public.profiles;
DROP POLICY IF EXISTS "profile own or staff CV reviewers" ON public.profiles;
CREATE POLICY "profile own or staff CV reviewers"
ON public.profiles FOR SELECT TO authenticated
USING (
  id=(SELECT auth.uid())
  OR (SELECT private.is_admin())
  OR (role='candidate' AND (SELECT private.is_consultant()))
);

DROP POLICY IF EXISTS "reports private" ON public.cv_reports;
DROP POLICY IF EXISTS "reports own or staff CV reviewers" ON public.cv_reports;
CREATE POLICY "reports own or staff CV reviewers"
ON public.cv_reports FOR SELECT TO authenticated
USING (
  user_id=(SELECT auth.uid())
  OR (SELECT private.is_admin())
  OR (SELECT private.is_consultant())
);

DROP POLICY IF EXISTS "advisor questions own read or admin" ON public.advisor_questions;
DROP POLICY IF EXISTS "advisor questions own or consultant read" ON public.advisor_questions;
CREATE POLICY "advisor questions own or consultant read"
ON public.advisor_questions FOR SELECT TO authenticated
USING (
  user_id=(SELECT auth.uid())
  OR (SELECT private.is_consultant())
  OR (SELECT private.is_admin())
);

DROP POLICY IF EXISTS "cv read own folder" ON storage.objects;
DROP POLICY IF EXISTS "cv read own or staff review" ON storage.objects;
CREATE POLICY "cv read own or staff review"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='cv-files' AND (
    (storage.foldername(name))[1]=(SELECT auth.uid())::text
    OR (
      ((SELECT private.is_admin()) OR (SELECT private.is_consultant()))
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.role='candidate'
            AND p.id::text=(storage.foldername(name))[1]
            AND p.cv_file_path=storage.objects.name
        )
        OR EXISTS (
          SELECT 1 FROM public.cv_reports r
          JOIN public.profiles p ON p.id=r.user_id AND p.role='candidate'
          WHERE r.user_id::text=(storage.foldername(name))[1]
            AND r.file_path=storage.objects.name
        )
      )
    )
  )
);
COMMIT;
