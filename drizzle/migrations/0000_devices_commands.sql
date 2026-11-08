CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My device',
  key_hash text NOT NULL UNIQUE,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices select" ON public.devices FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own devices update" ON public.devices FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own devices delete" ON public.devices FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.pairing_codes (
  code text PRIMARY KEY,
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pairing_codes TO authenticated;
GRANT ALL ON public.pairing_codes TO service_role;
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own codes select" ON public.pairing_codes FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own codes insert" ON public.pairing_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  command text NOT NULL CHECK (char_length(command) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','rejected','cancelled')),
  output text,
  exit_code int,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX commands_device_idx ON public.commands(device_id, created_at DESC);
GRANT SELECT, INSERT ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own commands select" ON public.commands FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own commands insert" ON public.commands FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.owner_id = auth.uid())
);