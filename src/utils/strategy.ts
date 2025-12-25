/**
 * Estratégias Otimizadas para Previsão de Ticks
 * 
 * Estas estratégias focam em:
 * 1. Mean Reversion - Movimentos extremos tendem a corrigir
 * 2. Momentum Confirmado - Só opera quando há confirmação forte
 * 3. Hurst - Usa o expoente de Hurst para determinar persistência
 */

export interface EstrategiaResult {
  sinal: "CALL" | "PUT" | "HOLD";
  confianca: number; // 0 a 1
  razao: string;
}

// ============================================
// ESTRATÉGIA 1: MEAN REVERSION (Reversão à Média)
// ============================================

export interface MeanReversionResult extends EstrategiaResult {
  zScore: number;
  media: number;
  desvioPadrao: number;
  velocidade: number;
}

export function estrategiaMeanReversion(ticks: number[]): MeanReversionResult {
  const defaultResult: MeanReversionResult = {
    sinal: "HOLD",
    confianca: 0,
    razao: "Dados insuficientes",
    zScore: 0,
    media: 0,
    desvioPadrao: 0,
    velocidade: 0,
  };

  if (ticks.length < 20) return defaultResult;

  const ultimos20 = ticks.slice(-20);
  const ultimos10 = ticks.slice(-10);
  const atual = ticks[ticks.length - 1];

  // Calcular média dos últimos 20 ticks
  const media = ultimos20.reduce((a, b) => a + b, 0) / 20;

  // Calcular desvio padrão
  const desvioPadrao = Math.sqrt(
    ultimos20.reduce((acc, t) => acc + Math.pow(t - media, 2), 0) / 20
  );

  // Evitar divisão por zero
  if (desvioPadrao === 0) {
    return { ...defaultResult, razao: "Volatilidade zero", media, desvioPadrao };
  }

  // Z-score: quantos desvios o preço atual está da média
  const zScore = (atual - media) / desvioPadrao;

  // Calcular velocidade do movimento recente (últimos 5 ticks)
  const ultimos5 = ultimos10.slice(-5);
  const velocidade = ultimos5.reduce((acc, t, i, arr) => {
    if (i === 0) return 0;
    return acc + (t - arr[i - 1]);
  }, 0);

  // Calcular aceleração (mudança na velocidade)
  const velocidadeAnterior = ultimos10.slice(0, 5).reduce((acc, t, i, arr) => {
    if (i === 0) return 0;
    return acc + (t - arr[i - 1]);
  }, 0);
  const aceleracao = velocidade - velocidadeAnterior;

  // Regras de Mean Reversion
  // Se o preço está muito acima da média E o movimento foi rápido para cima
  if (zScore > 1.5 && velocidade > 0) {
    // Se está desacelerando, ainda mais provável a reversão
    const boost = aceleracao < 0 ? 0.1 : 0;
    const confianca = Math.min((Math.abs(zScore) - 1) / 2 + boost, 0.85);
    return {
      sinal: "PUT",
      confianca,
      razao: `Preço ${zScore.toFixed(2)} desvios acima da média, provável correção`,
      zScore,
      media,
      desvioPadrao,
      velocidade,
    };
  }

  // Se o preço está muito abaixo da média E o movimento foi rápido para baixo
  if (zScore < -1.5 && velocidade < 0) {
    const boost = aceleracao > 0 ? 0.1 : 0;
    const confianca = Math.min((Math.abs(zScore) - 1) / 2 + boost, 0.85);
    return {
      sinal: "CALL",
      confianca,
      razao: `Preço ${Math.abs(zScore).toFixed(2)} desvios abaixo da média, provável correção`,
      zScore,
      media,
      desvioPadrao,
      velocidade,
    };
  }

  // Zona neutra
  return {
    sinal: "HOLD",
    confianca: 0,
    razao: `Z-Score (${zScore.toFixed(2)}) dentro da faixa normal`,
    zScore,
    media,
    desvioPadrao,
    velocidade,
  };
}

// ============================================
// ESTRATÉGIA 2: MOMENTUM CONFIRMADO
// ============================================

export interface MomentumConfirmadoResult extends EstrategiaResult {
  consecutivas: number;
  direcao: "ALTA" | "BAIXA" | "LATERAL";
  variacaoTotal: number;
  variacaoMedia: number;
  forcaMovimento: number;
}

export function estrategiaMomentumConfirmado(ticks: number[]): MomentumConfirmadoResult {
  const defaultResult: MomentumConfirmadoResult = {
    sinal: "HOLD",
    confianca: 0,
    razao: "Dados insuficientes",
    consecutivas: 0,
    direcao: "LATERAL",
    variacaoTotal: 0,
    variacaoMedia: 0,
    forcaMovimento: 0,
  };

  if (ticks.length < 15) return defaultResult;

  const ultimos5 = ticks.slice(-5);
  const ultimos15 = ticks.slice(-15);

  // Contar direções consecutivas (do mais recente para trás)
  let consecutivasAlta = 0;
  let consecutivasBaixa = 0;

  for (let i = ultimos5.length - 1; i > 0; i--) {
    const diff = ultimos5[i] - ultimos5[i - 1];
    if (diff > 0) {
      if (consecutivasBaixa > 0) break;
      consecutivasAlta++;
    } else if (diff < 0) {
      if (consecutivasAlta > 0) break;
      consecutivasBaixa++;
    } else {
      break; // empate, para a contagem
    }
  }

  const consecutivas = Math.max(consecutivasAlta, consecutivasBaixa);
  const direcao: "ALTA" | "BAIXA" | "LATERAL" = 
    consecutivasAlta > consecutivasBaixa ? "ALTA" :
    consecutivasBaixa > consecutivasAlta ? "BAIXA" : "LATERAL";

  // Calcular força do movimento
  const variacaoTotal = ultimos5[ultimos5.length - 1] - ultimos5[0];
  
  // Variação média dos últimos 15 ticks (para comparação)
  const variacaoMedia = ultimos15.reduce((acc, t, i, arr) => {
    if (i === 0) return 0;
    return acc + Math.abs(t - arr[i - 1]);
  }, 0) / 14;

  const forcaMovimento = variacaoMedia > 0 ? Math.abs(variacaoTotal) / (variacaoMedia * 5) : 0;

  // REGRA PRINCIPAL: 3+ ticks consecutivos na mesma direção = provável correção
  // Mas só se o movimento foi significativo (força > 1.5)
  if (consecutivas >= 3 && forcaMovimento > 1.5) {
    if (direcao === "ALTA") {
      return {
        sinal: "PUT",
        confianca: Math.min(0.5 + (consecutivas - 3) * 0.1 + (forcaMovimento - 1.5) * 0.1, 0.8),
        razao: `${consecutivas} ticks consecutivos de alta com força ${forcaMovimento.toFixed(2)}x`,
        consecutivas,
        direcao,
        variacaoTotal,
        variacaoMedia,
        forcaMovimento,
      };
    } else if (direcao === "BAIXA") {
      return {
        sinal: "CALL",
        confianca: Math.min(0.5 + (consecutivas - 3) * 0.1 + (forcaMovimento - 1.5) * 0.1, 0.8),
        razao: `${consecutivas} ticks consecutivos de baixa com força ${forcaMovimento.toFixed(2)}x`,
        consecutivas,
        direcao,
        variacaoTotal,
        variacaoMedia,
        forcaMovimento,
      };
    }
  }

  // REGRA ALTERNATIVA: Movimento muito forte (4+ consecutivas) mesmo sem força extrema
  if (consecutivas >= 4) {
    if (direcao === "ALTA") {
      return {
        sinal: "PUT",
        confianca: Math.min(0.45 + (consecutivas - 4) * 0.1, 0.7),
        razao: `Sequência longa de ${consecutivas} altas, esgotamento provável`,
        consecutivas,
        direcao,
        variacaoTotal,
        variacaoMedia,
        forcaMovimento,
      };
    } else if (direcao === "BAIXA") {
      return {
        sinal: "CALL",
        confianca: Math.min(0.45 + (consecutivas - 4) * 0.1, 0.7),
        razao: `Sequência longa de ${consecutivas} baixas, esgotamento provável`,
        consecutivas,
        direcao,
        variacaoTotal,
        variacaoMedia,
        forcaMovimento,
      };
    }
  }

  return {
    sinal: "HOLD",
    confianca: 0,
    razao: consecutivas > 0 
      ? `Apenas ${consecutivas} ticks consecutivos, aguardar confirmação`
      : "Sem padrão de momentum claro",
    consecutivas,
    direcao,
    variacaoTotal,
    variacaoMedia,
    forcaMovimento,
  };
}

// ============================================
// ESTRATÉGIA 3: BASEADA EM HURST
// ============================================

export interface HurstEstrategiaResult extends EstrategiaResult {
  expoente: number;
  persistencia: "ALTA" | "MEDIA" | "BAIXA";
  previsibilidade: number;
  comportamento: "PERSISTENTE" | "ANTIPERSISTENTE" | "ALEATORIO";
  direcaoAtual: "ALTA" | "BAIXA" | "LATERAL";
  r2: number; // Qualidade do ajuste (0 a 1)
}

export function estrategiaHurst(ticks: number[]): HurstEstrategiaResult {
  const defaultResult: HurstEstrategiaResult = {
    sinal: "HOLD",
    confianca: 0,
    razao: "Dados insuficientes",
    expoente: 0.5,
    persistencia: "MEDIA",
    previsibilidade: 0,
    comportamento: "ALEATORIO",
    direcaoAtual: "LATERAL",
    r2: 0,
  };

  // Precisa de pelo menos 50 ticks para cálculo significativo
  if (ticks.length < 50) return defaultResult;

  // Calcular retornos logarítmicos (mais estável que diferenças simples)
  const diffs: number[] = [];
  for (let i = 1; i < ticks.length; i++) {
    const logReturn = Math.log(ticks[i] / ticks[i - 1]);
    diffs.push(logReturn);
  }

  // Verificar se há variação nos dados
  const variance = diffs.reduce((acc, d) => acc + d * d, 0) / diffs.length;
  if (variance < 1e-12) {
    return { ...defaultResult, razao: "Sem variação significativa nos dados" };
  }

  const ranges: number[] = [];
  const scales: number[] = [];

  // Calcular R/S para múltiplas escalas (mais escalas = melhor precisão)
  // Com 100 ticks, podemos usar escalas: 8, 12, 16, 20, 25, 32
  const minScale = 8;
  const maxScale = Math.floor(diffs.length / 3);
  
  for (let scale = minScale; scale <= maxScale; scale = Math.floor(scale * 1.4)) {
    const rsValues: number[] = [];

    // Calcular R/S para múltiplas janelas do mesmo tamanho
    const numWindows = Math.floor(diffs.length / scale);
    
    for (let w = 0; w < numWindows; w++) {
      const start = w * scale;
      const window = diffs.slice(start, start + scale);

      if (window.length < scale) continue;

      const mean = window.reduce((a, b) => a + b, 0) / scale;
      const deviations = window.map(x => x - mean);

      // Desvios cumulativos
      const cumDevs: number[] = [];
      let cumSum = 0;
      for (const dev of deviations) {
        cumSum += dev;
        cumDevs.push(cumSum);
      }

      const R = Math.max(...cumDevs) - Math.min(...cumDevs);
      const S = Math.sqrt(deviations.reduce((acc, val) => acc + val * val, 0) / scale);

      if (S > 0 && isFinite(R / S)) {
        rsValues.push(R / S);
      }
    }

    if (rsValues.length > 0) {
      // Usar média dos R/S (mais robusto que max)
      const avgRS = rsValues.reduce((a, b) => a + b, 0) / rsValues.length;
      if (avgRS > 0 && isFinite(avgRS)) {
        ranges.push(Math.log(avgRS));
        scales.push(Math.log(scale));
      }
    }
  }

  // Calcular expoente por regressão linear (precisa de pelo menos 3 pontos)
  let expoente = 0.5;
  let r2 = 0; // Qualidade do ajuste
  
  if (ranges.length >= 3) {
    const n = ranges.length;
    const sumX = scales.reduce((a, b) => a + b, 0);
    const sumY = ranges.reduce((a, b) => a + b, 0);
    const sumXY = scales.reduce((acc, x, i) => acc + x * ranges[i], 0);
    const sumX2 = scales.reduce((acc, x) => acc + x * x, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) > 1e-10) {
      const slope = (n * sumXY - sumX * sumY) / denominator;
      expoente = Math.max(0.1, Math.min(0.9, isFinite(slope) ? slope : 0.5));
      
      // Calcular R² para saber a qualidade do ajuste
      const intercept = (sumY - slope * sumX) / n;
      const yMean = sumY / n;
      const ssTotal = ranges.reduce((acc, y) => acc + (y - yMean) ** 2, 0);
      const ssRes = ranges.reduce((acc, y, i) => {
        const yPred = intercept + slope * scales[i];
        return acc + (y - yPred) ** 2;
      }, 0);
      r2 = ssTotal > 0 ? 1 - ssRes / ssTotal : 0;
    }
  }

  // Determinar características
  const persistencia: "ALTA" | "MEDIA" | "BAIXA" = 
    expoente > 0.6 ? "ALTA" : expoente > 0.4 ? "MEDIA" : "BAIXA";
  
  // Previsibilidade considera tanto o desvio de 0.5 quanto a qualidade do ajuste (R²)
  const desvioHurst = Math.abs(expoente - 0.5) * 2;
  const previsibilidade = desvioHurst * Math.max(r2, 0.3); // R² pondera a confiança
  
  const comportamento: "PERSISTENTE" | "ANTIPERSISTENTE" | "ALEATORIO" =
    expoente > 0.58 ? "PERSISTENTE" : expoente < 0.42 ? "ANTIPERSISTENTE" : "ALEATORIO";

  // Determinar direção atual (últimos 5 ticks para mais robustez)
  const ultimos5 = ticks.slice(-5);
  const variacaoRecente = ultimos5[ultimos5.length - 1] - ultimos5[0];
  const direcaoAtual: "ALTA" | "BAIXA" | "LATERAL" = 
    variacaoRecente > 0 ? "ALTA" : variacaoRecente < 0 ? "BAIXA" : "LATERAL";

  // Só gera sinal se:
  // 1. Hurst está significativamente fora de 0.5
  // 2. O ajuste (R²) é razoável (> 0.5)
  // 3. Há uma direção clara

  // H > 0.58 com bom R²: Série persistente (tendência tende a continuar)
  if (expoente > 0.58 && r2 > 0.5 && direcaoAtual !== "LATERAL") {
    const confianca = Math.min(desvioHurst * r2 * 1.5, 0.7);
    if (direcaoAtual === "ALTA") {
      return {
        sinal: "CALL",
        confianca,
        razao: `H=${expoente.toFixed(3)} (R²=${(r2*100).toFixed(0)}%) persistente, alta continua`,
        expoente,
        persistencia,
        previsibilidade,
        comportamento,
        direcaoAtual,
        r2,
      };
    } else {
      return {
        sinal: "PUT",
        confianca,
        razao: `H=${expoente.toFixed(3)} (R²=${(r2*100).toFixed(0)}%) persistente, baixa continua`,
        expoente,
        persistencia,
        previsibilidade,
        comportamento,
        direcaoAtual,
        r2,
      };
    }
  }

  // H < 0.42 com bom R²: Série antipersistente (tendência tende a reverter)
  if (expoente < 0.42 && r2 > 0.5 && direcaoAtual !== "LATERAL") {
    const confianca = Math.min(desvioHurst * r2 * 1.5, 0.7);
    if (direcaoAtual === "ALTA") {
      return {
        sinal: "PUT",
        confianca,
        razao: `H=${expoente.toFixed(3)} (R²=${(r2*100).toFixed(0)}%) antipersistente, alta deve reverter`,
        expoente,
        persistencia,
        previsibilidade,
        comportamento,
        direcaoAtual,
        r2,
      };
    } else {
      return {
        sinal: "CALL",
        confianca,
        razao: `H=${expoente.toFixed(3)} (R²=${(r2*100).toFixed(0)}%) antipersistente, baixa deve reverter`,
        expoente,
        persistencia,
        previsibilidade,
        comportamento,
        direcaoAtual,
        r2,
      };
    }
  }

  // Sem sinal claro - comportamento aleatório
  const razaoNeutra = r2 < 0.5 
    ? `H=${expoente.toFixed(3)} mas R²=${(r2*100).toFixed(0)}% baixo (ajuste ruim)`
    : `H=${expoente.toFixed(3)} próximo de 0.5 (aleatório)`;

  return {
    sinal: "HOLD",
    confianca: 0,
    razao: razaoNeutra,
    expoente,
    persistencia,
    previsibilidade,
    comportamento,
    direcaoAtual,
    r2,
  };
}

// ============================================
// ESTRATÉGIA 4: MOMENTUM PERSISTENTE (Baseada no Hurst)
// ============================================

export interface MomentumPersistenteResult extends EstrategiaResult {
  hurst: number;
  r2: number;
  direcaoCurta: "ALTA" | "BAIXA" | "LATERAL";   // últimos 3 ticks
  direcaoMedia: "ALTA" | "BAIXA" | "LATERAL";   // últimos 7 ticks
  direcaoLonga: "ALTA" | "BAIXA" | "LATERAL";   // últimos 15 ticks
  alinhamento: number;  // 0 a 1 - quão alinhadas estão as direções
  forca: number;        // força do movimento recente
  isPersistente: boolean;
  // Novos campos para detecção de mercado lateral
  eficiencia: number;   // 0 a 1 - eficiência do movimento (1 = tendência perfeita)
  adx: number;          // 0 a 100 - força da tendência (ADX simplificado)
  isLateral: boolean;   // true se mercado está lateral
}

/**
 * Estratégia de Momentum Persistente
 * 
 * Baseada no fato de que o Hurst > 0.58 indica persistência:
 * - Movimentos tendem a CONTINUAR na mesma direção
 * - Seguimos a tendência em vez de reverter
 * - Só opera quando há alinhamento de múltiplos timeframes
 * - EVITA operar em mercado lateral (baixa eficiência/ADX)
 */
export function momentumPersistentStrategy(
  ticks: number[],
  hurstHistorico?: number  // Hurst pré-calculado de dados maiores
): MomentumPersistenteResult {
  const defaultResult: MomentumPersistenteResult = {
    sinal: "HOLD",
    confianca: 0,
    razao: "Dados insuficientes",
    hurst: 0.5,
    r2: 0,
    direcaoCurta: "LATERAL",
    direcaoMedia: "LATERAL",
    direcaoLonga: "LATERAL",
    alinhamento: 0,
    forca: 0,
    isPersistente: false,
    eficiencia: 0,
    adx: 0,
    isLateral: true,
  };

  if (ticks.length < 20) return defaultResult;

  // Calcular Hurst local (ou usar o histórico se fornecido)
  let hurst = hurstHistorico ?? 0.5;
  let r2 = 0.8; // Se usar histórico, assumimos bom R²
  
  if (!hurstHistorico && ticks.length >= 50) {
    const hurstResult = calcularHurstRapido(ticks);
    hurst = hurstResult.hurst;
    r2 = hurstResult.r2;
  }

  const isPersistente = hurst > 0.58;

  // Calcular direções em múltiplos timeframes
  const ultimos3 = ticks.slice(-3);
  const ultimos7 = ticks.slice(-7);
  const ultimos15 = ticks.slice(-15);
  
  const varCurta = ultimos3[ultimos3.length - 1] - ultimos3[0];
  const varMedia = ultimos7[ultimos7.length - 1] - ultimos7[0];
  const varLonga = ultimos15[ultimos15.length - 1] - ultimos15[0];

  // Threshold para considerar movimento significativo
  const avgTick = ticks.reduce((a, b) => a + b, 0) / ticks.length;
  const threshold = avgTick * 0.0001; // 0.01% do valor médio

  const direcaoCurta: "ALTA" | "BAIXA" | "LATERAL" = 
    varCurta > threshold ? "ALTA" : varCurta < -threshold ? "BAIXA" : "LATERAL";
  const direcaoMedia: "ALTA" | "BAIXA" | "LATERAL" = 
    varMedia > threshold ? "ALTA" : varMedia < -threshold ? "BAIXA" : "LATERAL";
  const direcaoLonga: "ALTA" | "BAIXA" | "LATERAL" = 
    varLonga > threshold ? "ALTA" : varLonga < -threshold ? "BAIXA" : "LATERAL";

  // Calcular alinhamento (quantas direções concordam)
  const direcoes = [direcaoCurta, direcaoMedia, direcaoLonga];
  const altaCount = direcoes.filter(d => d === "ALTA").length;
  const baixaCount = direcoes.filter(d => d === "BAIXA").length;
  const lateralCount = direcoes.filter(d => d === "LATERAL").length;
  
  const maxCount = Math.max(altaCount, baixaCount);
  const alinhamento = (maxCount - lateralCount * 0.5) / 3;

  // Calcular força do movimento (normalizado)
  const ultimos20 = ticks.slice(-20);
  const media20 = ultimos20.reduce((a, b) => a + b, 0) / 20;
  const stdDev = Math.sqrt(
    ultimos20.reduce((acc, t) => acc + Math.pow(t - media20, 2), 0) / 20
  );
  const forca = stdDev > 0 ? Math.abs(varCurta) / stdDev : 0;

  // ============================================
  // DETECÇÃO DE MERCADO LATERAL
  // ============================================
  
  // 1. Eficiência do movimento (Efficiency Ratio)
  // Movimento líquido / Soma dos movimentos absolutos
  // Eficiência alta = tendência clara, Eficiência baixa = lateral/choppy
  const movimentoLiquido = Math.abs(ultimos15[ultimos15.length - 1] - ultimos15[0]);
  let movimentoTotal = 0;
  for (let i = 1; i < ultimos15.length; i++) {
    movimentoTotal += Math.abs(ultimos15[i] - ultimos15[i - 1]);
  }
  const eficiencia = movimentoTotal > 0 ? movimentoLiquido / movimentoTotal : 0;

  // 2. ADX simplificado (força da tendência)
  // Baseado em quantos ticks consecutivos vão na mesma direção
  let consecutivosMesmaDirecao = 0;
  let direcaoAtual: number | null = null;
  for (let i = ultimos15.length - 1; i > 0; i--) {
    const diff = ultimos15[i] - ultimos15[i - 1];
    const dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    if (dir === 0) continue;
    if (direcaoAtual === null) {
      direcaoAtual = dir;
      consecutivosMesmaDirecao = 1;
    } else if (dir === direcaoAtual) {
      consecutivosMesmaDirecao++;
    } else {
      break;
    }
  }
  
  // Calcular variação de direção (quantas vezes muda de direção)
  let mudancasDirecao = 0;
  let ultimaDirecao = 0;
  for (let i = 1; i < ultimos15.length; i++) {
    const diff = ultimos15[i] - ultimos15[i - 1];
    const dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    if (dir !== 0 && dir !== ultimaDirecao) {
      if (ultimaDirecao !== 0) mudancasDirecao++;
      ultimaDirecao = dir;
    }
  }
  
  // ADX = combinação de eficiência, consecutivos e poucas mudanças de direção
  // Range: 0 a 100
  const eficienciaScore = eficiencia * 40;  // 0 a 40
  const consecutivosScore = Math.min(consecutivosMesmaDirecao * 10, 30);  // 0 a 30
  const mudancasScore = Math.max(30 - mudancasDirecao * 5, 0);  // 0 a 30
  const adx = eficienciaScore + consecutivosScore + mudancasScore;

  // Mercado é LATERAL se:
  // - Eficiência < 0.3 (movimento "inútil")
  // - ADX < 25 (tendência fraca)
  // - Muitas mudanças de direção (> 5)
  // NOTA: Não bloqueamos sinais, apenas informamos o usuário
  const isLateral = eficiencia < 0.3 || adx < 25 || mudancasDirecao > 5;

  // REGRA PRINCIPAL: Se persistente E todas direções alinhadas
  if (isPersistente && alinhamento >= 0.8) {
    const direcaoMajoritaria = altaCount > baixaCount ? "ALTA" : "BAIXA";
    
    // Confiança baseada em: Hurst, R², alinhamento, força e eficiência
    const confiancaBase = (hurst - 0.5) * 2; // 0 a 0.4 para Hurst 0.5 a 0.7
    const confiancaR2 = r2 * 0.2;
    const confiancaAlinhamento = alinhamento * 0.2;
    const confiancaForca = Math.min(forca * 0.1, 0.2);
    const confiancaEficiencia = eficiencia * 0.2; // Bonus por eficiência alta
    const confianca = Math.min(confiancaBase + confiancaR2 + confiancaAlinhamento + confiancaForca + confiancaEficiencia, 0.80);

    if (direcaoMajoritaria === "ALTA") {
      return {
        sinal: "CALL",
        confianca,
        razao: `H=${hurst.toFixed(2)} + ADX=${adx.toFixed(0)} tendência ALTA (${altaCount}/3)`,
        hurst,
        r2,
        direcaoCurta,
        direcaoMedia,
        direcaoLonga,
        alinhamento,
        forca,
        isPersistente,
        eficiencia,
        adx,
        isLateral,
      };
    } else {
      return {
        sinal: "PUT",
        confianca,
        razao: `H=${hurst.toFixed(2)} + ADX=${adx.toFixed(0)} tendência BAIXA (${baixaCount}/3)`,
        hurst,
        r2,
        direcaoCurta,
        direcaoMedia,
        direcaoLonga,
        alinhamento,
        forca,
        isPersistente,
        eficiencia,
        adx,
        isLateral,
      };
    }
  }

  // REGRA SECUNDÁRIA: Mesmo sem alinhamento total, se força alta e 2/3 concordam
  if (isPersistente && maxCount >= 2 && forca > 1.5) {
    const direcaoMajoritaria = altaCount > baixaCount ? "ALTA" : "BAIXA";
    const confianca = Math.min((hurst - 0.5) * 1.5 + forca * 0.1, 0.55);

    if (direcaoMajoritaria === "ALTA") {
      return {
        sinal: "CALL",
        confianca,
        razao: `H=${hurst.toFixed(2)} + força ${forca.toFixed(1)}x + ADX=${adx.toFixed(0)}, ALTA (${altaCount}/3)`,
        hurst,
        r2,
        direcaoCurta,
        direcaoMedia,
        direcaoLonga,
        alinhamento,
        forca,
        isPersistente,
        eficiencia,
        adx,
        isLateral,
      };
    } else {
      return {
        sinal: "PUT",
        confianca,
        razao: `H=${hurst.toFixed(2)} + força ${forca.toFixed(1)}x + ADX=${adx.toFixed(0)}, BAIXA (${baixaCount}/3)`,
        hurst,
        r2,
        direcaoCurta,
        direcaoMedia,
        direcaoLonga,
        alinhamento,
        forca,
        isPersistente,
        eficiencia,
        adx,
        isLateral,
      };
    }
  }

  // Sem sinal claro
  return {
    sinal: "HOLD",
    confianca: 0,
    razao: isPersistente 
      ? `H=${hurst.toFixed(2)} persistente, mas direções não alinhadas (${maxCount}/3)`
      : `H=${hurst.toFixed(2)} não é persistente (< 0.58)`,
    hurst,
    r2,
    direcaoCurta,
    direcaoMedia,
    direcaoLonga,
    alinhamento,
    forca,
    isPersistente,
    eficiencia,
    adx,
    isLateral,
  };
}

/**
 * Cálculo rápido de Hurst (versão simplificada para uso em tempo real)
 */
function calcularHurstRapido(ticks: number[]): { hurst: number; r2: number } {
  const diffs: number[] = [];
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i - 1] > 0) {
      const logReturn = Math.log(ticks[i] / ticks[i - 1]);
      if (isFinite(logReturn)) diffs.push(logReturn);
    }
  }

  if (diffs.length < 30) return { hurst: 0.5, r2: 0 };

  const ranges: number[] = [];
  const scales: number[] = [];

  for (const scale of [8, 12, 16, 24, 32]) {
    if (diffs.length < scale * 2) continue;

    const rsValues: number[] = [];
    const numWindows = Math.floor(diffs.length / scale);

    for (let w = 0; w < numWindows; w++) {
      const window = diffs.slice(w * scale, (w + 1) * scale);
      const mean = window.reduce((a, b) => a + b, 0) / scale;
      const deviations = window.map(x => x - mean);

      let cumSum = 0;
      let maxCum = -Infinity;
      let minCum = Infinity;
      for (const dev of deviations) {
        cumSum += dev;
        maxCum = Math.max(maxCum, cumSum);
        minCum = Math.min(minCum, cumSum);
      }

      const R = maxCum - minCum;
      const S = Math.sqrt(deviations.reduce((acc, val) => acc + val * val, 0) / scale);

      if (S > 0 && R > 0 && isFinite(R / S)) {
        rsValues.push(R / S);
      }
    }

    if (rsValues.length > 0) {
      const avgRS = rsValues.reduce((a, b) => a + b, 0) / rsValues.length;
      if (avgRS > 0 && isFinite(avgRS)) {
        ranges.push(Math.log(avgRS));
        scales.push(Math.log(scale));
      }
    }
  }

  if (ranges.length < 2) return { hurst: 0.5, r2: 0 };

  // Regressão linear
  const n = ranges.length;
  const sumX = scales.reduce((a, b) => a + b, 0);
  const sumY = ranges.reduce((a, b) => a + b, 0);
  const sumXY = scales.reduce((acc, x, i) => acc + x * ranges[i], 0);
  const sumX2 = scales.reduce((acc, x) => acc + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) return { hurst: 0.5, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const hurst = Math.max(0.1, Math.min(0.9, slope));

  // Calcular R²
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  const ssTotal = ranges.reduce((acc, y) => acc + (y - yMean) ** 2, 0);
  const ssRes = ranges.reduce((acc, y, i) => acc + (y - (intercept + slope * scales[i])) ** 2, 0);
  const r2 = ssTotal > 0 ? Math.max(0, 1 - ssRes / ssTotal) : 0;

  return { hurst, r2 };
}
