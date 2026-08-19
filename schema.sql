-- =================================================================
-- Schema ATUALIZADO (Recriação Limpa): Sistema de Manutenção Escolar
-- Cole e execute este script no Supabase SQL Editor
-- =================================================================

-- 1. Apagar tabelas antigas se existirem
DROP TABLE IF EXISTS retiradas CASCADE;
DROP TABLE IF EXISTS ordens_compra CASCADE;
DROP TABLE IF EXISTS itens_compra CASCADE;
DROP TABLE IF EXISTS notas_compra CASCADE;
DROP TABLE IF EXISTS os_materiais CASCADE;
DROP TABLE IF EXISTS ordens_servico CASCADE;
DROP TABLE IF EXISTS materiais CASCADE;
DROP TABLE IF EXISTS escolas CASCADE;

-- 2. Recriar tabelas com a nova estrutura
CREATE TABLE escolas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  custo_ref numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE NOT NULL,
  escola_id uuid REFERENCES escolas(id) ON DELETE SET NULL,
  solicitante text NOT NULL DEFAULT '',
  descricao_problema text NOT NULL,
  descricao_servico text NOT NULL DEFAULT '',
  tecnico text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Aberta',
  origem text NOT NULL DEFAULT 'Manual',
  form_response_id text,
  data_abertura date NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE os_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materiais(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(10,2) NOT NULL DEFAULT 1,
  custo_unitario numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notas_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE NOT NULL,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  fornecedor text NOT NULL,
  responsavel_compra text NOT NULL DEFAULT '',
  responsavel_autorizacao text NOT NULL DEFAULT '',
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Autorizada',
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE itens_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_compra_id uuid NOT NULL REFERENCES notas_compra(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materiais(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(10,2) NOT NULL DEFAULT 1,
  custo_unitario numeric(10,2) NOT NULL DEFAULT 0,
  data_retirada date NOT NULL DEFAULT CURRENT_DATE,
  escola_id uuid REFERENCES escolas(id) ON DELETE SET NULL,
  os_id uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2b. Índices de performance para chaves estrangeiras e filtros comuns
-- (Postgres não cria índice automático em FK, só na PK)
CREATE INDEX idx_ordens_servico_escola_id ON ordens_servico(escola_id);
CREATE INDEX idx_ordens_servico_status     ON ordens_servico(status);
CREATE INDEX idx_ordens_servico_origem     ON ordens_servico(origem);
CREATE INDEX idx_os_materiais_os_id        ON os_materiais(os_id);
CREATE INDEX idx_os_materiais_material_id  ON os_materiais(material_id);
CREATE INDEX idx_itens_compra_nota_compra_id ON itens_compra(nota_compra_id);
CREATE INDEX idx_itens_compra_material_id    ON itens_compra(material_id);
CREATE INDEX idx_itens_compra_escola_id      ON itens_compra(escola_id);
CREATE INDEX idx_itens_compra_os_id          ON itens_compra(os_id);
CREATE INDEX idx_itens_compra_data_retirada  ON itens_compra(data_retirada);
CREATE INDEX idx_notas_compra_data_compra    ON notas_compra(data_compra);
CREATE INDEX idx_escolas_nome                ON escolas(nome);

-- 3. Desabilitar RLS (acesso interno livre)
ALTER TABLE escolas DISABLE ROW LEVEL SECURITY;
ALTER TABLE materiais DISABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico DISABLE ROW LEVEL SECURITY;
ALTER TABLE os_materiais DISABLE ROW LEVEL SECURITY;
ALTER TABLE notas_compra DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_compra DISABLE ROW LEVEL SECURITY;

-- 4. Inserir escolas iniciais
INSERT INTO escolas (nome, email) VALUES
  ('Pedro Alemao', 'escolapedro@portobelo.sc.gov.br'),
  ('Fidelis', 'escolafidelis@portobelo.sc.gov.br'),
  ('Maria Benta', 'escolamariabenta@portobelo.sc.gov.br'),
  ('NDI Primeiros Passos', 'ndiprimeiros@portobelo.sc.gov.br'),
  ('Alda Furtado', 'escolaalda@portobelo.sc.gov.br'),
  ('Augusto Bayer', 'ndiaugusto@portobelo.sc.gov.br'),
  ('Olinda Peixoto', 'escolaolinda@portobelo.sc.gov.br'),
  ('Nair', 'nair@portobelo.sc.gov.br');

-- 5. Inserir materiais iniciais
INSERT INTO materiais (nome, unidade, custo_ref) VALUES
  ('Flexivel de vaso sanitario', 'un', 15.00),
  ('Assento sanitario padrao', 'un', 89.90),
  ('Assento sanitario infantil', 'un', 65.00),
  ('Torneira de pia', 'un', 45.00),
  ('Torneira de jardim', 'un', 35.00),
  ('Sifao para pia', 'un', 18.00),
  ('Lampada LED 9W', 'un', 15.00),
  ('Lampada LED 12W', 'un', 18.00),
  ('Torre de entrada eletrica', 'un', 35.00),
  ('Disjuntor 20A', 'un', 40.00),
  ('Disjuntor 30A', 'un', 45.00),
  ('Fio eletrico 2.5mm 100m', 'rolo', 180.00),
  ('Cano PVC 100mm', 'm', 12.00),
  ('Cano PVC 50mm', 'm', 8.00),
  ('Joelho PVC 100mm', 'un', 4.50),
  ('Joelho PVC 50mm', 'un', 3.00),
  ('Tinta latex 18L', 'balde', 180.00),
  ('Tinta esmalte 3.6L', 'lata', 120.00),
  ('Telha fibrocimento 2.44m', 'un', 35.00),
  ('Argamassa 20kg', 'saco', 25.00),
  ('Cimento 50kg', 'saco', 45.00),
  ('Fechadura padrao', 'un', 65.00),
  ('Dobradica 3 pol', 'par', 12.00);
