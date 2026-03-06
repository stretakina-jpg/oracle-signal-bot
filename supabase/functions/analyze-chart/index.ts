import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, isInverted } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const modeText = isInverted ? "INVERTIDO" : "PADRÃO";

    const prompt = `Analise este gráfico de trading no nascimento de uma nova vela de 1 minuto, foco em opções binárias (Pocket Option).

**ANÁLISE ZIG ZAG (PRIORIDADE MÁXIMA):**
1. Identifique o padrão Zig Zag no gráfico:
   - Se o Zig Zag está ACIMA do preço (topo formado): normalmente as velas DESCEM → tendência de SELL
   - Se o Zig Zag está ABAIXO do preço (fundo formado): normalmente as velas SOBEM → tendência de BUY
2. Determine o ALVO do preço baseado no Zig Zag:
   - O preço pode ir buscar um SUPORTE (alvo de baixa)
   - O preço pode ir buscar uma RESISTÊNCIA (alvo de alta)
   - Identifique qual nível o preço está buscando no momento

**CONTEXTO DE VELAS PASSADAS:**
1. Analise o histórico das últimas velas: corpo, pavios, padrões (Martelo, Engolfo, Doji, Pin Bar, etc.)
2. Identifique o que cada vela passada INDICA para a vela atual
3. Avalie a sequência: continuidade ou reversão?
4. Identifique a VELA RAIZ (origem do movimento) e sua influência

**ANÁLISE COMPLETA:**
1. **Price Action:** Corpo da vela atual, pavios, padrão que ela forma
2. **Tendência Zig Zag:** Direção indicada pelo zig zag (acima = queda, abaixo = alta)
3. **Suporte/Resistência:** Níveis que o preço está buscando como alvo
4. **Figuras Gráficas:** Topos/fundos duplos, triângulos, bandeiras
5. **Fluxo de Velas:** Sequência e força das velas anteriores direcionando a atual
6. **Lógica do Preço:** Momentum, velocidade, rejeições

**REGRAS DE DECISÃO:**
- Modo ${modeText}
- Se PADRÃO: Velas VERDES = BUY, Velas VERMELHAS = SELL
- Se INVERTIDO: VERDE = SELL, VERMELHO = BUY
- O sinal do Zig Zag deve CONCORDAR com o Price Action para gerar sinal
- Se NÃO tiver certeza ou os sinais forem conflitantes → retorne "NEUTRO" (não HOLD)
- Confiança acima de 80 APENAS quando Zig Zag + Price Action + Fluxo de Velas concordam
- Descreva na tendência o alvo do preço (ex: "Buscando suporte em X" ou "Buscando resistência em Y")

Responda APENAS com JSON válido no formato:
{"recommendation": "BUY" ou "SELL" ou "NEUTRO", "confidence": número 0-100, "reason": "razão curta incluindo análise zig zag", "trend": "descrição da tendência e alvo do preço"}`;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      result = {
        recommendation: "HOLD",
        confidence: 0,
        reason: "Erro ao interpretar resposta da IA",
        trend: "Indefinido",
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-chart error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
