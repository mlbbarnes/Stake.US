/*
strategyTitle = 'Wager with Profit Locks - Dice and Baccarat';
author        = 'phantomph53';
version       = '1.11';
thanks        = 'cherie for original script';
*/

// ==========================================================
// USER CONFIGURABLE VARIABLES
// ==========================================================
const SESSION_START_BALANCE = 100.00;
const MAX_SESSION_LOSS = 15.00;

const BRIDGE_TRIGGER = 3.00;
const TRAILING_START = 7.50;
const TRAILING_RATIO = 0.60;

const BACC_PROFIT_TRIGGER = 15.00;
const PROFIT_TO_BANK = 3.00;
const BACC_PLAYBACK_LIMIT = 15.00;

const DICE_WALLET = 300.00;
const DICE_BASE_DIVISOR = 125000;
const DICE_MAX_BET = 100.00;
const DICE_BASE_CHANCE = 40.00;
const DICE_FACTOR_LOSS = 3.1525;
const DICE_FACTOR_L8 = 1.10;

const BAC_DUST_BET = 0.01;
const BAC_RESERVE_BUFFER = 5.00;

// ==========================================================
// INTERNAL STATE
// ==========================================================
let state = {
    bankedProfit: 0,
    lockedFloor: -MAX_SESSION_LOSS,
    peakAvailable: 0,
    phase: "DICE",
    baccMode: "SCOUT",
    baccHist: [],
    totalWagered: 0,
    forceStop: false,
    diceBaseBet: DICE_WALLET / DICE_BASE_DIVISOR,
    currentChance: DICE_BASE_CHANCE
};

// ==========================================================
// --- ENGINE INITIALIZATION
// ==========================================================
game = 'dice';
betSize = state.diceBaseBet;
target = chanceToMultiplier(state.currentChance);
betHigh = true;
playerBetSize = 0;
bankerBetSize = 0;

// ==========================================================
// CORE UTILITIES
// ==========================================================
const getTotalProfit = () => (typeof profit === "number" ? profit : 0);
const getAvailableProfit = () => getTotalProfit() - state.bankedProfit;

function diceSetChance(chance) {
    state.currentChance = chance;
    target = chanceToMultiplier(chance);
}

function updateFloor() {
    const av = getAvailableProfit();
    if (av > state.peakAvailable) state.peakAvailable = av;
    if (av >= BRIDGE_TRIGGER && state.lockedFloor < 0) state.lockedFloor = 0;
    if (state.peakAvailable >= TRAILING_START) {
        let newFloor = state.peakAvailable * TRAILING_RATIO;
        if (newFloor > state.lockedFloor) state.lockedFloor = newFloor;
    }
}

// ==========================================================
// INITIALIZATION
// ==========================================================
if (!isFinite(state.diceBaseBet) || state.diceBaseBet <= 0) state.diceBaseBet = 0.0001;
betSize = state.diceBaseBet;
diceSetChance(DICE_BASE_CHANCE);

// ==========================================================
// MAIN EXECUTION LOOP
// ==========================================================
engine.onBetPlaced(async (lastBet) => {
    if (state.forceStop) return;

    const av = getAvailableProfit();
    updateFloor();
    if (lastBet) state.totalWagered += lastBet.amount;

    // ---------------------------------------------------------
    // STEP 1: CALCULATE THE STRATEGY MOVE FIRST (DON'T BET YET)
    // ---------------------------------------------------------
    let nextBetSize = 0;
    let nextChance = state.currentChance;

    if (state.phase === "DICE") {
        if (av >= BACC_PROFIT_TRIGGER) {
            state.bankedProfit += PROFIT_TO_BANK;
            state.phase = "BACCARAT"; game = "baccarat"; state.baccMode = "SCOUT"; state.baccHist = [];
            playerBetSize = BAC_DUST_BET; bankerBetSize = BAC_DUST_BET;
            return;
        }

        if (!lastBet || lastBet.game !== "dice" || lastBet.win) {
            nextBetSize = state.diceBaseBet;
            nextChance = DICE_BASE_CHANCE;
        } else {
            const streak = Math.abs(currentStreak);
            nextBetSize = lastBet.amount * DICE_FACTOR_LOSS;
            if (streak >= 8) nextChance = 68.28;
            else if (streak >= 6) nextChance = 63.87;
            else if (streak >= 5) nextChance = 60.00;
            else if (streak >= 4) nextChance = 55.00;
            else if (streak >= 2) nextChance = 49.50;
            else nextChance = DICE_BASE_CHANCE;

            if (streak === 8) nextBetSize *= DICE_FACTOR_L8;
            if (streak === 3) betHigh = !betHigh;
            nextBetSize = Math.min(nextBetSize, DICE_MAX_BET);
        }
    } else {
        // Baccarat Logic
        if (av < (BACC_PROFIT_TRIGGER - BACC_PLAYBACK_LIMIT)) {
            state.phase = "DICE"; game = "dice";
            betSize = state.diceBaseBet; diceSetChance(DICE_BASE_CHANCE); betHigh = true;
            return;
        }
        if (lastBet && lastBet.game === "baccarat" && lastBet.state?.result) {
            state.baccHist.push(String(lastBet.state.result).toLowerCase());
            if (state.baccHist.length > 10) state.baccHist.shift();
        }
        if (state.baccMode === "SCOUT") {
            playerBetSize = BAC_DUST_BET; bankerBetSize = BAC_DUST_BET;
            if (state.baccHist.length >= 2 && state.baccHist[state.baccHist.length - 1] === "banker" && state.baccHist[state.baccHist.length - 2] === "banker") {
                state.baccMode = "WAGER";
            }
        } else {
            const stake = Math.max(0, av - BAC_RESERVE_BUFFER);
            playerBetSize = stake / 2; bankerBetSize = stake / 2;
        }
        nextBetSize = playerBetSize + bankerBetSize;
    }

    // ---------------------------------------------------------
    // STEP 2: HYPER-PESSIMISTIC GATEKEEPER (BEFORE APPLYING)
    // ---------------------------------------------------------
    const potentialBalanceIfLoss = av - nextBetSize;

    if (potentialBalanceIfLoss <= state.lockedFloor || av <= state.lockedFloor) {
        state.forceStop = true;

        // Zero out everything to prevent the engine from firing
        betSize = 0; playerBetSize = 0; bankerBetSize = 0;

        log('#FF4500', `------------------------------------------------`);
        log('#FF4500', `🛑 PRE-EMPTIVE STOP: Floor Protection`);
        log('#FF4500', `Floor: ${state.lockedFloor.toFixed(2)} | Current Avail: ${av.toFixed(4)}`);
        log('#FF4500', `Blocked Bet: ${nextBetSize.toFixed(4)}`);
        log('#FF4500', `Potential Balance If Lost: ${potentialBalanceIfLoss.toFixed(4)}`);
        log('#FF4500', `------------------------------------------------`);

        engine.stop();
        return;
    }

    // ---------------------------------------------------------
    // STEP 3: APPLY STRATEGY AND LOG
    // ---------------------------------------------------------
    if (state.phase === "DICE") {
        betSize = nextBetSize;
        diceSetChance(nextChance);
    }

    // Custom Log Output
    const currentBal = SESSION_START_BALANCE + getTotalProfit();
    log('#FFFFFF', `------------------------------------------------`);
    log('#80EE51', `START: ${SESSION_START_BALANCE.toFixed(2)} | CURRENT: ${currentBal.toFixed(4)}`);
    log('#00FFFF', `PHASE: ${state.phase} | PROFIT: ${getTotalProfit().toFixed(4)} | AVAIL: ${av.toFixed(4)}`);
    log('#FFD700', `LAST: ${(lastBet ? lastBet.amount : 0).toFixed(4)} | NEXT RISK: ${nextBetSize.toFixed(4)}`);
    log('#FFA500', `FLOOR: ${state.lockedFloor.toFixed(2)} | PEAK: ${state.peakAvailable.toFixed(2)}`);
});

engine.onBettingStopped(() => {
    log('#FFFF00', `⏹ SESSION ENDED. Final Profit: ${getTotalProfit().toFixed(4)}`);
});