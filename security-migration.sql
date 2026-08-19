-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA — NÃO APAGA DADOS
-- Execute este arquivo no Supabase SQL Editor do projeto REAL.
-- Requer que as tabelas já existam.
-- ============================================================

ALTER TABLE escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_compra ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'escolas','materiais','ordens_servico',
    'os_materiais','notas_compra','itens_compra'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all_%s" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "authenticated_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- Depois desta migração:
-- * anon: sem SELECT/UPDATE/DELETE/INSERT nessas tabelas
-- * authenticated: acesso ao sistema após login
-- * service_role: continua podendo operar no backend/Edge Functions
