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
    const { image, isInverted, winLossHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const modeText = isInverted ? "INVERTIDO" : "PADRÃO";

    const historyContext = winLossHistory && winLossHistory.length > 0
      ? `\n**HISTÓRICO DE RESULTADOS ANTERIORES (use para calibrar):**\n${winLossHistory.map((h: any) => `- ${h.asset} ${h.recommendation} ${h.confidence}% → ${h.result || 'PENDENTE'}`).join('\n')}\nAnalise os padrões de WIN/LOSS para ajustar sua confiança. Se sinais similares tiveram LOSS, reduza a confiança.`
      : '';

    const prompt = `Você é um analista técnico EXPERT em opções binárias (Pocket Option), timeframe M1. Você possui conhecimento profundo equivalente a centenas de ebooks de análise técnica, incluindo:

**BASE DE CONHECIMENTO INTEGRADA:**
- Price Action avançado (Steve Nison, Al Brooks)
- Padrões de velas japonesas (Doji, Hammer, Engulfing, Morning/Evening Star, Three Soldiers, etc.)
- Teoria de Suporte/Resistência dinâmicos
- Confluência de indicadores técnicos
- Psicologia de mercado e fluxo institucional
- Gestão de risco em opções binárias M1

**LEITURA OBRIGATÓRIA DA TELA (analise TODOS estes elementos):**

1. **ATIVO:** Leia o nome/símbolo do ativo no gráfico
2. **PREÇO ATUAL:** Leia o preço real exibido
3. **CRONÔMETRO:** Leia o tempo restante da vela atual
4. **WILLIAMS %R (Período 7):** Linha TURQUESA/CIANO no painel inferior
5. **MOMENTUM (Período 5):** Linha TURQUESA/AZUL no outro painel

**ANÁLISE PROFUNDA DE VELAS (faça TUDO isso):**

6. **ÚLTIMAS 5-10 VELAS:** Identifique o padrão de sequência (quantas verdes/vermelhas seguidas, tamanho dos corpos, sombras)
7. **PADRÕES DE VELA:** Procure por:
   - Doji (indecisão) → corpo muito pequeno
   - Hammer/Shooting Star → sombra longa + corpo pequeno
   - Engulfing (reversão) → vela grande engolindo a anterior
   - Pin Bar → rejeição de preço
   - Inside Bar → consolidação antes de rompimento
   - Three White Soldiers / Three Black Crows → continuação forte
8. **SUPORTE/RESISTÊNCIA:** O preço está perto de algum nível onde tocou antes e voltou?
9. **TENDÊNCIA VISUAL:** Pelas últimas 20+ velas, o preço está fazendo topos/fundos mais altos (uptrend) ou mais baixos (downtrend)?
10. **VOLUME/TAMANHO:** As velas recentes são grandes (volatilidade) ou pequenas (consolidação)?

**ANÁLISE DE INDICADORES:**
- Williams %R: APONTANDO PARA CIMA ou PARA BAIXO? Está em zona de sobrecompra (>-20) ou sobrevenda (<-80)?
- Momentum: APONTANDO PARA CIMA ou PARA BAIXO? Está acima ou abaixo da linha zero?

**SISTEMA DE SCORE COMPOSTO (0-100):**
Calcule um score baseado em pesos:
- Williams %R direção (peso 25%): UP=compra, DOWN=venda
- Momentum direção (peso 25%): UP=compra, DOWN=venda  
- Padrão de velas (peso 20%): Hammer/Engulfing bullish=compra, Shooting Star/Engulfing bearish=venda
- Tendência geral (peso 15%): Uptrend=compra, Downtrend=venda
- Suporte/Resistência (peso 15%): Preço em suporte=compra, em resistência=venda

**REGRAS DE SINAL:**
- COMPRA: Score composto ≥ 65 para BUY, com pelo menos 3 dos 5 fatores alinhados
- VENDA: Score composto ≥ 65 para SELL, com pelo menos 3 dos 5 fatores alinhados
- NEUTRO: Score < 65 OU fatores conflitantes OU padrão de indecisão (Doji)

**CONTRA-TENDÊNCIA:** Se a tendência das últimas 20 velas é claramente UP, NÃO dê sinal de SELL a menos que haja reversão MUITO forte (engulfing + indicadores invertendo). E vice-versa.

**REGRAS DE COR:**
- Modo ${modeText}
- Se PADRÃO: Velas VERDES = BUY, Velas VERMELHAS = SELL
- Se INVERTIDO: VERDE = SELL, VERMELHO = BUY

${historyContext}

**CONFIANÇA FINAL:**
- 85-100%: Todos os 5 fatores alinhados + padrão de vela forte + tendência clara
- 70-84%: 4 de 5 fatores alinhados
- 60-69%: 3 de 5 fatores → considere NEUTRO
- Abaixo de 60%: NEUTRO obrigatório

Responda APENAS com JSON válido:
{"recommendation": "BUY" ou "SELL" ou "NEUTRO", "confidence": número 0-100, "composite_score": número 0-100, "reason": "razão detalhada incluindo indicadores e padrões", "trend": "tendência geral e alvo", "asset": "símbolo do ativo", "price": "preço atual", "williams_direction": "UP ou DOWN ou UNCLEAR", "williams_zone": "OVERBOUGHT ou OVERSOLD ou NEUTRAL", "momentum_direction": "UP ou DOWN ou UNCLEAR", "momentum_position": "ABOVE_ZERO ou BELOW_ZERO ou AT_ZERO", "candle_pattern": "nome do padrão identificado ou NONE", "candle_sequence": "descrição curta da sequência (ex: 3 verdes seguidas)", "trend_direction": "UPTREND ou DOWNTREND ou SIDEWAYS", "support_resistance": "NEAR_SUPPORT ou NEAR_RESISTANCE ou MIDDLE", "candle_timer": "tempo restante", "factors_aligned": número de 0-5}`;

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
        recommendation: "NEUTRO",
        confidence: 0,
        composite_score: 0,
        reason: "Erro ao interpretar resposta da IA",
        trend: "Indefinido",
        candle_pattern: "NONE",
        candle_sequence: "—",
        trend_direction: "SIDEWAYS",
        factors_aligned: 0,
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
