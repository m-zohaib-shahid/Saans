-- Saans (سانس) InsForge Postgres Schema & RLS Policies

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT 'general',
  city TEXT NOT NULL DEFAULT 'Lahore',
  alert_threshold_aqi INTEGER NOT NULL DEFAULT 200,
  hero_points INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 1,
  last_active_date TEXT,
  mask_pledged_today TEXT,
  actions_count JSONB NOT NULL DEFAULT '{"reports":0,"shares":0,"adviceChecks":0,"maskPledges":0}'::jsonb,
  completed_challenges JSONB NOT NULL DEFAULT '{}'::jsonb,
  badges TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own profile"
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "users can insert own profile"
  ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "users can update own profile"
  ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "users can delete own profile"
  ON public.user_profiles
  FOR DELETE TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  zone_name TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_data_url TEXT,
  author_name TEXT NOT NULL,
  upvotes_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_reports_created_at_idx
  ON public.community_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS community_reports_user_id_idx
  ON public.community_reports (user_id);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read community reports"
  ON public.community_reports
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "authenticated users can create reports"
  ON public.community_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "authors can delete own reports"
  ON public.community_reports
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.community_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

CREATE INDEX IF NOT EXISTS report_upvotes_report_id_idx
  ON public.report_upvotes (report_id);

CREATE INDEX IF NOT EXISTS report_upvotes_user_id_idx
  ON public.report_upvotes (user_id);

ALTER TABLE public.report_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own upvotes"
  ON public.report_upvotes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "users can insert own upvotes"
  ON public.report_upvotes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "users can delete own upvotes"
  ON public.report_upvotes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.toggle_report_upvote(p_report_id UUID)
RETURNS TABLE (upvoted BOOLEAN, upvotes_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_exists BOOLEAN;
  v_new_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to upvote';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.report_upvotes
    WHERE report_id = p_report_id AND user_id = v_uid
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.report_upvotes
    WHERE report_id = p_report_id AND user_id = v_uid;

    UPDATE public.community_reports
    SET upvotes_count = GREATEST(0, public.community_reports.upvotes_count - 1)
    WHERE id = p_report_id
    RETURNING public.community_reports.upvotes_count INTO v_new_count;

    RETURN QUERY SELECT FALSE, COALESCE(v_new_count, 0);
  ELSE
    INSERT INTO public.report_upvotes (report_id, user_id)
    VALUES (p_report_id, v_uid)
    ON CONFLICT (report_id, user_id) DO NOTHING;

    UPDATE public.community_reports
    SET upvotes_count = public.community_reports.upvotes_count + 1
    WHERE id = p_report_id
    RETURNING public.community_reports.upvotes_count INTO v_new_count;

    RETURN QUERY SELECT TRUE, COALESCE(v_new_count, 1);
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.community_reports TO anon, authenticated;
GRANT INSERT, DELETE ON public.community_reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.report_upvotes TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_report_upvote(UUID) TO authenticated;
