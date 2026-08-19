import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-form-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret = Deno.env.get("FORM_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-form-secret");

  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { nomeEscola, emailSolicitante, solicitante, descricaoProblema } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let escolaId: string | null = null;

    if (nomeEscola?.trim()) {
      const { data: escola } = await supabase
        .from("escolas")
        .select("id")
        .eq("nome", nomeEscola.trim())
        .maybeSingle();

      if (escola) {
        escolaId = escola.id;
      } else {
        const { data: novaEscola, error: escolaError } = await supabase
          .from("escolas")
          .insert({
            nome: nomeEscola.trim(),
            email: emailSolicitante || "",
          })
          .select("id")
          .single();

        if (escolaError) throw escolaError;
        escolaId = novaEscola.id;
      }
    }

    const { data, error } = await supabase
      .from("ordens_servico")
      .insert({
        escola_id: escolaId,
        solicitante: solicitante || emailSolicitante || "Solicitante Form",
        descricao_problema: descricaoProblema || "Manutenção solicitada via formulário",
        status: "Aberta",
        origem: "Formulario",
        data_abertura: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Falha ao registrar a solicitação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
