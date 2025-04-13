import { loadHistoricalData } from "../utils/load-data";
import { ConfigOptimizer } from "./optmizer/config-optmizer";
import { runBackTest } from "./run-backtest";
import { ThreeAboveStrategy } from "./strategies/above-one";

function calculateTicksNeeded(): number {
  const now = new Date();
  const startOfDay = new Date();
  
  // Ajusta para 21:00 do dia anterior
  startOfDay.setDate(startOfDay.getDate() - 1);
  startOfDay.setHours(21, 0, 0, 0);

  // Converte para GMT-3
  const offset = -3;
  const localTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const gmtMinus3 = new Date(localTime + (offset * 60 * 60 * 1000));

  // Calcula a diferença em horas desde 21:00
  const diffInSeconds = Math.floor((gmtMinus3.getTime() - startOfDay.getTime()) / 1000);
  
  // Cada tick é 2 segundos
  const ticksNeeded = Math.ceil(diffInSeconds / 2);

  return ticksNeeded;
}

export async function getBackTestResults() {
  let optimizer: ConfigOptimizer | undefined;

  const ticksNeeded = calculateTicksNeeded();
  
  const digitStrategies = Array.from({ length: 10 }).map(
    (_, i) => new ThreeAboveStrategy({ entryDigit: i, compareDigit: 5 })
  );

  try {
    const data = (await loadHistoricalData({
      symbol: "R_10",
      count: ticksNeeded, // 12 hours
      format: "digits",
    })) as number[];

    const backTestResults = digitStrategies.map((strategy) =>
      runBackTest(data, strategy, 1000)
    );

    const digitsTradesHistory = backTestResults.map(
      (backTest) => backTest.digitStats
    );
    optimizer = new ConfigOptimizer(digitsTradesHistory, 6);
  } catch (error) {
    console.error("Erro ao executar backtest:", error);
  }

  return optimizer;
}
