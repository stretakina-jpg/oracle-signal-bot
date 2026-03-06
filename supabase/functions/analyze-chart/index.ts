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

**Análise Requerida:**
1. **Price Action:** Corpo da vela, pavios, padrões (Martelo, Engolfo, Doji, Pin Bar, etc.)
2. **Tendência:** Alta, baixa ou lateral no contexto imediato
3. **Suporte/Resistência:** Níveis próximos e reação do preço
4. **Figuras Gráficas:** Topos/fundos duplos, triângulos, bandeiras, etc.
5. **Fluxo de Velas:** Sequência de velas anteriores, padrão de continuidade ou reversão
6. **Vela Raiz:** Identificar a vela raiz (origem do movimento) e sua influência no sinal
7. **Lógica do Preço:** Momentum, velocidade do movimento, rejeições de preço

**Filtros Avançados:**
- Verificar confluência de múltiplos sinais antes de gerar recomendação
- Analisar volume implícito pelo tamanho dos corpos e pavios
- Considerar contexto de mercado (tendência macro vs micro)
- Identificar armadilhas (bull trap / bear trap)
- Avaliar força da vela atual vs velas anteriores

**Regras de Decisão:**
- Modo ${modeText}
- Se PADRÃO: Velas VERDES = BUY, Velas VERMELHAS = SELL
- Se INVERTIDO: VERDE = SELL, VERMELHO = BUY
- Confiança baseada na clareza e confluência dos sinais
- Se não houver sinal claro, retorne HOLD
- Apenas sinais com alta probabilidade devem ter confiança acima de 80

Responda APENAS com JSON válido no formato:
{"recommendation": "BUY" ou "SELL" ou "HOLD", "confidence": número 0-100, "reason": "razão curta", "trend": "descrição da tendência"}`;

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
