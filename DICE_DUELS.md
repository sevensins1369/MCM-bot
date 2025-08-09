# Dice Duels Documentation

This document provides detailed information about the dice duel feature available in the StakeBot.

## Table of Contents
1. [Overview](#overview)
2. [Commands](#commands)
3. [How to Play](#how-to-play)
4. [Technical Implementation](#technical-implementation)
5. [Leaderboards](#leaderboards)

## Overview

Dice Duels is a player-versus-player (PvP) gambling feature that allows users to challenge each other to a dice rolling contest. Players bet an equal amount of currency, and the player who rolls the highest number (1-100) wins the entire pot.

## Commands

### `/diceduel <opponent> <amount> [currency]`
- **Description:** Challenge another player to a dice duel
- **Options:**
  - `opponent`: The player to challenge (required)
  - `amount`: The amount to bet (required)
  - `currency`: The currency to bet (optional, defaults to user's preferred currency)
- **Aliases:** `!diceduel`, `!dd`

### `/diceduel-cancel`
- **Description:** Cancel your active dice duel
- **Aliases:** `!diceduel-cancel`, `!ddc`

### `/diceduel-roll`
- **Description:** Roll the dice in your active duel
- **Aliases:** `!diceduel-roll`, `!ddr`

### `/diceduel-leaderboard <currency> <timeframe> <category>`
- **Description:** View the dice duel leaderboard
- **Options:**
  - `currency`: The currency to view (osrs or rs3)
  - `timeframe`: The timeframe to view (allTime, daily, weekly, monthly)
  - `category`: The category to rank by (profit, wagered, wins, streak)
- **Aliases:** `!diceduel-leaderboard`, `!ddlb`

## How to Play

1. **Challenge a Player:**
   - Use the `/diceduel` command to challenge another player
   - Specify the amount you want to bet and the currency
   - The amount will be deducted from your wallet immediately

2. **Accept/Decline:**
   - The challenged player will receive a message with buttons to accept or decline
   - If accepted, the bet amount will be deducted from their wallet
   - If declined, your bet will be refunded

3. **Roll the Dice:**
   - Both players use the `/diceduel-roll` command to roll their dice
   - Each player rolls a random number between 1 and 100
   - The player with the higher roll wins

4. **Outcome:**
   - The winner receives both players' bets (2x the bet amount)
   - In case of a tie, both players get their bets refunded
   - Results are automatically processed and added to player statistics

## Technical Implementation

### Models

The dice duel system uses an in-memory storage system with the following data structure:

```javascript
{
  id: "unique-uuid",
  challengerId: "challenger-discord-id",
  opponentId: "opponent-discord-id",
  amount: "1000000", // Stored as string to handle BigInt
  currency: "osrs", // or "rs3"
  createdAt: Date,
  isAccepted: false,
  isComplete: false,
  challengerRolled: false,
  opponentRolled: false,
  challengerRoll: 0,
  opponentRoll: 0,
  messageId: null
}
```

### Managers

The `DiceDuelManager.js` utility handles all dice duel operations:
- Creating duels
- Accepting duels
- Processing rolls
- Determining winners
- Handling payouts
- Cancelling duels

### Error Handling

The dice duel system includes comprehensive error handling:
- Validation of all user inputs
- Proper error messages for common issues
- Prevention of multiple active duels
- Wallet balance checks
- Automatic cancellation of inactive duels

## Leaderboards

The dice duel leaderboard tracks various statistics:

- **Profit:** Total profit from dice duels
- **Wagered:** Total amount wagered in dice duels
- **Wins:** Number of dice duels won
- **Streak:** Best winning streak in dice duels

Leaderboards can be filtered by:
- **Currency:** OSRS or RS3
- **Timeframe:** All time, daily, weekly, or monthly
- **Category:** Profit, wagered, wins, or streak

## Future Enhancements

Potential future improvements to the dice duel system:
- Persistent storage in MongoDB for active duels
- Automatic timeout for inactive duels
- Spectator mode for other users to watch duels
- Custom dice roll ranges
- Tournament mode for multiple players