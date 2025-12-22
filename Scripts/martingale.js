/*
strategyTitle = 'Martingale with Profit Locks - Baccarat';
author        = 'phantomph53';
version       = '1.6';
*/

/*
================================================================================
MARtiNGALE SURVIVAL CHEAT SHEET (Cumulative Loss / Stop Loss Values)
================================================================================
LS |  0.001 |  0.002 |  0.005 |   0.01 |   0.05 |   0.25 |   0.50 |   1.00
--------------------------------------------------------------------------------
1  |  0.001 |  0.002 |  0.005 |   0.01 |   0.05 |   0.25 |   0.50 |   1.00
2  |  0.003 |  0.006 |  0.015 |   0.03 |   0.15 |   0.75 |   1.50 |   3.00
3  |  0.007 |  0.014 |  0.035 |   0.07 |   0.35 |   1.75 |   3.50 |   7.00
4  |  0.015 |  0.030 |  0.075 |   0.15 |   0.75 |   3.75 |   7.50 |  15.00
5  |  0.031 |  0.062 |  0.155 |   0.31 |   1.55 |   7.75 |  15.50 |  31.00
6  |  0.063 |  0.126 |  0.315 |   0.63 |   3.15 |  15.75 |  31.50 |  63.00
7  |  0.127 |  0.254 |  0.635 |   1.27 |   6.35 |  31.75 |  63.50 | 127.00
8  |  0.255 |  0.510 |  1.275 |   2.55 |  12.75 |  63.75 | 127.50 | 255.00
9  |  0.511 |  1.022 |  2.555 |   5.11 |  25.55 | 127.75 | 255.50 | 511.00
10 |  1.023 |  2.046 |  5.115 |  10.23 |  51.15 | 255.75 | 511.50 | 1023.0
11 |  2.047 |  4.094 | 10.235 |  20.47 | 102.35 | 511.75 | 1023.5 | 2047.0
12 |  4.095 |  8.190 | 20.475 |  40.95 | 204.75 | 1023.7 | 2047.5 | 4095.0
13 |  8.191 | 16.382 | 40.955 |  81.91 | 409.55 | 2047.7 | 4095.5 | 8191.0
14 | 16.383 | 32.766 | 81.915 | 163.83 | 819.15 | 4095.7 | 8191.5 | 16383.
15 | 32.767 | 65.534 | 163.83 | 327.67 | 1638.3 | 8191.7 | 16383. | 32767.
================================================================================
INSTRUCTIONS:
1. Choose your BASE_BET.
2. Decide how many Loss Streaks (LS) you want to survive.
3. Find the value and enter it into INITIAL_STOP_LOSS.
4. Set DOLLARS_BEHIND slightly lower (0.01 or 0.02 lower) than Stop Loss.
================================================================================
*/

// ==========================================================
// USER CONFIGURABLE VARIABLES
// ==========================================================
const SESSION_START_BALANCE = 100.00; // Set hard cap on wallet just in case the script goes crazy

// Starting bet and stop loss
const BASE_BET = 0.01;
const INITIAL_STOP_LOSS = 10.23;  // $10.23 hard stop for a 10-loss streak ($0.01 base)

// Take profits and early exit
const TAKE_PROFIT_LIMIT = 20.00;  // Stop script once profit hits this
const EARLY_EXIT_STREAK = 8;      // Kill script at 7 losses if floor >= 0

// ==========================================================
// INITIALIZATION - DON'T CHANGE UNLESS YOU KNOW WHAT YOU ARE DOING
// ==========================================================
game = 'baccarat';
playerBetSize = BASE_BET;
bankerBetSize = 0;
tieBetSize = 0;
// Frequency to adjust the floor
const MILESTONE_STEP = Number((BASE_BET * 5).toFixed(4));
// Auto-calculate the trail to be exactly enough for the recovery bet
const DOLLARS_BEHIND = Number((INITIAL_STOP_LOSS - (BASE_BET * 2)).toFixed(4));

log('#80EE51', `!!! BACCARAT MARTINGALE STARTED !!!`);
log('#00FFFF', `TP: ${TAKE_PROFIT_LIMIT} | Early Exit: ${EARLY_EXIT_STREAK} L @ BE Floor`);

// ==========================================================
// INTERNAL STATE
// ==========================================================
let state = {
    lockedFloor: -INITIAL_STOP_LOSS,
    highestMilestoneReached: 0,
    totalWagered: 0,
    forceStop: false,
    sessionActive: true,
    currentBet: BASE_BET,
    winCount: 0,
    lossCount: 0,
    tieCount: 0,
    maxLossStreak: 0,
    currentLossStreak: 0
};

// ==========================================================
// CORE UTILITIES
// ==========================================================
const getTotalProfit = () => (typeof profit === "number" ? profit : 0);

function updateStepRatchet() {
    const p = getTotalProfit();
    let milestoneIndex = Math.floor(p / MILESTONE_STEP);

    if (milestoneIndex > state.highestMilestoneReached) {
        state.highestMilestoneReached = milestoneIndex;
        let newFloor = (milestoneIndex * MILESTONE_STEP) - DOLLARS_BEHIND;

        if (newFloor > state.lockedFloor) {
            state.lockedFloor = newFloor;
            log('#FFD700', `>> MILESTONE REACHED: Floor ratcheted to +${state.lockedFloor.toFixed(2)}`);
        }
    }
}

function logStatus(nextBet, statusType = "RUNNING") {
    if (state.forceStop) return;
    const p = getTotalProfit();
    const currentBal = SESSION_START_BALANCE + p;

    log('#FFFFFF', `------------------------------------------------`);
    log('#80EE51', `START: ${SESSION_START_BALANCE.toFixed(2)} | CURRENT: ${currentBal.toFixed(4)}`);
    log('#00FFFF', `PROFIT: ${p.toFixed(4)} | NEXT PLAYER BET: ${nextBet.toFixed(4)}`);
    log('#FFA500', `STATUS: ${statusType} | FLOOR: ${state.lockedFloor.toFixed(2)}`);
    log('#ABB2BF', `W/L/T: ${state.winCount}/${state.lossCount}/${state.tieCount} | STREAK: ${state.currentLossStreak}`);
}

// ==========================================================
// MAIN EXECUTION LOOP
// ==========================================================
engine.onBetPlaced(async (lastBet) => {
    if (state.forceStop) return;

    const p = getTotalProfit();
    updateStepRatchet();

    // --- TAKE PROFIT CHECK ---
    if (p >= TAKE_PROFIT_LIMIT) {
        state.forceStop = true;
        log('#4FFB4F', `🎯 TAKE PROFIT HIT: ${p.toFixed(4)}. Closing session.`);
        engine.stop();
        return;
    }

    let currentStatus = "RUNNING";

    if (lastBet) {
        state.totalWagered += lastBet.amount;

        if (lastBet.payoutMultiplier === 1) {
            state.tieCount++;
            currentStatus = "TIE/PUSH";
        }
        else if (lastBet.win) {
            state.winCount++;
            state.currentLossStreak = 0;
            state.currentBet = BASE_BET;
            currentStatus = "WIN";
        }
        else {
            state.lossCount++;
            state.currentLossStreak++;
            if (state.currentLossStreak > state.maxLossStreak) state.maxLossStreak = state.currentLossStreak;
            state.currentBet = lastBet.amount * 2;
            currentStatus = "LOSS";
        }
    }

    // --- SAFETY GATEKEEPER ---
    let nextRisk = state.currentBet;
    let potentialProfitIfLoss = p - nextRisk;

    // 1. EARLY EXIT: 8 losses in a row if we are at/above break-even floor
    if (state.lockedFloor >= 0 && state.currentLossStreak >= EARLY_EXIT_STREAK) {
        state.forceStop = true;
        log('#FF4500', `🛑 EARLY EXIT: Hit ${EARLY_EXIT_STREAK} losses in profit protection mode.`);
        engine.stop();
        return;
    }

    // 2. PRE-CALCULATION BREACH
    if (potentialProfitIfLoss < state.lockedFloor || p < state.lockedFloor) {
        state.forceStop = true;
        playerBetSize = 0; bankerBetSize = 0;

        log('#FF4500', `------------------------------------------------`);
        log('#FF4500', `🛑 RISK BREACH: Safety Circuit Tripped`);
        log('#FF4500', `Current Profit: ${p.toFixed(4)} | Floor: ${state.lockedFloor.toFixed(2)}`);
        log('#FF4500', `POTENTIAL BET: ${nextRisk.toFixed(4)}`);
        log('#FF4500', `IF LOST: ${potentialProfitIfLoss.toFixed(4)}`);
        log('#FF4500', `------------------------------------------------`);

        engine.stop();
        return;
    }

    playerBetSize = state.currentBet;
    logStatus(state.currentBet, currentStatus);
});

engine.onBettingStopped(() => {
    if (!state.sessionActive) return;
    state.sessionActive = false;

    const finalP = getTotalProfit();
    log('#FFFF00', `⏹ SESSION ENDED`);
    log('#FFFF00', `Final Profit: ${finalP.toFixed(4)} | Total Wagered: ${state.totalWagered.toFixed(2)}`);
    log('#FFFF00', `W/L/T: ${state.winCount}/${state.lossCount}/${state.tieCount}`);
});