
DROP POLICY IF EXISTS "Allow anyone to insert scans" ON public.scan_history;

CREATE POLICY "Anyone can insert valid scans"
ON public.scan_history
FOR INSERT
TO anon, authenticated
WITH CHECK (
  result IN ('REAL', 'FAKE')
  AND confidence >= 0
  AND confidence <= 100
  AND filename IS NOT NULL
  AND length(filename) BETWEEN 1 AND 64
);
