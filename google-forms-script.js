/**
 * GOOGLE APPS SCRIPT — Integração do Formulário de Manutenção com o Supabase
 * 
 * INSTRUÇÕES DE INSTALAÇÃO:
 * 1. Abra a planilha do seu Formulário Google (Form_Responses / Respostas do Formulário).
 * 2. No menu superior, clique em "Extensões" > "Apps Script".
 * 3. Apague todo o código existente e cole este código abaixo.
 * 4. Salve o projeto (Ctrl + S ou ícone de disco).
 * 5. No menu esquerdo do Apps Script, clique no ícone de relógio ("Acionadores" / "Triggers").
 * 6. Clique no botão "+ Adicionar acionador" (canto inferior direito).
 * 7. Configure o acionador:
 *    - Escolha a função: enviarParaSupabase
 *    - Selecione o evento: "Ao enviar formulário" (From spreadsheet > On form submit)
 * 8. Clique em "Salvar" e autorize as permissões solicitadas.
 */

const SUPABASE_URL = "https://hanhihcwfhehudqvqxkz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbmhpaGN3ZmhlaHVkcXZxeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njc2NjgsImV4cCI6MjEwMjU0MzY2OH0.tqebOniqg2_NgrJizXmqAifpoKver9oOY0UMwnucykM";

function enviarParaSupabase(e) {
  if (!e || !e.values) {
    Logger.log("Nenhum evento de envio encontrado.");
    return;
  }

  // Mapeamento dos campos baseado nas colunas da planilha
  // Coluna 0: Carimbo de data/hora
  // Coluna 1: Endereço de e-mail
  // Coluna 2: Escola Solicitante
  // Coluna 3: Nome do Responsável / Solicitante
  // Coluna 4: Descreva o que está acontecendo e qual a necessidade de reparo
  
  const values = e.values;
  const emailSolicitante = values[1] || "";
  const nomeEscola = (values[2] || "").trim();
  const solicitante = values[3] || emailSolicitante || "Solicitante Form";
  const descricaoProblema = values[4] || "Manutenção solicitada via formulário";

  // 1. Buscar a ID da escola pelo nome no Supabase
  const escolaId = buscarOuCriarEscola(nomeEscola, emailSolicitante);

  // 2. Criar a Ordem de Serviço no Supabase
  const payloadOS = {
    escola_id: escolaId,
    solicitante: solicitante,
    descricao_problema: descricaoProblema,
    status: "Aberta",
    origem: "Formulario",
    data_abertura: new Date().toISOString().split('T')[0]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Prefer": "return=representation"
    },
    payload: JSON.stringify(payloadOS)
  };

  try {
    const response = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/ordens_servico", options);
    Logger.log("OS criada com sucesso no Supabase: " + response.getContentText());
  } catch (err) {
    Logger.log("Erro ao enviar OS para o Supabase: " + err.toString());
  }
}

function buscarOuCriarEscola(nomeEscola, email) {
  if (!nomeEscola) return null;

  // Buscar escola existente
  const urlSearch = SUPABASE_URL + "/rest/v1/escolas?nome=eq." + encodeURIComponent(nomeEscola);
  const optionsGet = {
    method: "get",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY
    }
  };

  try {
    const res = UrlFetchApp.fetch(urlSearch, optionsGet);
    const data = JSON.parse(res.getContentText());
    if (data && data.length > 0) {
      return data[0].id;
    }
  } catch (err) {
    Logger.log("Erro ao buscar escola: " + err.toString());
  }

  // Se não encontrar, criar nova escola automaticamente
  const optionsPost = {
    method: "post",
    contentType: "application/json",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Prefer": "return=representation"
    },
    payload: JSON.stringify({ nome: nomeEscola, email: email })
  };

  try {
    const resNew = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/escolas", optionsPost);
    const newEscola = JSON.parse(resNew.getContentText());
    return newEscola[0].id;
  } catch (err) {
    Logger.log("Erro ao criar nova escola: " + err.toString());
    return null;
  }
}
