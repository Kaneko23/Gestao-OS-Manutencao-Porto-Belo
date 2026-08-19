/**
 * GOOGLE APPS SCRIPT — Integração segura do Formulário de Manutenção
 *
 * Antes de usar:
 * 1. No Supabase, publique a Edge Function supabase/functions/form-os.
 * 2. Crie um segredo forte FORM_WEBHOOK_SECRET na Edge Function.
 * 3. No Apps Script, vá em Configurações do projeto > Propriedades do script
 *    e crie FORM_WEBHOOK_SECRET com o MESMO valor.
 * 4. Crie um acionador para enviarParaSupabase no evento "Ao enviar formulário".
 *
 * IMPORTANTE:
 * Este script NÃO usa a ANON KEY nem a SERVICE ROLE KEY.
 */

const SUPABASE_FORM_FUNCTION_URL =
  "https://hanhihcwfhehudqvqxkz.supabase.co/functions/v1/form-os";

function enviarParaSupabase(e) {
  if (!e || !e.values) {
    Logger.log("Nenhum evento de envio encontrado.");
    return;
  }

  const secret = PropertiesService.getScriptProperties()
    .getProperty("FORM_WEBHOOK_SECRET");

  if (!secret) {
    throw new Error("Configure FORM_WEBHOOK_SECRET nas Propriedades do script.");
  }

  const values = e.values;
  const emailSolicitante = values[1] || "";
  const nomeEscola = (values[2] || "").trim();
  const solicitante = values[3] || emailSolicitante || "Solicitante Form";
  const descricaoProblema =
    values[4] || "Manutenção solicitada via formulário";

  const payload = {
    nomeEscola,
    emailSolicitante,
    solicitante,
    descricaoProblema,
  };

  const response = UrlFetchApp.fetch(SUPABASE_FORM_FUNCTION_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-form-secret": secret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Supabase retornou HTTP " + code + ": " + body);
  }

  Logger.log("OS registrada com sucesso: " + body);
}
