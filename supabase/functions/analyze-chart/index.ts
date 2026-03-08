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

    const prompt = `Você é um analista técnico MASTER em opções binárias (Pocket Option), timeframe M1. Você possui conhecimento profundo equivalente a centenas de ebooks e cursos completos de análise técnica e Price Action.

**BASE DE CONHECIMENTO INTEGRADA:**
- Price Action avançado (Steve Nison, Al Brooks, Lance Beggs)
- Padrões de velas japonesas completos (40+ padrões)
- Análise de tendência por LTA/LTB (Linhas de Tendência de Alta/Baixa)
- Figuras gráficas clássicas (triângulos, W, M, V, topo duplo/triplo, fundo duplo/triplo)
- Topos e fundos: topos sobre topos (uptrend), fundos sobre fundos (downtrend)
- Teoria de Suporte/Resistência dinâmicos
- Psicologia de mercado e fluxo institucional

**LEITURA OBRIGATÓRIA DA TELA (analise TODOS estes elementos):**

1. **ATIVO:** Leia o nome/símbolo do ativo no gráfico
2. **PREÇO ATUAL:** Leia o preço real exibido
3. **CRONÔMETRO:** Leia o tempo restante da vela atual

**ANÁLISE PROFUNDA DE VELAS (faça TUDO isso):**

4. **ÚLTIMAS 20-30 VELAS:** Identifique a sequência completa (quantas verdes/vermelhas seguidas, tamanho dos corpos, sombras superiores e inferiores)
5. **PADRÕES DE VELA INDIVIDUAIS:** Procure por TODOS estes:
   - Doji (indecisão) → corpo muito pequeno, sombras iguais
   - Doji Libélula / Doji Lápide → sombra longa em uma direção
   - Hammer / Inverted Hammer → sombra inferior longa + corpo pequeno no topo
   - Shooting Star → sombra superior longa + corpo pequeno na base
   - Engulfing Bullish/Bearish → vela grande engolindo a anterior completamente
   - Harami Bullish/Bearish → vela pequena dentro do corpo da anterior
   - Pin Bar → rejeição forte de preço com pavio longo
   - Inside Bar → consolidação antes de rompimento
   - Three White Soldiers / Three Black Crows → 3 velas fortes seguidas
   - Morning Star / Evening Star → padrão de 3 velas de reversão
   - Tweezer Top / Tweezer Bottom → 2 velas com mesmo high ou low
   - Spinning Top → corpo pequeno com sombras iguais

6. **PADRÕES DE MÚLTIPLAS VELAS (sequência):**
   - 3+ velas da mesma cor → continuação forte
   - Alternância verde/vermelha → indecisão/lateralidade
   - Velas diminuindo de tamanho → perda de momentum
   - Velas aumentando de tamanho → aceleração de tendência

**ANÁLISE DE TENDÊNCIA POR LTA/LTB:**

7. **LTA (Linha de Tendência de Alta):** Conecte os fundos ascendentes das últimas 20+ velas. Se os fundos estão subindo → tendência de alta confirmada. Se o preço ROMPE a LTA para baixo → possível reversão bearish.
8. **LTB (Linha de Tendência de Baixa):** Conecte os topos descendentes das últimas 20+ velas. Se os topos estão descendo → tendência de baixa confirmada. Se o preço ROMPE a LTB para cima → possível reversão bullish.

**ANÁLISE DE TOPOS E FUNDOS:**

9. **TOPOS SOBRE TOPOS (Higher Highs):** Cada topo é mais alto que o anterior → UPTREND forte → favorece CALL
10. **FUNDOS SOBRE FUNDOS (Lower Lows):** Cada fundo é mais baixo que o anterior → DOWNTREND forte → favorece PUT
11. **TOPOS E FUNDOS NO MESMO NÍVEL:** → Lateralidade → NEUTRO
12. **DIVERGÊNCIA:** Topos descendentes + fundos ascendentes → Triângulo convergente → aguardar rompimento

**FIGURAS GRÁFICAS CLÁSSICAS:**

13. **PADRÃO W (Fundo Duplo):** Preço toca suporte, sobe, volta ao suporte, sobe novamente formando W → FORTE SINAL DE COMPRA
14. **PADRÃO M (Topo Duplo):** Preço toca resistência, desce, volta à resistência, desce novamente formando M → FORTE SINAL DE VENDA
15. **PADRÃO V (Reversão Aguda):** Queda abrupta seguida de subida forte em V → SINAL DE COMPRA. V invertido = SINAL DE VENDA
16. **TRIÂNGULO ASCENDENTE:** Topos no mesmo nível + fundos subindo → provável rompimento para cima → CALL
17. **TRIÂNGULO DESCENDENTE:** Fundos no mesmo nível + topos descendo → provável rompimento para baixo → PUT
18. **TRIÂNGULO SIMÉTRICO:** Topos descendo + fundos subindo → aguardar rompimento → analise a direção do rompimento
19. **CUNHA ASCENDENTE:** Topos e fundos subindo mas convergindo → possível reversão para baixo
20. **CUNHA DESCENDENTE:** Topos e fundos descendo mas convergindo → possível reversão para cima
21. **TOPO TRIPLO / FUNDO TRIPLO:** 3 toques no mesmo nível → forte zona de reversão
22. **OMBRO-CABEÇA-OMBRO (OCO):** Topo-Topo maior-Topo → reversão bearish clássica
23. **OCO INVERTIDO:** Fundo-Fundo mais baixo-Fundo → reversão bullish clássica
24. **BANDEIRA DE ALTA/BAIXA:** Impulso forte + consolidação inclinada → continuação na direção do impulso

**SUPORTE E RESISTÊNCIA:**

25. **SUPORTE:** Níveis onde o preço tocou e voltou a subir (mínimo 2 toques)
26. **RESISTÊNCIA:** Níveis onde o preço tocou e voltou a descer (mínimo 2 toques)
27. **ROMPIMENTO:** Se o preço rompe S/R com vela de corpo grande → continuação na direção do rompimento
28. **FALSO ROMPIMENTO:** Se rompe mas volta rapidamente → operação contra o rompimento

**SISTEMA DE SCORE COMPOSTO (0-100):**
Calcule um score baseado em pesos:
- Padrão de velas japonesas (peso 30%): Hammer/Engulfing/Morning Star bullish=compra, Shooting Star/Evening Star bearish=venda
- Tendência LTA/LTB (peso 25%): Acima da LTA=compra, Abaixo da LTB=venda, Rompimento=forte sinal
- Figuras gráficas (peso 25%): W/V/Triângulo asc/OCO inv=compra, M/V inv/Triângulo desc/OCO=venda
- Suporte/Resistência (peso 20%): Preço em suporte=compra, em resistência=venda, rompimento=continuação

**REGRAS DE SINAL:**
- COMPRA: Score composto ≥ 65 para BUY, com pelo menos 3 dos 4 fatores alinhados
- VENDA: Score composto ≥ 65 para SELL, com pelo menos 3 dos 4 fatores alinhados
- NEUTRO: Score < 65 OU fatores conflitantes OU padrão de indecisão (Doji)

**⚠️ FILTRO DE GAP OBRIGATÓRIO (CRÍTICO):**
Observe a ÚLTIMA VELA (a mais recente, que acabou de nascer). Compare seu OPEN com o CLOSE da vela anterior:
- **GAP UP (para fora):** Open da vela atual está ACIMA do High da vela anterior → há um espaço/pulo visível para cima entre as velas
- **GAP DOWN (para fora):** Open da vela atual está ABAIXO do Low da vela anterior → há um espaço/pulo visível para baixo entre as velas
- **GAP INTERNO:** Open da vela atual está significativamente diferente do Close da vela anterior (diferença > 50% do corpo da vela anterior), mesmo que dentro do range
- Se QUALQUER tipo de GAP for detectado na vela atual → **OBRIGATORIAMENTE retorne NEUTRO** com reason explicando "GAP detectado - operação arriscada, preço pode reverter ou continuar de forma imprevisível"
- Marque o campo "gap_detected" como true no JSON
- Gaps causam movimentos erráticos onde o preço bate em suporte/resistência de forma imprevisível e vai contra a operação

**CONTRA-TENDÊNCIA:** Se a tendência (LTA/LTB + topos/fundos) é claramente UP, NÃO dê sinal de SELL a menos que haja reversão MUITO forte (M formado + engulfing + rompimento LTA). E vice-versa.

**REGRAS DE COR:**
- Modo ${modeText}
- Se PADRÃO: Velas VERDES = BUY, Velas VERMELHAS = SELL
- Se INVERTIDO: VERDE = SELL, VERMELHO = BUY

${historyContext}

**CONFIANÇA FINAL:**
- 85-100%: Todos os 4 fatores alinhados + figura gráfica clara + tendência forte + padrão de vela confirmando
- 70-84%: 3 de 4 fatores alinhados + pelo menos 1 figura ou padrão forte
- 60-69%: 2-3 fatores → considere NEUTRO
- Abaixo de 60%: NEUTRO obrigatório

Responda APENAS com JSON válido:
{"recommendation": "BUY" ou "SELL" ou "NEUTRO", "confidence": número 0-100, "composite_score": número 0-100, "reason": "razão detalhada incluindo padrões e figuras encontradas", "trend": "tendência geral e alvo", "asset": "símbolo do ativo", "price": "preço atual", "candle_pattern": "nome do padrão de vela identificado ou NONE", "candle_sequence": "descrição curta da sequência (ex: 3 verdes seguidas, corpos crescentes)", "trend_direction": "UPTREND ou DOWNTREND ou SIDEWAYS", "trend_line": "LTA_INTACT ou LTA_BROKEN ou LTB_INTACT ou LTB_BROKEN ou NO_CLEAR_LINE", "chart_figure": "W ou M ou V ou V_INV ou TRIANGLE_ASC ou TRIANGLE_DESC ou TRIANGLE_SYM ou OCO ou OCO_INV ou FLAG ou WEDGE_UP ou WEDGE_DOWN ou DOUBLE_TOP ou DOUBLE_BOTTOM ou TRIPLE_TOP ou TRIPLE_BOTTOM ou NONE", "tops_bottoms": "HIGHER_HIGHS ou LOWER_LOWS ou SAME_LEVEL ou DIVERGING", "support_resistance": "NEAR_SUPPORT ou NEAR_RESISTANCE ou BREAKOUT_UP ou BREAKOUT_DOWN ou MIDDLE", "candle_timer": "tempo restante", "factors_aligned": número de 0-4}`;

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
        trend_line: "NO_CLEAR_LINE",
        chart_figure: "NONE",
        tops_bottoms: "SAME_LEVEL",
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
