import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap, Shield, Play, Square, Volume2, Sparkles,
  Eye, Clock, Timer, History, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PrismaIcon from '@/components/PrismaIcon';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisResult {
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRO';
  confidence: number;
  reason: string;
  trend: string;
  time: string;
  asset?: string;
  price?: string;
  williams_direction?: string;
  momentum_direction?: string;
}

interface LogEntry {
  msg: string;
  type: 'info' | 'signal' | 'warn';
  time: string;
}

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
    addLog("Vela de 1M Detectada. Analisando nascimento...", "info");

    try {
      const { data, error } = await supabase.functions.invoke('analyze-chart', {
        body: { image: base64Image, isInverted }
      });

      if (error) throw error;

      const result = data as AnalysisResult;
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const analysisWithTime = { ...result, time: timeStr };
      setLastAnalysis(analysisWithTime);

      if (result.recommendation !== 'HOLD' && result.recommendation !== 'NEUTRO') {
        setHistory(prev => [analysisWithTime, ...prev].slice(0, 30));
        addLog(`SINAL GERADO: ${result.recommendation} às ${timeStr}`, "signal");

        if (result.confidence >= 80) {
          speakSignal(result.recommendation);
        }
      } else {
        addLog("NEUTRO — Zig Zag e Price Action conflitantes.", "info");
      }
    } catch (err) {
      console.error("Erro na análise:", err);
      addLog("Erro crítico na análise IA.", "warn");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isInverted, addLog, speakSignal]);

  const startCapture = async () => {
    try {
      addLog("Sincronizando relógio do sistema...", "info");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", cursor: "always" } as any
      });

      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsRunning(true);
      addLog("Sistema Sincronizado. Aguardando :00s", "info");

      stream.getVideoTracks()[0].onended = stopCapture;
    } catch {
      addLog("Acesso negado à tela.", "warn");
    }
  };

  const stopCapture = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsRunning(false);
    setLastAnalysis(null);
    lastAnalyzedMinute.current = -1;
    addLog("Prisma em modo Standby.", "info");
  }, [addLog]);

  useEffect(() => {
    clockTimer.current = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (isRunning && !isAnalyzing) {
        const seconds = now.getSeconds();
        const currentMinute = now.getMinutes();

        if (seconds === 0 && lastAnalyzedMinute.current !== currentMinute) {
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

  return (
    <div className="min-h-screen p-3 md:p-6 font-display">
      {/* Header */}
      <header className="mb-4 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <PrismaIcon size={40} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gradient-prisma">PRISMA ORACLE 2.0</h1>
                <span className="text-[10px] font-mono bg-primary/20 border border-primary/30 text-primary-foreground px-2 py-0.5 rounded-full">
                  M1 Sinc
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Sincronizado com nascimento de velas</p>
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
                  Conecte a janela do seu gráfico para que o robô detecte o nascimento das velas.
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur-sm p-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs font-mono text-prisma-cyan">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  Processando Nascimento da Vela...
                </div>
              </div>
            )}

            {isSpeaking && (
              <div className="absolute top-3 right-3">
                <Volume2 className="w-5 h-5 text-prisma-cyan animate-pulse" />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Sincronização', value: isRunning ? 'Sinc.' : 'Offline', icon: Timer, color: 'text-prisma-blue' },
              { label: 'Análise de Cor', value: isInverted ? 'Custom' : 'Normal', icon: Eye, color: 'text-primary' },
              { label: 'Resposta', value: '~2s', icon: Zap, color: 'text-prisma-orange' },
              { label: 'Engine', value: 'V4.4 PRO', icon: Shield, color: 'text-prisma-green' },
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
                <span>Último Nascimento</span>
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
                  <span className={`text-xs font-mono px-2 py-1 rounded-lg border ${
                    lastAnalysis.confidence >= 80
                      ? 'bg-prisma-green/10 border-prisma-green/30 text-prisma-green'
                      : 'bg-prisma-orange/10 border-prisma-orange/30 text-prisma-orange'
                  }`}>
                    {lastAnalysis.confidence}% CONFIANÇA
                  </span>
                </div>

                {/* Indicators */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Williams %R (7)</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.williams_direction === 'UP' ? 'text-prisma-green' : lastAnalysis.williams_direction === 'DOWN' ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.williams_direction === 'UP' ? '↑ SUBINDO' : lastAnalysis.williams_direction === 'DOWN' ? '↓ DESCENDO' : '— INDEFINIDO'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Momentum (5)</p>
                    <p className={`text-xs font-bold font-mono ${
                      lastAnalysis.momentum_direction === 'UP' ? 'text-prisma-green' : lastAnalysis.momentum_direction === 'DOWN' ? 'text-prisma-red' : 'text-muted-foreground'
                    }`}>
                      {lastAnalysis.momentum_direction === 'UP' ? '↑ SUBINDO' : lastAnalysis.momentum_direction === 'DOWN' ? '↓ DESCENDO' : '— INDEFINIDO'}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-2 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Tendência</p>
                  <p className="text-xs text-foreground">{lastAnalysis.trend}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                {isRunning ? (
                  <>
                    <Timer className="w-6 h-6 mb-2 animate-pulse-slow" />
                    <p className="text-xs">Aguardando Virada do Minuto...</p>
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
                <span>Registro M1</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Automático
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma vela capturada</p>
              )}
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border border-border"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold font-mono ${
                        h.recommendation === 'BUY'
                          ? 'bg-prisma-green/20 text-prisma-green'
                          : 'bg-prisma-red/20 text-prisma-red'
                      }`}
                    >
                      {h.recommendation === 'BUY' ? 'B' : 'S'}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{h.recommendation}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{h.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{h.confidence}%</p>
                    <p className="text-[10px] text-muted-foreground">Prob.</p>
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
                    {log.type === 'signal' && '● '}{log.msg}
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
