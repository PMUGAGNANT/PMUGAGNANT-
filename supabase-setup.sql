-- =============================================
-- PMU AI - SQL Setup pour Supabase
-- A executer dans Supabase > SQL Editor
-- =============================================

-- 1. Table profiles (liee a auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  solde INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table bets (paris fictifs)
CREATE TABLE IF NOT EXISTS bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date_str TEXT NOT NULL,
  reunion INTEGER NOT NULL,
  course INTEGER NOT NULL,
  hippodrome TEXT DEFAULT '',
  heure_depart TEXT DEFAULT '',
  cheval_num INTEGER NOT NULL,
  cheval_nom TEXT NOT NULL,
  cheval_num_2 INTEGER,
  cheval_nom_2 TEXT,
  type_pari TEXT NOT NULL CHECK (type_pari IN ('GAGNANT', 'PLACE', 'COUPLE_GAGNANT', 'COUPLE_PLACE')),
  mise INTEGER NOT NULL CHECK (mise >= 1 AND mise <= 50),
  cote NUMERIC NOT NULL,
  statut TEXT DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE', 'GAGNE', 'PLACE', 'PERDU')),
  gain NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bets ADD COLUMN IF NOT EXISTS cheval_num_2 INTEGER;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS cheval_nom_2 TEXT;

ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_type_pari_check;
ALTER TABLE bets ADD CONSTRAINT bets_type_pari_check
  CHECK (type_pari IN ('GAGNANT', 'PLACE', 'COUPLE_GAGNANT', 'COUPLE_PLACE'));

ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_couple_fields_check;
ALTER TABLE bets ADD CONSTRAINT bets_couple_fields_check
  CHECK (
    (type_pari IN ('GAGNANT', 'PLACE') AND cheval_num_2 IS NULL AND cheval_nom_2 IS NULL)
    OR
    (type_pari IN ('COUPLE_GAGNANT', 'COUPLE_PLACE') AND cheval_num_2 IS NOT NULL AND cheval_nom_2 IS NOT NULL)
  );

-- 3. Trigger: creer automatiquement un profil quand un user s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, solde)
  VALUES (NEW.id, NEW.email, 1000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. RLS (Row Level Security) - chaque user voit seulement ses donnees
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- Profiles: un user peut lire/modifier uniquement son profil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Bets: un user peut lire/inserer/modifier uniquement ses paris
CREATE POLICY "Users can view own bets"
  ON bets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets"
  ON bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets"
  ON bets FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Index pour performance
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_statut ON bets(statut);
CREATE INDEX IF NOT EXISTS idx_bets_date ON bets(date_str);
