// Additional file: StateManager.js (recommended)
// This should be created to manage global state properly
class StateManager {
    constructor() {
        this.activeDuels = new Map();
        this.hostDuels = new Map();
        this.userBets = new Map();
    }

    createDuel(hostId, duelType) {
        const duel = {
            host: hostId,
            duelType: duelType,
            active: true,
            bets: [],
            createdAt: new Date()
        };
        
        this.activeDuels.set(hostId, duel);
        this.hostDuels.set(hostId, duel);
        
        return duel;
    }

    getDuel(hostId) {
        return this.activeDuels.get(hostId);
    }

    deleteDuel(hostId) {
        this.activeDuels.delete(hostId);
        this.hostDuels.delete(hostId);
    }

    addBet(bet) {
        const duel = this.activeDuels.get(bet.host);
        if (duel) {
            duel.bets.push(bet);
            this.userBets.set(bet.player, bet);
        }
    }

    removeBet(playerId) {
        this.userBets.delete(playerId);
    }

    getUserBet(playerId) {
        return this.userBets.get(playerId);
    }
}

module.exports = StateManager;