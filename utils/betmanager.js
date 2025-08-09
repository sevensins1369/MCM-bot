const fs = require("fs");
const path = require("path");

// This is a simple JSON-based implementation
// You should replace this with proper database operations
class BetManager {
  constructor() {
    this.betsPath = path.join(__dirname, "..", "data", "bets.json");
    this.ensureBetsFile();
  }

  ensureBetsFile() {
    if (!fs.existsSync(this.betsPath)) {
      fs.writeFileSync(this.betsPath, JSON.stringify({ bets: [] }, null, 2));
      if (!hostDuel.betsOpen) {
        return interaction.reply({
          content: `❌ Betting is closed for ${host.username}'s ${duelType} duel.`,
        });
      }
    }
  }

  async storeBet(bet) {
    try {
      const data = JSON.parse(fs.readFileSync(this.betsPath, "utf8"));
      bet.id = Date.now() + Math.random(); // Simple ID generation
      data.bets.push(bet);
      fs.writeFileSync(this.betsPath, JSON.stringify(data, null, 2));
      return bet;
    } catch (error) {
      console.error("Error storing bet:", error);
      throw error;
    }
  }

  async getBetsByDuelAndHost(duelType, hostId) {
    try {
      const data = JSON.parse(fs.readFileSync(this.betsPath, "utf8"));
      return data.bets.filter(
        (bet) => bet.duelType === duelType && bet.host === hostId
      );
    } catch (error) {
      console.error("Error fetching bets:", error);
      return [];
    }
  }

  async clearBetsByDuelAndHost(duelType, hostId) {
    try {
      const data = JSON.parse(fs.readFileSync(this.betsPath, "utf8"));
      data.bets = data.bets.filter(
        (bet) => !(bet.duelType === duelType && bet.host === hostId)
      );
      fs.writeFileSync(this.betsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error clearing bets:", error);
      throw error;
    }
  }

  async getBetsByPlayer(playerId) {
    try {
      const data = JSON.parse(fs.readFileSync(this.betsPath, "utf8"));
      return data.bets.filter((bet) => bet.player === playerId);
    } catch (error) {
      console.error("Error fetching player bets:", error);
      return [];
    }
  }
}
