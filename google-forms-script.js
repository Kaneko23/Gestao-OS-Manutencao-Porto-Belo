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

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty("OS_SHEET_WEBHOOK_SECRET");

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Não autorizado" });
    }

    const spreadsheetId = PropertiesService.getScriptProperties()
      .getProperty("SPREADSHEET_ID");
    if (!spreadsheetId) throw new Error("Configure SPREADSHEET_ID nas Propriedades do script.");

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName("Conclusões OS") ||
      spreadsheet.insertSheet("Conclusões OS");
    const headers = [
      "OS Nº", "Data de Conclusão", "Escola / Setor", "Solicitante",
      "Técnico", "Problema Relatado", "Serviço Realizado", "Materiais Gastos"
    ];

    if (sheet.getLastRow() === 0) sheet.appendRow(headers);

    const values = [
      payload.os.numero,
      payload.os.dataConclusao || "",
      payload.os.escola || "",
      payload.os.solicitante || "",
      payload.os.tecnico || "",
      payload.os.problema || "",
      payload.os.servico || "",
      (payload.os.materiais || []).map(item =>
        item.quantidade + " x " + item.descricao
      ).join("; ")
    ];
    const match = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
        .createTextFinder(String(payload.os.numero)).matchEntireCell(true).findNext()
      : null;

    if (match) {
      sheet.getRange(match.getRow(), 1, 1, values.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

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
