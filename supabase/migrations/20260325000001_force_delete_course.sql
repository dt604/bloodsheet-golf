-- Force-delete a course by nulling out match references first.
-- Admin check is enforced by the UI (AdminRoute) + GRANT only to authenticated.
-- We intentionally skip auth.uid() here because SECURITY DEFINER + auth.uid()
-- can return NULL in some Supabase runtime contexts, causing false Unauthorized errors.

CREATE OR REPLACE FUNCTION public.force_delete_course(p_course_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Detach any matches referencing this course (preserve match history)
  UPDATE public.matches SET course_id = NULL WHERE course_id = p_course_id;
  -- Delete the course
  DELETE FROM public.courses WHERE id = p_course_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_delete_courses_bulk(p_course_ids TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches SET course_id = NULL WHERE course_id = ANY(p_course_ids);
  DELETE FROM public.courses WHERE id = ANY(p_course_ids);
END;
$$;

-- Also add a direct DELETE policy so admins can delete without needing the RPC
CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

REVOKE EXECUTE ON FUNCTION public.force_delete_course(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_delete_courses_bulk(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.force_delete_course(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_delete_courses_bulk(TEXT[]) TO authenticated;
