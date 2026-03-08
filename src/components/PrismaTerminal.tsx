import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap, Shield, Play, Square, Volume2, Sparkles,
  Eye, Clock, Timer, History, Activity, Brain, TrendingUp, BarChart3, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PrismaIcon from '@/components/PrismaIcon';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisResult {
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRO';
  confidence: number;
  composite_score?: number;
  reason: string;
  trend: string;
  time: string;
  asset?: string;
  price?: string;
  candle_pattern?: string;
  candle_sequence?: string;
  trend_direction?: string;
  trend_line?: string;
  chart_figure?: string;
  tops_bottoms?: string;
  support_resistance?: string;
  factors_aligned?: number;
  result?: 'WIN' | 'LOSS' | null;
}

interface LogEntry {
  msg: string;
  type: 'info' | 'signal' | 'warn';
  time: string;
}

const figureLabel: Record<string, string> = {
  W: 'Fundo Duplo (W)',
  M: 'Topo Duplo (M)',
  V: 'Reversão V',
  V_INV: 'Reversão V Invertido',
  TRIANGLE_ASC: 'Triângulo Ascendente',
  TRIANGLE_DESC: 'Triângulo Descendente',
  TRIANGLE_SYM: 'Triângulo Simétrico',
  OCO: 'Ombro-Cabeça-Ombro',
  OCO_INV: 'OCO Invertido',
  FLAG: 'Bandeira',
  WEDGE_UP: 'Cunha Ascendente',
  WEDGE_DOWN: 'Cunha Descendente',
  DOUBLE_TOP: 'Topo Duplo',
  DOUBLE_BOTTOM: 'Fundo Duplo',
  TRIPLE_TOP: 'Topo Triplo',
  TRIPLE_BOTTOM: 'Fundo Triplo',
  NONE: '—',
};

const trendLineLabel: Record<string, string> = {
  LTA_INTACT: '↗ LTA Intacta',
  LTA_BROKEN: '⚠ LTA Rompida',
  LTB_INTACT: '↘ LTB Intacta',
  LTB_BROKEN: '⚠ LTB Rompida',
  NO_CLEAR_LINE: '— Sem linha clara',
};

const topsBottomsLabel: Record<string, string> = {
  HIGHER_HIGHS: '↑ Topos Ascendentes',
  LOWER_LOWS: '↓ Fundos Descendentes',
  SAME_LEVEL: '↔ Mesmo Nível',
  DIVERGING: '◇ Convergindo',
};

const AnalyzingOverlay: React.FC = () => {
  const steps = [
    "Lendo padrões de velas japonesas (40+ padrões)...",
    "Traçando LTA/LTB nas últimas 30 velas...",
    "Identificando figuras gráficas (W, M, V, Triângulos)...",
    "Analisando topos e fundos (HH/LL)...",
    "Verificando suporte/resistência e rompimentos...",
    "Calculando score composto de 4 fatores...",
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % steps.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm p-4 border-t border-primary/30">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Brain className="w-5 h-5 text-prisma-cyan animate-pulse" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-prisma-cyan rounded-full animate-ping" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-prisma-cyan font-mono">ANALISANDO GRÁFICO</span>
            <span className="text-[10px] text-muted-foreground animate-pulse">●●●</span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground transition-all duration-300">
            {steps[step]}
          </p>
          <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-prisma-cyan to-prisma-blue rounded-full transition-all duration-1000"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const PrismaTerminal: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isInverted, setIsInverted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAnalyzedMinute = useRef(-1);

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ msg, type, time }, ...prev].slice(0, 20));
  }, []);

  const speakSignal = useCallback((side: string) => {
    if (!('speechSynthesis' in window)) return;
    const phrase = side === 'BUY' ? "Nova vela. Sinal de Compra." : "Nova vela. Sinal de Venda.";
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.videoWidth === 0 || !ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    setIsAnalyzing(true);
    addLog("⚡ Captura aos 58s — Análise profunda iniciada...", "info");

    const winLossHistory = history
      .filter(h => h.result)
      .slice(0, 10)
      .map(h => ({
        asset: h.asset,
        recommendation: h.recommendation,
        confidence: h.confidence,
        result: h.result,
      }));

    try {
      const { data, error } = await supabase.functions.invoke('analyze-chart', {
        body: { image: base64Image, isInverted, winLossHistory }
      });

      if (error) throw error;

      const result = data as AnalysisResult;
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const analysisWithTime = { ...result, time: timeStr };
      setLastAnalysis(analysisWithTime);

      if (result.recommendation !== 'HOLD' && result.recommendation !== 'NEUTRO') {
        setHistory(prev => [analysisWithTime, ...prev].slice(0, 30));
        const fig = result.chart_figure && result.chart_figure !== 'NONE' ? ` | Fig: ${result.chart_figure}` : '';
        addLog(`🎯 SINAL: ${result.recommendation} | ${result.asset || '—'} | Score: ${result.composite_score || result.confidence}% | ${result.candle_pattern || ''}${fig} | Fatores: ${result.factors_aligned || '?'}/4`, "signal");

        if (result.confidence >= 80) {
          speakSignal(result.recommendation);
        }
      } else {
        addLog(`⏸ NEUTRO — ${result.reason || 'Fatores conflitantes'}`, "info");
      }
    } catch (err) {
      console.error("Erro na análise:", err);
      addLog("❌ Erro crítico na análise IA.", "warn");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isInverted, history, addLog, speakSignal]);

  const startCapture = async () => {
    try {
      addLog("🔄 Sincronizando relógio do sistema...", "info");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", cursor: "always" } as any
      });

      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsRunning(true);
      addLog("✅ Conectado. Análise Price Action ativa. Aguardando :58s", "info");

      stream.getVideoTracks()[0].onended = stopCapture;
    } catch {
      addLog("⛔ Acesso negado à tela.", "warn");
    }
  };

  const stopCapture = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsRunning(false);
    setLastAnalysis(null);
    lastAnalyzedMinute.current = -1;
    addLog("🔌 Prisma em modo Standby.", "info");
  }, [addLog]);

  useEffect(() => {
    clockTimer.current = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (isRunning && !isAnalyzing) {
        const seconds = now.getSeconds();
        const currentMinute = now.getMinutes();

        if (seconds === 58 && lastAnalyzedMinute.current !== currentMinute) {
          lastAnalyzedMinute.current = currentMinute;
          captureAndAnalyze();
        }
      }
    }, 500);

    return () => {
      if (clockTimer.current) clearInterval(clockTimer.current);
    };
  }, [isRunning, isAnalyzing, captureAndAnalyze]);

  const secondsToNext = 60 - currentTime.getSeconds();

  const winCount = history.filter(h => h.result === 'WIN').length;
  const lossCount = history.filter(h => h.result === 'LOSS').length;
  const winRate = winCount + lossCount > 0 ? Math.round((winCount / (winCount + lossCount)) * 100) : 0;

  return (
    <div className="min-h-screen p-3 md:p-6 font-display">
      {/* Header */}
      <header className="mb-4 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <PrismaIcon size={40} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gradient-prisma">PRISMA IA</h1>
                <span className="text-[10px] font-mono bg-primary/20 border border-primary/30 text-primary-foreground px-2 py-0.5 rounded-full">
                  PRICE ACTION
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 font-mono text-xs">
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg border border-border">
                <Clock className="w-3 h-3 text-prisma-cyan" />
                <span className="text-muted-foreground">Clock</span>
                <span className="text-foreground font-semibold">
                  {currentTime.toLocaleTimeString('pt-BR', { hour12: false })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg border border-border">
                <Timer className="w-3 h-3 text-prisma-orange" />
                <span className="text-muted-foreground">Next</span>
                <span className="text-foreground font-semibold">{secondsToNext}s</span>
              </div>
            </div>

            <button
              onClick={() => setIsInverted(!isInverted)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all font-mono ${
                isInverted
                  ? 'bg-prisma-orange/10 border-prisma-orange/30 text-prisma-orange'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              MODO: {isInverted ? 'INVERTIDO' : 'PADRÃO'}
            </button>

            <Button
              variant={isRunning ? 'sell' : 'prisma'}
              size="sm"
              onClick={isRunning ? stopCapture : startCapture}
              className="font-mono text-xs"
            >
              {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRunning ? 'DESCONECTAR' : 'CONECTAR M1'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Stream */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-xl border border-border bg-card/60 overflow-hidden aspect-video">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            <canvas ref={canvasRef} className="hidden" />

            {!isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
                  <Eye className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-foreground font-semibold mb-1">AGUARDANDO GRÁFICO 1M</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Conecte a janela do seu gráfico M1. Análise por Price Action puro — sem indicadores necessários.
                </p>
              </div>
            )}

            {isAnalyzing && <AnalyzingOverlay />}

            {isSpeaking && (
              <div className="absolute top-3 right-3">
                <Volume2 className="w-5 h-5 text-prisma-cyan animate-pulse" />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Status', value: isRunning ? 'Ativo' : 'Offline', icon: Timer, color: 'text-prisma-blue' },
              { label: 'Modo Cor', value: isInverted ? 'Invertido' : 'Normal', icon: Eye, color: 'text-primary' },
              { label: 'Engine', value: 'V6 PA', icon: Brain, color: 'text-prisma-cyan' },
              { label: 'Win Rate', value: winCount + lossCount > 0 ? `${winRate}%` : '—', icon: Target, color: winRate >= 70 ? 'text-prisma-green' : winRate >= 50 ? 'text-prisma-orange' : 'text-prisma-red' },
              { label: 'W/L', value: `${winCount}/${lossCount}`, icon: BarChart3, color: 'text-prisma-cyan' },
            ].map((stat, i) => (
              <div key={i} className="bg-card/60 border border-border rounded-lg p-3 flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  <p className="text-xs font-semibold text-foreground">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Signals */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Signal */}
          <div className="bg-card/60 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="w-3 h-3" />
                <span>Análise Price Action</span>
              </div>
              {lastAnalysis && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {lastAnalysis.time}
                </span>
              )}
            </div>

            {lastAnalysis ? (
              <div>
                {/* Asset & Price */}
                {(lastAnalysis.asset || lastAnalysis.price) && (
                  <div className="flex items-center gap-3 mb-3">
                    {lastAnalysis.asset && (
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded-lg border border-border text-foreground font-semibold">
                        {lastAnalysis.asset}
                      </span>
                    )}
                    {lastAnalysis.price && (
                      <span className="text-xs font-mono text-prisma-cyan">
                        {lastAnalysis.price}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`text-3xl font-bold font-mono ${
                      lastAnalysis.recommendation === 'BUY' ? 'text-prisma-green' : lastAnalysis.recommendation === 'SELL' ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}
                  >
                    {lastAnalysis.recommendation}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      lastAnalysis.confidence >= 80
                        ? 'bg-prisma-green/10 border-prisma-green/30 text-prisma-green'
                        : lastAnalysis.confidence >= 65
                        ? 'bg-prisma-orange/10 border-prisma-orange/30 text-prisma-orange'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      {lastAnalysis.confidence}% CONFIANÇA
                    </span>
                    {lastAnalysis.factors_aligned !== undefined && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {lastAnalysis.factors_aligned}/4 fatores alinhados
                      </span>
                    )}
                  </div>
                </div>

                {/* Composite Score Bar */}
                {lastAnalysis.composite_score !== undefined && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-muted-foreground">Score Composto</span>
                      <span className={`font-bold ${
                        lastAnalysis.composite_score >= 80 ? 'text-prisma-green' :
                        lastAnalysis.composite_score >= 65 ? 'text-prisma-orange' : 'text-muted-foreground'
                      }`}>{lastAnalysis.composite_score}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          lastAnalysis.recommendation === 'BUY' ? 'bg-prisma-green' :
                          lastAnalysis.recommendation === 'SELL' ? 'bg-prisma-red' : 'bg-muted-foreground'
                        }`}
                        style={{ width: `${lastAnalysis.composite_score}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Candle Pattern & Chart Figure */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Padrão de Vela</p>
                    <p className="text-xs font-bold font-mono text-foreground">
                      {lastAnalysis.candle_pattern && lastAnalysis.candle_pattern !== 'NONE' ? lastAnalysis.candle_pattern : '—'}
                    </p>
                    {lastAnalysis.candle_sequence && (
                      <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{lastAnalysis.candle_sequence}</p>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Figura Gráfica</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.chart_figure && lastAnalysis.chart_figure !== 'NONE' ? 'text-prisma-cyan' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.chart_figure ? (figureLabel[lastAnalysis.chart_figure] || lastAnalysis.chart_figure) : '—'}
                    </p>
                  </div>
                </div>

                {/* Trend Line & Tops/Bottoms */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Linha de Tendência</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.trend_line?.includes('LTA') ? 'text-prisma-green' :
                      lastAnalysis.trend_line?.includes('LTB') ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.trend_line ? (trendLineLabel[lastAnalysis.trend_line] || lastAnalysis.trend_line) : '—'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Topos & Fundos</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.tops_bottoms === 'HIGHER_HIGHS' ? 'text-prisma-green' :
                      lastAnalysis.tops_bottoms === 'LOWER_LOWS' ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.tops_bottoms ? (topsBottomsLabel[lastAnalysis.tops_bottoms] || lastAnalysis.tops_bottoms) : '—'}
                    </p>
                  </div>
                </div>

                {/* Trend & S/R */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Tendência Geral</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.trend_direction === 'UPTREND' ? 'text-prisma-green' :
                      lastAnalysis.trend_direction === 'DOWNTREND' ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.trend_direction === 'UPTREND' ? '↑ ALTA' :
                       lastAnalysis.trend_direction === 'DOWNTREND' ? '↓ BAIXA' : '↔ LATERAL'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Suporte/Resistência</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.support_resistance === 'NEAR_SUPPORT' || lastAnalysis.support_resistance === 'BREAKOUT_UP' ? 'text-prisma-green' :
                      lastAnalysis.support_resistance === 'NEAR_RESISTANCE' || lastAnalysis.support_resistance === 'BREAKOUT_DOWN' ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.support_resistance === 'NEAR_SUPPORT' ? 'Perto do Suporte' :
                       lastAnalysis.support_resistance === 'NEAR_RESISTANCE' ? 'Perto da Resistência' :
                       lastAnalysis.support_resistance === 'BREAKOUT_UP' ? '🔼 Rompimento Alta' :
                       lastAnalysis.support_resistance === 'BREAKOUT_DOWN' ? '🔽 Rompimento Baixa' : 'Meio do Range'}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-2 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Razão</p>
                  <p className="text-xs text-foreground">{lastAnalysis.reason}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                {isRunning ? (
                  <>
                    <Timer className="w-6 h-6 mb-2 animate-pulse-slow" />
                    <p className="text-xs">Aguardando :58s para análise...</p>
                  </>
                ) : (
                  <>
                    <PrismaIcon size={32} />
                    <p className="text-xs mt-2">Sistema Desconectado</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-card/60 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="w-3 h-3" />
                <span>Histórico</span>
              </div>
              {winCount + lossCount > 0 && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  winRate >= 70 ? 'bg-prisma-green/10 border-prisma-green/30 text-prisma-green' :
                  winRate >= 50 ? 'bg-prisma-orange/10 border-prisma-orange/30 text-prisma-orange' :
                  'bg-prisma-red/10 border-prisma-red/30 text-prisma-red'
                }`}>
                  WR: {winRate}%
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum sinal gerado</p>
              )}
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
                        h.recommendation === 'BUY'
                          ? 'bg-prisma-green/20 text-prisma-green'
                          : 'bg-prisma-red/20 text-prisma-red'
                      }`}
                    >
                      {h.recommendation === 'BUY' ? '↑' : '↓'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {h.asset || '—'} <span className={h.recommendation === 'BUY' ? 'text-prisma-green' : 'text-prisma-red'}>{h.recommendation}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {h.time} · {h.composite_score || h.confidence}% · {h.chart_figure && h.chart_figure !== 'NONE' ? h.chart_figure + ' · ' : ''}{h.candle_pattern && h.candle_pattern !== 'NONE' ? h.candle_pattern : ''} {h.factors_aligned !== undefined ? `${h.factors_aligned}/4` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setHistory(prev => prev.map((item, idx) => idx === i ? { ...item, result: 'WIN' } : item));
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition-all font-mono ${
                        h.result === 'WIN'
                          ? 'bg-prisma-green/20 border-prisma-green/50 text-prisma-green'
                          : 'bg-muted border-border text-muted-foreground hover:border-prisma-green/30'
                      }`}
                    >
                      WIN
                    </button>
                    <button
                      onClick={() => {
                        setHistory(prev => prev.map((item, idx) => idx === i ? { ...item, result: 'LOSS' } : item));
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition-all font-mono ${
                        h.result === 'LOSS'
                          ? 'bg-prisma-red/20 border-prisma-red/50 text-prisma-red'
                          : 'bg-muted border-border text-muted-foreground hover:border-prisma-red/30'
                      }`}
                    >
                      LOSS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-card/60 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Sparkles className="w-3 h-3" />
              <span>Event Log</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[10px]">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                  <span
                    className={
                      log.type === 'signal'
                        ? 'text-prisma-green'
                        : log.type === 'warn'
                        ? 'text-prisma-red'
                        : 'text-muted-foreground'
                    }
                  >
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrismaTerminal;
