/*
strategyTitle = 'Martingale with Profit Locks - Baccarat';
author        = 'phantomph53';
version       = '1.5';
*/

// ==========================================================
// USER CONFIGURABLE VARIABLES
// ==========================================================
const SESSION_START_BALANCE = 100.00;
const INITIAL_STOP_LOSS = 10.24;  // Hard 10-loss limit ($0.01 base)

const BASE_BET = 0.01;
const MILESTONE_STEP = 0.10;
const DOLLARS_BEHIND = 10.22;

const TAKE_PROFIT_LIMIT = 20.00;  // Stop script once profit hits this
const EARLY_EXIT_STREAK = 8;      // Kill script at 7 losses if floor >= 0

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
// INITIALIZATION
// ==========================================================
game = 'baccarat';
playerBetSize = BASE_BET;
bankerBetSize = 0;
tieBetSize = 0;

log('#80EE51', `!!! BACCARAT MARTINGALE v1.5 STARTED !!!`);
log('#00FFFF', `TP: ${TAKE_PROFIT_LIMIT} | Early Exit: ${EARLY_EXIT_STREAK} L @ BE Floor`);

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