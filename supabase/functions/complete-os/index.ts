import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return jsonResponse({ error: "Sessão não autenticada" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Sessão não autenticada" }, 401);

    const { osId } = await req.json();
    if (typeof osId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(osId)) {
      return jsonResponse({ error: "Identificador da OS inválido" }, 400);
    }

    const webhookUrl = Deno.env.get("SHEETS_COMPLETION_WEBHOOK_URL");
    const webhookSecret = Deno.env.get("OS_SHEET_WEBHOOK_SECRET");
    if (!webhookUrl || !webhookSecret) {
      return jsonResponse({ error: "Integração com a planilha não configurada" }, 503);
    }

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: os, error } = await supabase
      .from("ordens_servico")
      .select("numero,data_conclusao,solicitante,tecnico,descricao_problema,descricao_servico,status,form_response_id,escola:escola_id(nome,email),os_materiais(descricao,quantidade)")
      .eq("id", osId)
      .single();

    if (error || !os) return jsonResponse({ error: "OS não encontrada" }, 404);
    if (os.status !== "Concluída") return jsonResponse({ error: "A OS ainda não foi concluída" }, 409);

    const emailSolicitante =
      os.form_response_id ||
      (os.solicitante && os.solicitante.includes("@") ? os.solicitante : "") ||
      (os.escola?.email || "");

    const sheetResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: webhookSecret,
        os: {
          numero: os.numero,
          dataConclusao: os.data_conclusao,
          escola: os.escola?.nome || "",
          escolaEmail: os.escola?.email || "",
          solicitante: os.solicitante,
          emailSolicitante,
          tecnico: os.tecnico,
          problema: os.descricao_problema,
          servico: os.descricao_servico,
          materiais: os.os_materiais || [],
        },
      }),
    });
    const sheetResult = await sheetResponse.json().catch(() => null);

    if (!sheetResponse.ok || !sheetResult?.ok) {
      console.error("Falha na integração com a planilha", sheetResponse.status, sheetResult?.error);
      return jsonResponse({ error: "Não foi possível atualizar a planilha" }, 502);
    }

    return jsonResponse({
      ok: true,
      emailEnviadoPara: sheetResult.emailEnviadoPara || null,
      planilhaAtualizada: sheetResult.ok || false,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Falha ao sincronizar a OS com a planilha" }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}