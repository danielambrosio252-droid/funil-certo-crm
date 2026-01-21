import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, action } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = "";
    switch (action) {
      case "correct":
        systemPrompt = `Você é um corretor de texto em português brasileiro. 
Corrija APENAS erros de ortografia, gramática e pontuação do texto fornecido.
NÃO altere o significado, tom ou estilo do texto.
Retorne APENAS o texto corrigido, sem explicações.`;
        break;
      case "improve":
        systemPrompt = `Você é um escritor profissional em português brasileiro.
Melhore o texto fornecido tornando-o mais claro, profissional e bem escrito.
Mantenha o mesmo significado e intenção.
Retorne APENAS o texto melhorado, sem explicações.`;
        break;
      case "formal":
        systemPrompt = `Você é um especialista em comunicação formal em português brasileiro.
Reescreva o texto fornecido em um tom formal e profissional.
Mantenha o mesmo significado.
Retorne APENAS o texto formal, sem explicações.`;
        break;
      case "friendly":
        systemPrompt = `Você é um especialista em comunicação amigável em português brasileiro.
Reescreva o texto fornecido em um tom amigável e acolhedor, adequado para atendimento ao cliente.
Mantenha o mesmo significado.
Retorne APENAS o texto amigável, sem explicações.`;
        break;
      case "shorten":
        systemPrompt = `Você é um editor de texto em português brasileiro.
Encurte o texto fornecido mantendo a mensagem principal.
Seja conciso e direto.
Retorne APENAS o texto resumido, sem explicações.`;
        break;
      case "expand":
        systemPrompt = `Você é um escritor em português brasileiro.
Expanda o texto fornecido adicionando mais detalhes e contexto.
Mantenha o mesmo tom e significado.
Retorne APENAS o texto expandido, sem explicações.`;
        break;
      default:
        systemPrompt = `Você é um corretor de texto em português brasileiro.
Corrija erros de ortografia, gramática e pontuação do texto fornecido.
Retorne APENAS o texto corrigido, sem explicações.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process text" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content?.trim() || text;

    return new Response(
      JSON.stringify({ result: improvedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in text-improve function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
