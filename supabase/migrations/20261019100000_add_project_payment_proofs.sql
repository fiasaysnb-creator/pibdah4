ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS payment_proofs jsonb NOT NULL DEFAULT '[]'::jsonb;