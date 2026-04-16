alter table public.predictions
  add column if not exists avis_texte text,
  add column if not exists avis_note numeric(3,1),
  add column if not exists avis_verdict text
    check (avis_verdict in ('MISER', 'SURVEILLER', 'EVITER')),
  add column if not exists avis_pari_type text
    check (avis_pari_type in ('GAGNANT', 'PLACE')),
  add column if not exists avis_generated_at timestamptz;
