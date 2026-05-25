CREATE TABLE IF NOT EXISTS public.scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result text NOT NULL CHECK (result IN ('REAL', 'FAKE')),
  confidence float NOT NULL,
  filename text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to insert scans"
  ON public.scan_history
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anyone to view history"
  ON public.scan_history
  FOR SELECT
  TO anon, authenticated
  USING (true);
