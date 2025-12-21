/*
strategyTitle = 'Martingale with Profit Locks - Baccarat';
author        = 'phantomph53';
version       = '1.2';
*/

// ==========================================================
// USER CONFIGURABLE VARIABLES
// ==========================================================
const SESSION_START_BALANCE = 100.00;
const INITIAL_STOP_LOSS = 5.00;

const BASE_BET = 0.10;
const MILESTONE_STEP = 5.00;
const DOLLARS_BEHIND = 5.00;

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

function logStatus(nextBet) {
    if (state.forceStop) return;
    const p = getTotalProfit();
    const currentBal = SESSION_START_BALANCE + p;

    log('#FFFFFF', `------------------------------------------------`);
    log('#80EE51', `START: ${SESSION_START_BALANCE.toFixed(2)} | CURRENT: ${currentBal.toFixed(4)}`);
    log('#00FFFF', `PROFIT: ${p.toFixed(4)} | NEXT PLAYER BET: ${nextBet.toFixed(4)}`);
    log('#FFA500', `FLOOR: ${state.lockedFloor.toFixed(2)} | MAX LOSS STREAK: ${state.maxLossStreak}`);
    log('#ABB2BF', `WINS: ${state.winCount} | LOSSES: ${state.lossCount} | WAGERED: ${state.totalWagered.toFixed(2)}`);
}

// ==========================================================
// INITIALIZATION
// ==========================================================
game = 'baccarat';
playerBetSize = BASE_BET;
bankerBetSize = 0;
tieBetSize = 0;

log('#80EE51', `!!! BACCARAT MARTINGALE v1.1 STARTED !!!`);

// ==========================================================
// MAIN EXECUTION LOOP
// ==========================================================
engine.onBetPlaced(async (lastBet) => {
    if (state.forceStop) return;

    const p = getTotalProfit();
    updateStepRatchet();

    if (lastBet) {
        state.totalWagered += lastBet.amount;
        if (lastBet.win) {
            state.winCount++;
            state.currentLossStreak = 0;
            state.currentBet = BASE_BET;
        } else {
            state.lossCount++;
            state.currentLossStreak++;
            if (state.currentLossStreak > state.maxLossStreak) state.maxLossStreak = state.currentLossStreak;
            state.currentBet = lastBet.amount * 2;
        }
    }

    // --- PRE-CALCULATION SAFETY GATEKEEPER ---
    let nextRisk = state.currentBet;
    let potentialProfitIfLoss = p - nextRisk;

    if (potentialProfitIfLoss < state.lockedFloor || p < state.lockedFloor) {
        state.forceStop = true;
        playerBetSize = 0; bankerBetSize = 0; tieBetSize = 0;

        log('#FF4500', `------------------------------------------------`);
        log('#FF4500', `🛑 RISK BREACH: Safety Circuit Tripped`);
        log('#FF4500', `Current Profit: ${p.toFixed(4)} | Floor: ${state.lockedFloor.toFixed(2)}`);
        log('#FF4500', `POTENTIAL BET: ${nextRisk.toFixed(4)}`);
        log('#FF4500', `POTENTIAL RESULT: ${potentialProfitIfLoss.toFixed(4)}`);
        log('#FF4500', `------------------------------------------------`);

        engine.stop();
        return;
    }

    playerBetSize = state.currentBet;
    logStatus(state.currentBet);
});

engine.onBettingStopped(() => {
    if (!state.sessionActive) return;
    state.sessionActive = false;

    const finalP = getTotalProfit();
    log('#FFFF00', `⏹ SESSION ENDED`);
    log('#FFFF00', `Final Profit/Loss: ${finalP.toFixed(4)}`);
    log('#FFFF00', `Total Wagered: ${state.totalWagered.toFixed(2)}`);
    log('#FFFF00', `Max Loss Streak: ${state.maxLossStreak}`);
});