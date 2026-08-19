-- =================================================================
-- Índices de performance — rode isto UMA VEZ no Supabase SQL Editor
-- Não apaga nem altera dados, só acelera as consultas por chave estrangeira
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_ordens_servico_escola_id ON ordens_servico(escola_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status     ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_origem     ON ordens_servico(origem);

CREATE INDEX IF NOT EXISTS idx_os_materiais_os_id       ON os_materiais(os_id);
CREATE INDEX IF NOT EXISTS idx_os_materiais_material_id ON os_materiais(material_id);

CREATE INDEX IF NOT EXISTS idx_itens_compra_nota_compra_id ON itens_compra(nota_compra_id);
CREATE INDEX IF NOT EXISTS idx_itens_compra_material_id    ON itens_compra(material_id);
CREATE INDEX IF NOT EXISTS idx_itens_compra_escola_id      ON itens_compra(escola_id);
CREATE INDEX IF NOT EXISTS idx_itens_compra_os_id          ON itens_compra(os_id);
CREATE INDEX IF NOT EXISTS idx_itens_compra_data_retirada  ON itens_compra(data_retirada);

CREATE INDEX IF NOT EXISTS idx_notas_compra_data_compra ON notas_compra(data_compra);

-- Bônus: acelera a busca do Google Apps Script por nome de escola
-- (usada em toda submissão de formulário, em buscarOuCriarEscola)
CREATE INDEX IF NOT EXISTS idx_escolas_nome ON escolas(nome);
