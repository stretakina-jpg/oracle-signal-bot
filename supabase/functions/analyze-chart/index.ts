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

**LEITURA OBRIGATÓRIA DA TELA:**
1. IDENTIFIQUE O ATIVO: Leia o nome/símbolo do ativo que aparece no gráfico (ex: EUR/USD, BTC/USD, USD/JPY, etc.)
2. IDENTIFIQUE O PREÇO ATUAL: Leia o preço real do ativo exibido no gráfico
3. LEIA O INDICADOR WILLIAMS %R (Período 7): É uma linha TURQUESA/CIANO no painel inferior do gráfico. Identifique se a linha está APONTANDO PARA CIMA ou PARA BAIXO nas últimas barras
4. LEIA O INDICADOR MOMENTUM (Período 5): É outra linha TURQUESA/AZUL TURQUESA em outro painel do gráfico. Identifique se a linha está APONTANDO PARA CIMA ou PARA BAIXO nas últimas barras

**REGRA DOS INDICADORES (PRIORIDADE MÁXIMA):**
- Para COMPRA (BUY): Williams %R E Momentum DEVEM estar AMBOS apontando para CIMA
- Para VENDA (SELL): Williams %R E Momentum DEVEM estar AMBOS apontando para BAIXO
- Se os dois indicadores apontam para DIREÇÕES DIFERENTES → "NEUTRO" (conflito de indicadores)
- Esta regra tem PRIORIDADE sobre todas as outras

**ESTRATÉGIA DIAMANTE (CONFIRMAÇÃO):**
O Padrão Diamante é uma formação gráfica de REVERSÃO:
1. FASE DE EXPANSÃO: Topos mais altos e fundos mais baixos (alargamento)
2. FASE DE CONTRAÇÃO: Topos mais baixos e fundos mais altos (estreitamento)
3. DIAMANTE DE TOPO (após alta) → SELL | DIAMANTE DE FUNDO (após baixa) → BUY
4. O rompimento da borda confirma a direção

**ANÁLISE ZIG ZAG (CONFIRMA):**
1. Zig Zag ACIMA do preço (topo formado): velas tendem a DESCER → reforça SELL
2. Zig Zag ABAIXO do preço (fundo formado): velas tendem a SUBIR → reforça BUY
3. Identifique o ALVO: buscando SUPORTE (baixa) ou RESISTÊNCIA (alta)

**FLUXO DE VELAS E VELA RAIZ:**
1. Identifique a VELA RAIZ — a vela que originou o movimento atual
2. Analise padrões: Martelo, Engolfo, Doji, Pin Bar, Estrela Cadente
3. Avalie: CONTINUIDADE ou REVERSÃO?

**REGRAS FINAIS DE DECISÃO:**
- Modo ${modeText}
- Se PADRÃO: Velas VERDES = BUY, Velas VERMELHAS = SELL
- Se INVERTIDO: VERDE = SELL, VERMELHO = BUY
- O sinal SÓ é gerado se: Williams %R + Momentum concordam na direção + Diamante/ZigZag confirmam
- Se NÃO tiver certeza ou indicadores conflitantes → "NEUTRO"
- Confiança acima de 80 APENAS quando TODOS os fatores concordam (indicadores + diamante + zigzag + velas)

Responda APENAS com JSON válido no formato:
{"recommendation": "BUY" ou "SELL" ou "NEUTRO", "confidence": número 0-100, "reason": "razão curta com indicadores + diamante", "trend": "direção Williams/Momentum, alvo do preço (suporte/resistência)", "asset": "símbolo do ativo lido na tela", "price": "preço atual lido na tela", "williams_direction": "UP ou DOWN ou UNCLEAR", "momentum_direction": "UP ou DOWN ou UNCLEAR"}`;

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
