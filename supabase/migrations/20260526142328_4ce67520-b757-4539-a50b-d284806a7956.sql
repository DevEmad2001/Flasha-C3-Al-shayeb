
-- Drop all public policies and replace with authenticated-only policies
DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY['categories','customer_payments','customers','external_expenses','inventory_items','inventory_movements','project_expense_payments','project_expenses','projects'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format($f$CREATE POLICY "auth select %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)$f$, t);
    EXECUTE format($f$CREATE POLICY "auth insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (true)$f$, t);
    EXECUTE format($f$CREATE POLICY "auth update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)$f$, t);
    EXECUTE format($f$CREATE POLICY "auth delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (true)$f$, t);
  END LOOP;
END $$;
