/*
strategyTitle = 'Trailing Sawtooth Floor + Pattern Hunting';
author        = 'phantomph53';
version       = '1.0';
thanks        = 'cherie for original script';
*/

strategyTitle = 'Trailing Sawtooth Floor + Pattern Hunting';
game = 'baccarat';

// ===========================
// USER CONFIGURATION
// ===========================
const BASE_UNIT = 0.0001;  // Starting unit 
const RISK_SCALE = 0.50;    // Growth mode scale 
const PROFIT_TARGET = 0.10;    // Absolute profit gate 
const INITIAL_STOP_LOSS = 1.00;    // Safety before profit 
const DRAWBACK_PCT = 0.60;    // 60% drawback (locks 40% profit) 
const MAX_BET_CAP = 10.00;   // Hard single bet cap 
const MIN_BET = 0.0001;  // Lowest possible bet

// ===========================
// STATE & LADDERS
// ===========================
const mode = 'PHASE_1_ACCUMULATE';
const ladderStep = 0;
const growthStep = 0;
const resultLog = [];
const recoveryTarget = null;
const currentSide = 'PLAYER';
const startBalance = balance;
const sessionPeak = balance;
const profitFloor = startBalance - INITIAL_STOP_LOSS;

const ACCUM_UNITS = [1, 4, 8, 8, 16, 16, 32, 32];
const GROWTH_UNITS = [1, 2, 6, 18, 50, 130, 300];

// Initialization 
resetStats();
resetSeed();
clearConsole();

bankerBetSize = 0.0;
playerBetSize = 0.0;
tieBetSize = 0.0;

function fixed(num) {
    return parseFloat(Number(num).toFixed(4));
}

function applyBet(side, amt) {
    bankerBetSize = 0.0;
    playerBetSize = 0.0;
    tieBetSize = 0.0;
    const safeAmt = Math.floor(amt * 10000) / 10000;
    if (safeAmt < MIN_BET) safeAmt = MIN_BET;
    if (side == 'BANKER') { bankerBetSize = safeAmt; }
    else { playerBetSize = safeAmt; }
}

function updateDisplay(action) {
    clearConsole();
    if (balance > sessionPeak) { sessionPeak = balance; }
    const currentTotalProfit = sessionPeak - startBalance;
    if (currentTotalProfit >= PROFIT_TARGET) {
        const newFloor = startBalance + (currentTotalProfit * (1 - DRAWBACK_PCT));
        if (newFloor > profitFloor) { profitFloor = newFloor; }
    }
    log("#00FFFF", "================================");
    log("#FFD700", "MODE: " + mode + " | Side: " + (mode == 'PHASE_2_GROWTH' ? currentSide : 'BANKER'));
    log("#FFFFFF", "Balance: $" + balance.toFixed(4) + " | Peak: $" + sessionPeak.toFixed(4));
    log("#ADFF2F", "IRON FLOOR: $" + profitFloor.toFixed(4));
    if (recoveryTarget) { log("#FF4500", "GATE: Need recovery to resume"); }
    log("#00FFFF", "--------------------------------");
    log("#FFFFFF", "Action: " + action);
    log("#00FFFF", "================================");
}

engine.onBetPlaced(async (lastBet) => {
    if (!lastBet || lastBet.game !== 'baccarat') return;
    const res = (lastBet.state && lastBet.state.result) ? lastBet.state.result.toLowerCase() : '';
    if (res == 'player' || res == 'banker') {
        resultLog.push(res);
        if (resultLog.length > 10) { resultLog.shift(); }
    }
    const isTie = (res == 'tie');
    const isWin = lastBet.win && !isTie;
    const currentBal = fixed(balance);
    const currentFloor = fixed(profitFloor);

    if (currentBal <= currentFloor) {
        updateDisplay("STOP: FLOOR PROTECTED");
        engine.stop();
        return;
    }

    if (mode == 'FIX_BANKROLL') {
        if (currentBal >= recoveryTarget - 0.0001) {
            mode = 'PHASE_1_ACCUMULATE';
            ladderStep = 0;
            recoveryTarget = null;
        } else {
            applyBet('PLAYER', MIN_BET);
            updateDisplay("FIXING BANKROLL...");
            return;
        }
    }

    if (mode == 'PHASE_1_ACCUMULATE') {
        if (currentBal >= fixed(startBalance + PROFIT_TARGET)) {
            mode = 'PHASE_2_GROWTH';
            growthStep = 0;
        } else {
            if (!isTie) {
                if (isWin) { ladderStep = 0; } else { ladderStep++; }
            }
            if (ladderStep >= ACCUM_UNITS.length) {
                recoveryTarget = sessionPeak;
                mode = 'FIX_BANKROLL';
                applyBet('PLAYER', MIN_BET);
                return;
            }
            const bAmt = ACCUM_UNITS[ladderStep] * BASE_UNIT;
            if (fixed(currentBal - bAmt) < currentFloor) { bAmt = MIN_BET; }
            applyBet('BANKER', bAmt);
            updateDisplay("Accumulating...");
            return;
        }
    }

    if (mode == 'PHASE_2_GROWTH') {
        const retreatPoint = sessionPeak - ((sessionPeak - profitFloor) * 0.5);
        if (currentBal < retreatPoint) {
            mode = 'PHASE_1_ACCUMULATE';
            ladderStep = 0;
            applyBet('BANKER', MIN_BET);
            return;
        }
        const matched = false;
        if (resultLog.length >= 4) {
            const l4 = resultLog.slice(-4).join('');
            if (l4 == 'playerbankerplayerbanker' || l4 == 'playerplayerbankerbanker') { matched = true; }
        }
        if (!matched) {
            applyBet('PLAYER', MIN_BET);
            updateDisplay("Hunting Pattern...");
        } else {
            if (!isTie) {
                if (isWin) { growthStep = 0; } else { growthStep++; }
            }
            if (growthStep >= GROWTH_UNITS.length) {
                currentSide = (currentSide == 'PLAYER') ? 'BANKER' : 'PLAYER';
                mode = 'PHASE_1_ACCUMULATE';
                applyBet('BANKER', MIN_BET);
            } else {
                const gAmt = GROWTH_UNITS[growthStep] * (BASE_UNIT * RISK_SCALE);
                if (gAmt > MAX_BET_CAP) { gAmt = MAX_BET_CAP; }
                if (fixed(currentBal - gAmt) < currentFloor) { gAmt = MIN_BET; }
                applyBet(currentSide, gAmt);
                updateDisplay("Growth Engine");
            }
        }
    }
});