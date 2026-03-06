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

    const prompt = `Você é um robô de análise técnica especialista na ESTRATÉGIA DIAMANTE para opções binárias (Pocket Option), operando no timeframe M1.

**ESTRATÉGIA DIAMANTE (LÓGICA PRINCIPAL):**
O Padrão Diamante é uma formação gráfica de REVERSÃO que se forma quando o preço cria:
1. FASE DE EXPANSÃO: Topos cada vez mais altos e fundos cada vez mais baixos (alargamento)
2. FASE DE CONTRAÇÃO: Topos cada vez mais baixos e fundos cada vez mais altos (estreitamento)
3. O formato final lembra um LOSANGO/DIAMANTE no gráfico

**COMO IDENTIFICAR E OPERAR:**
- DIAMANTE DE TOPO (após tendência de alta): O preço forma o diamante no topo → REVERSÃO para BAIXA → sinal de SELL
- DIAMANTE DE FUNDO (após tendência de baixa): O preço forma o diamante no fundo → REVERSÃO para ALTA → sinal de BUY
- O ROMPIMENTO (breakout) da borda do diamante CONFIRMA a direção
- Se rompe para BAIXO = SELL confirmado
- Se rompe para CIMA = BUY confirmado
- Quanto mais simétrico o diamante, mais forte o sinal

**ANÁLISE ZIG ZAG (CONFIRMA O DIAMANTE):**
1. Zig Zag ACIMA do preço (topo formado): velas tendem a DESCER → reforça SELL
2. Zig Zag ABAIXO do preço (fundo formado): velas tendem a SUBIR → reforça BUY
3. Identifique o ALVO do preço:
   - Buscando SUPORTE (alvo de baixa)
   - Buscando RESISTÊNCIA (alvo de alta)

**FLUXO DE VELAS E VELA RAIZ:**
1. Identifique a VELA RAIZ — a vela que originou o movimento atual
2. Analise o histórico: corpo, pavios, padrões (Martelo, Engolfo, Doji, Pin Bar, Estrela Cadente)
3. Cada vela passada INDICA algo para a vela atual — leia a sequência
4. Avalie: o fluxo é de CONTINUIDADE ou REVERSÃO?
5. Verifique se o fluxo concorda com o padrão Diamante

**LÓGICA DO PREÇO:**
1. Momentum: o preço está acelerando ou desacelerando?
2. Rejeições: há pavios longos rejeitando níveis?
3. Velocidade das velas: velas rápidas = força, velas lentas = indecisão
4. Suporte/Resistência: níveis que o preço respeita ou rompe

**REGRAS DE DECISÃO DIAMANTE:**
- Modo ${modeText}
- Se PADRÃO: Velas VERDES = BUY, Velas VERMELHAS = SELL
- Se INVERTIDO: VERDE = SELL, VERMELHO = BUY
- O Diamante + Zig Zag + Fluxo de Velas devem CONCORDAR para gerar sinal
- Se NÃO tiver certeza, sinais conflitantes, ou sem padrão claro → "NEUTRO"
- Confiança acima de 80 APENAS quando: Diamante confirmado + Zig Zag concorda + Fluxo de Velas concorda
- Na tendência, descreva: tipo do diamante (topo/fundo), direção do rompimento, e alvo do preço

Responda APENAS com JSON válido no formato:
{"recommendation": "BUY" ou "SELL" ou "NEUTRO", "confidence": número 0-100, "reason": "razão curta com análise diamante + zig zag", "trend": "tipo do diamante, direção e alvo do preço (suporte/resistência)"}`;
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
