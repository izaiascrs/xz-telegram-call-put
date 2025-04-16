export class TradeWinRateManger {
  private isAllowToTrade = true;
  private lastTradeResult: boolean | undefined = undefined;
  private previousTradeResult: boolean | undefined = undefined;
  private onTradeReach?: (type: "win" | "loss") => void;

  constructor() {}

  setOnTradeReach(callback: (type: "win" | "loss") => void) {
    this.onTradeReach = callback;
  }

  updateTradeResult(isWin: boolean) {
    this.lastTradeResult = isWin;
    this.isAllowToTrade = true;

    if (this.onTradeReach) {
      if (this.lastTradeResult !== this.previousTradeResult) {
        this.onTradeReach(this.lastTradeResult ? "win" : "loss");
      }
    }

    this.previousTradeResult = isWin;
  }

  canTrade() {
    return this.isAllowToTrade;
  }
}
