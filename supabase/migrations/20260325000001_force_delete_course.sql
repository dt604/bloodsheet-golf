-- Force-delete a course by nulling out match references first
CREATE OR REPLACE FUNCTION public.force_delete_course(p_course_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Detach any matches referencing this course (preserve match history)
  UPDATE public.matches SET course_id = NULL WHERE course_id = p_course_id;

  -- Now delete the course
  DELETE FROM public.courses WHERE id = p_course_id;
END;
$$;

-- Bulk version
CREATE OR REPLACE FUNCTION public.force_delete_courses_bulk(p_course_ids TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE public.matches SET course_id = NULL WHERE course_id = ANY(p_course_ids);
  DELETE FROM public.courses WHERE id = ANY(p_course_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.force_delete_course(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_delete_courses_bulk(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.force_delete_course(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_delete_courses_bulk(TEXT[]) TO authenticated;
