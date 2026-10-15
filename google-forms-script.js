/**
 * GOOGLE APPS SCRIPT — Integração Completa de Manutenção Escolar
 *
 * Funcionalidades:
 * 1. Ao enviar formulário (enviarParaSupabase):
 *    - Registra a OS automaticamente no Supabase em tempo real.
 *    - Escreve na planilha de respostas o "OS Nº" e Status "Aberta".
 *
 * 2. Ao concluir a OS no sistema web (doPost):
 *    - Localiza a linha correspondente na Planilha de Respostas do Formulário.
 *    - Atualiza o Status para "Concluída", Data de Conclusão, Técnico,
 *      O QUE FOI FEITO (Serviço Realizado) e Materiais Gastos.
 *    - Mantém uma aba dedicada "Conclusões OS" com histórico sincronizado.
 *    - Envia automaticamente um e-mail de confirmação formatado para o endereço
 *      que respondeu o formulário, detalhando tudo o que foi realizado!
 *
 * Configuração no Apps Script (Configurações do Projeto > Propriedades do script):
 * - FORM_WEBHOOK_SECRET: Segredo compartilhado com a função form-os do Supabase.
 * - OS_SHEET_WEBHOOK_SECRET: Segredo compartilhado com a função complete-os do Supabase.
 * - SPREADSHEET_ID: (Opcional se o script estiver vinculado à própria planilha).
 */

const SUPABASE_FORM_FUNCTION_URL =
  "https://hanhihcwfhehudqvqxkz.supabase.co/functions/v1/form-os";

/**
 * Webhook acionado pela Edge Function 'complete-os' quando uma OS é concluída.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Nenhum dado recebido no POST" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("OS_SHEET_WEBHOOK_SECRET");

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Não autorizado: segredo inválido ou não configurado" }, 401);
    }

    const os = payload.os;
    if (!os || !os.numero) {
      return jsonResponse({ ok: false, error: "Dados da OS incompletos no payload" }, 400);
    }

    const spreadsheet = obterPlanilha();
    if (!spreadsheet) {
      throw new Error("Não foi possível acessar a planilha. Configure SPREADSHEET_ID nas Propriedades do script.");
    }

    const dataConclusaoFmt = formatarDataBr(os.dataConclusao);
    const materiaisTexto = formatarMateriaisTexto(os.materiais);
    const servicoRealizado = os.servico || "Serviço de manutenção concluído conforme vistoria técnica.";
    const tecnicoResponsavel = os.tecnico || "Equipe de Manutenção";

    // 1. Atualizar a linha correspondente na Planilha de Respostas do Formulário
    const formSheet = obterAbaRespostas(spreadsheet);
    garantirCabecalhosRespostas(formSheet);

    let emailRespondente = "";
    let linhaFormularioAtualizada = null;

    if (formSheet) {
      const matchRow = localizarLinhaOs(formSheet, os);
      if (matchRow > 1) {
        linhaFormularioAtualizada = matchRow;

        // Tentar obter o e-mail do respondente direto da linha (Coluna B padrão do Forms)
        const emailLinha = String(formSheet.getRange(matchRow, 2).getValue() || "").trim();
        if (validarEmail(emailLinha)) {
          emailRespondente = emailLinha;
        }

        // Se não achou na coluna 2, faz uma busca nas primeiras colunas dessa linha
        if (!emailRespondente) {
          const valoresLinha = formSheet.getRange(matchRow, 1, 1, 6).getValues()[0];
          for (let i = 0; i < valoresLinha.length; i++) {
            const val = String(valoresLinha[i] || "").trim();
            if (validarEmail(val)) {
              emailRespondente = val;
              break;
            }
          }
        }

        // Atualizar as colunas de fechamento na planilha do formulário
        // Col 6 (F): OS Nº
        // Col 7 (G): Status
        // Col 8 (H): Data Conclusão
        // Col 9 (I): Técnico Responsável
        // Col 10 (J): O Que Foi Feito (Serviço Realizado)
        // Col 11 (K): Materiais Utilizados
        formSheet.getRange(matchRow, 6).setValue("#" + os.numero);
        formSheet.getRange(matchRow, 7).setValue("Concluída");
        formSheet.getRange(matchRow, 8).setValue(dataConclusaoFmt);
        formSheet.getRange(matchRow, 9).setValue(tecnicoResponsavel);
        formSheet.getRange(matchRow, 10).setValue(servicoRealizado);
        formSheet.getRange(matchRow, 11).setValue(materiaisTexto);
      }
    }

    // 2. Determinar o e-mail final de destino
    const emailDestino =
      emailRespondente ||
      (validarEmail(os.emailSolicitante) ? os.emailSolicitante.trim() : "") ||
      (validarEmail(os.solicitante) ? os.solicitante.trim() : "") ||
      (validarEmail(os.escolaEmail) ? os.escolaEmail.trim() : "");

    // 3. Atualizar ou registrar na aba dedicada "Conclusões OS"
    const sheetConclusoes = spreadsheet.getSheetByName("Conclusões OS") ||
      spreadsheet.insertSheet("Conclusões OS");
    garantirCabecalhosConclusoes(sheetConclusoes);

    const linhaConclusoes = [
      "#" + os.numero,
      "Concluída",
      dataConclusaoFmt,
      os.escola || "",
      os.solicitante || "",
      emailDestino || "Não informado",
      tecnicoResponsavel,
      os.problema || "",
      servicoRealizado,
      materiaisTexto
    ];

    const matchConclusoes = sheetConclusoes.getLastRow() > 1
      ? sheetConclusoes.getRange(2, 1, sheetConclusoes.getLastRow() - 1, 1)
          .createTextFinder(String(os.numero)).findNext()
      : null;

    if (matchConclusoes) {
      sheetConclusoes.getRange(matchConclusoes.getRow(), 1, 1, linhaConclusoes.length)
        .setValues([linhaConclusoes]);
    } else {
      sheetConclusoes.appendRow(linhaConclusoes);
    }

    // 4. Enviar e-mail de volta para o solicitante com o que foi feito
    let emailEnviado = false;
    let emailErro = null;

    if (emailDestino) {
      try {
        const assunto = "[Manutenção Concluída] OS #" + os.numero + " — " + (os.escola || "Porto Belo");
        const htmlBody = gerarHtmlEmailConclusao(os, dataConclusaoFmt, servicoRealizado, tecnicoResponsavel, materiaisTexto);

        MailApp.sendEmail({
          to: emailDestino,
          subject: assunto,
          htmlBody: htmlBody,
          name: "Gestão de Manutenção Escolar"
        });
        emailEnviado = true;
        Logger.log("E-mail de conclusão enviado com sucesso para: " + emailDestino);

        // Se encontrou a linha do formulário, marcar na coluna 12 (L)
        if (formSheet && linhaFormularioAtualizada) {
          formSheet.getRange(linhaFormularioAtualizada, 12).setValue("E-mail enviado para " + emailDestino);
        }
      } catch (mailErr) {
        emailErro = String(mailErr);
        Logger.log("Falha ao enviar e-mail: " + mailErr);
        if (formSheet && linhaFormularioAtualizada) {
          formSheet.getRange(linhaFormularioAtualizada, 12).setValue("Erro e-mail: " + emailErro);
        }
      }
    } else {
      Logger.log("Nenhum e-mail válido encontrado para envio na OS #" + os.numero);
      if (formSheet && linhaFormularioAtualizada) {
        formSheet.getRange(linhaFormularioAtualizada, 12).setValue("Sem e-mail cadastrado");
      }
    }

    return jsonResponse({
      ok: true,
      osNumero: os.numero,
      planilhaAtualizada: true,
      linhaFormulario: linhaFormularioAtualizada,
      emailEnviadoPara: emailEnviado ? emailDestino : null,
      emailErro: emailErro
    });
  } catch (error) {
    Logger.log("Erro no doPost: " + error);
    return jsonResponse({ ok: false, error: String(error) });
  }
}

/**
 * Função acionada ao enviar formulário no Google Forms.
 * Cria a OS no Supabase e preenche a coluna F (OS Nº) e G (Status) na planilha.
 */
function enviarParaSupabase(e) {
  if (!e || !e.values) {
    Logger.log("Nenhum evento de envio encontrado.");
    return;
  }

  const secret = PropertiesService.getScriptProperties().getProperty("FORM_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("Configure FORM_WEBHOOK_SECRET nas Propriedades do script.");
  }

  const values = e.values;
  // Estrutura padrão do Google Forms:
  // values[0] = Carimbo de data/hora
  // values[1] = Endereço de e-mail (se coleta ativada)
  // values[2] = Escola / Setor
  // values[3] = Solicitante (Nome)
  // values[4] = Descrição do problema
  let emailSolicitante = "";
  if (validarEmail(values[1])) {
    emailSolicitante = values[1].trim();
  } else {
    for (let i = 0; i < values.length; i++) {
      if (validarEmail(values[i])) {
        emailSolicitante = values[i].trim();
        break;
      }
    }
  }

  const nomeEscola = (values[2] || "").trim();
  const solicitante = values[3] || emailSolicitante || "Solicitante Form";
  const descricaoProblema = values[4] || "Manutenção solicitada via formulário";

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

  // Escrever o número da OS e status gerados diretamente na planilha de respostas
  try {
    const resData = JSON.parse(body);
    if (resData && resData.numero) {
      let sheet = null;
      let row = null;

      if (e.range) {
        sheet = e.range.getSheet();
        row = e.range.getRow();
      } else {
        const ss = obterPlanilha();
        sheet = obterAbaRespostas(ss);
        if (sheet) row = sheet.getLastRow();
      }

      if (sheet && row) {
        garantirCabecalhosRespostas(sheet);
        sheet.getRange(row, 6).setValue("#" + resData.numero);
        sheet.getRange(row, 7).setValue("Aberta");
      }
    }
  } catch (err) {
    Logger.log("Aviso: Não foi possível anotar a OS na linha da planilha: " + err);
  }
}

/* =====================================================
   FUNÇÕES AUXILIARES E FORMATAÇÃO DE E-MAIL
   ===================================================== */

function obterPlanilha() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      Logger.log("Não foi possível abrir pelo SPREADSHEET_ID: " + e);
    }
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return null;
  }
}

function obterAbaRespostas(ss) {
  if (!ss) return null;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName().toLowerCase();
    if (name.includes("respostas") || name.includes("form responses")) {
      return sheets[i];
    }
  }
  return sheets[0];
}

function garantirCabecalhosRespostas(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return;
  const headers = [
    "OS Nº",
    "Status",
    "Data Conclusão",
    "Técnico Responsável",
    "O Que Foi Feito (Serviço Realizado)",
    "Materiais Utilizados",
    "Notificação E-mail"
  ];
  const colInicio = 6; // Coluna F
  const cellF1 = sheet.getRange(1, colInicio).getValue();
  if (!cellF1) {
    sheet.getRange(1, colInicio, 1, headers.length).setValues([headers]);
    sheet.getRange(1, colInicio, 1, headers.length).setFontWeight("bold");
  }
}

function garantirCabecalhosConclusoes(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    const headers = [
      "OS Nº",
      "Status",
      "Data Conclusão",
      "Escola / Setor",
      "Solicitante",
      "E-mail Notificado",
      "Técnico Responsável",
      "Problema Relatado",
      "O Que Foi Feito (Serviço Realizado)",
      "Materiais Utilizados"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
}

function localizarLinhaOs(sheet, os) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  // 1. Tentar encontrar pelo número da OS na coluna 6 (F)
  const rangeNum = sheet.getRange(2, 6, lastRow - 1, 1);
  const finder = rangeNum.createTextFinder(String(os.numero)).findNext();
  if (finder) return finder.getRow();

  // 2. Se não achou na coluna 6, busca de trás para frente comparando o problema e solicitante
  const data = sheet.getRange(2, 1, lastRow - 1, Math.min(sheet.getLastColumn(), 6)).getValues();
  const probAlvo = normalizarTexto(os.problema);
  const solAlvo = normalizarTexto(os.solicitante);

  for (let i = data.length - 1; i >= 0; i--) {
    const rowNum = i + 2;
    const linha = data[i];
    const probLinha = normalizarTexto(linha[4]); // Coluna E
    const solLinha = normalizarTexto(linha[3]);  // Coluna D

    if (probAlvo && probLinha && (probLinha.includes(probAlvo) || probAlvo.includes(probLinha))) {
      return rowNum;
    }
    if (solAlvo && solLinha && solLinha === solAlvo) {
      return rowNum;
    }
  }

  return -1;
}

function normalizarTexto(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function validarEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatarDataBr(isoDate) {
  if (!isoDate) return Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  const s = String(isoDate).split("T")[0].split("-");
  if (s.length === 3) return s[2] + "/" + s[1] + "/" + s[0];
  return isoDate;
}

function formatarMateriaisTexto(materiais) {
  if (!materiais || !materiais.length) return "Nenhum material cadastrado.";
  return materiais.map(function(m) {
    return (m.quantidade || 1) + "x " + (m.descricao || "Item");
  }).join("; ");
}

/**
 * Cria um e-mail HTML elegante e moderno para o solicitante.
 */
function gerarHtmlEmailConclusao(os, dataConclusao, servicoRealizado, tecnico, materiaisTexto) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; }
      .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
      .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
      .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
      .header p { margin: 0; font-size: 13px; opacity: 0.9; }
      .status-pill { display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 12px; border-radius: 9999px; margin-top: 12px; }
      .content { padding: 24px; }
      .greeting { font-size: 15px; margin-bottom: 16px; color: #334155; }
      .service-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
      .service-box-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #166534; margin: 0 0 8px 0; }
      .service-box-text { font-size: 14px; line-height: 1.5; color: #14532d; margin: 0; font-weight: 500; }
      .info-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      .info-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
      .info-label { color: #64748b; font-weight: 600; width: 38%; }
      .info-value { color: #0f172a; font-weight: 500; }
      .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Gestão de Manutenção Escolar</h1>
        <p>Prefeitura Municipal de Porto Belo</p>
        <span class="status-pill">Chamado Concluído</span>
      </div>

      <div class="content">
        <p class="greeting">Olá, <strong>${os.solicitante || "Solicitante"}</strong>!</p>
        <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0;">
          Informamos que o seu chamado de manutenção foi <strong>concluído com sucesso</strong> pela nossa equipe técnica. Confira abaixo o resumo do que foi realizado:
        </p>

        <div class="service-box">
          <div class="service-box-title">O que foi feito (Serviço Realizado):</div>
          <div class="service-box-text">${servicoRealizado}</div>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Número da OS:</td>
            <td class="info-value"><strong>#${os.numero}</strong></td>
          </tr>
          <tr>
            <td class="info-label">Unidade / Escola:</td>
            <td class="info-value">${os.escola || "Não informada"}</td>
          </tr>
          <tr>
            <td class="info-label">Problema Relatado:</td>
            <td class="info-value">${os.problema || "Solicitação de manutenção"}</td>
          </tr>
          <tr>
            <td class="info-label">Técnico Responsável:</td>
            <td class="info-value">${tecnico}</td>
          </tr>
          <tr>
            <td class="info-label">Materiais Utilizados:</td>
            <td class="info-value">${materiaisTexto}</td>
          </tr>
          <tr>
            <td class="info-label">Data de Conclusão:</td>
            <td class="info-value">${dataConclusao}</td>
          </tr>
        </table>
      </div>

      <div class="footer">
        Esta é uma mensagem automática de notificação do Sistema de Manutenção Escolar.<br>
        Em caso de dúvidas ou nova demanda, abra um novo chamado pelo formulário da sua unidade.
      </div>
    </div>
  </body>
  </html>
  `;
}

function jsonResponse(body, status) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Função de teste para validar permissões de envio de e-mail e planilha
 * no editor do Apps Script (Menu Executar > testarConclusaoManual).
 */
function testarConclusaoManual() {
  const ss = obterPlanilha();
  Logger.log("Planilha ativa: " + (ss ? ss.getName() : "Não encontrada"));
  const emailUsuario = Session.getActiveUser().getEmail();
  Logger.log("E-mail da sessão atual: " + emailUsuario);

  if (emailUsuario) {
    MailApp.sendEmail({
      to: emailUsuario,
      subject: "[Teste] Manutenção Escolar - Sistema de Notificação",
      htmlBody: "<p>Este é um e-mail de teste para confirmar que as permissões do Apps Script estão ativas!</p>",
      name: "Gestão de Manutenção Escolar"
    });
    Logger.log("E-mail de teste enviado para " + emailUsuario);
  }
}
