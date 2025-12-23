/*
strategyTitle = 'dice compounder';
author        = 'phantomph53';
version       = '1.3';

================================================================================
USER INSTRUCTIONS:
1. GAME: Dice (2.0x Multiplier / 50.00% Win Chance).
2. AUTO-SCALE: This script automatically detects your wallet size and adjusts 
   the Base Bet, Unit Step, and Max Cap based on professional risk tiers.
3. START: Forces a $0.05 hard-reset (or tier equivalent) to kill "Ghost Bets".
4. PROTECTION: 
   - $5 Profit: "The Bridge" activates (Floor moves to 0).
   - $10+ Profit: "The Ratchet" activates (Locks 85% of peak gains).
   - Near-Floor: "Cooling Mode" resets bet size to survive losing streaks.
================================================================================
*/

// ==========================================================
// 1. CONFIGURATION & AUTO-SCALE TIERS
// ==========================================================
const TARGET_SESSION_PROFIT = 25.00; // Sniper target for high success probability

function getTiers(balance) {
    if (balance < 75) return { base: 0.02, step: 0.02, cap: 1.00, sl: 12.50 };
    if (balance < 175) return { base: 0.05, step: 0.05, cap: 3.00, sl: 25.00 };
    if (balance < 400) return { base: 0.15, step: 0.10, cap: 6.00, sl: 60.00 };
    if (balance < 750) return { base: 0.25, step: 0.20, cap: 12.00, sl: 125.00 };
    return { base: 0.50, step: 0.50, cap: 25.00, sl: 250.00 }; // Whale Tier
}

// ==========================================================
// 2. ENGINE INITIALIZATION
// ==========================================================
game = 'dice';
target = 2.0;
betHigh = true;

let state = {
    totalWagered: 0,
    peakProfit: 0,
    currentBet: 0,
    lockedFloor: 0,
    lossStreak: 0,
    forceStop: false,
    firstRun: true,
    tier: null
};

const getLiveProfit = () => (typeof profit === "number" ? profit : 0);

// ==========================================================
// 3. CORE LOGIC & PROTECTION
// ==========================================================
function updateSafety(currentProfit) {
    if (currentProfit > state.peakProfit) state.peakProfit = currentProfit;

    // Milestone 1: The Bridge ($5.00) - Moves SL to break-even
    if (currentProfit >= 5.00 && state.lockedFloor < 0) {
        state.lockedFloor = 0;
        log('#FFD700', `>> BRIDGE: Capital 100% Protected.`);
    }

    // Milestone 2: Aggressive 85% Ratchet ($10.00+)
    if (state.peakProfit >= 10.00) {
        let newFloor = state.peakProfit * 0.85;
        if (newFloor > state.lockedFloor) state.lockedFloor = newFloor;
    }
}

// ==========================================================
// 4. MAIN EXECUTION LOOP
// ==========================================================
log('#80EE51', `!!! v18.3 UNIVERSAL COMPOUNDER ACTIVE !!!`);

engine.onBetPlaced(async (lastBet) => {
    if (state.forceStop) return;

    const currentProfit = getLiveProfit();
    const currentBalance = (typeof balance === "number" ? balance : 100) + currentProfit;

    // Initialize Tier on First Run
    if (state.firstRun) {
        state.tier = getTiers(currentBalance);
        state.currentBet = state.tier.base;
        state.lockedFloor = -state.tier.sl;
        betSize = state.tier.base;
        state.firstRun = false;
        log('#00FFFF', `>> TIER LOADED: Base $${state.tier.base} | SL -$${state.tier.sl}`);
    }

    updateSafety(currentProfit);

    if (lastBet) state.totalWagered += lastBet.amount;

    // Session Exit Logic
    if (currentProfit >= TARGET_SESSION_PROFIT) {
        state.forceStop = true;
        log('#4FFB4F', `🎯 SNIPER SUCCESS: +$${currentProfit.toFixed(2)}`);
        engine.stop(); return;
    }

    // Recovery & Pattern Logic
    if (lastBet && !state.firstRun) {
        if (lastBet.win) {
            state.currentBet = Math.max(state.tier.base, state.currentBet - state.tier.step);
            state.lossStreak = 0;
        } else {
            state.lossStreak++;
            state.currentBet = Math.min(state.tier.cap, state.currentBet + state.tier.step);

            // Side-flip every 2 losses to avoid RNG "traps"
            if (state.lossStreak % 2 === 0) betHigh = !betHigh;
        }
    }

    // Survival "Cooling" Mechanism
    // If within $2 of the floor, drop bet to base to outlast the streak.
    if ((currentProfit - state.currentBet) <= (state.lockedFloor + 2.00)) {
        state.currentBet = state.tier.base;
        log('#FFA500', `>> COOLING: Bet reset to survival minimum.`);
    }

    // Final Stop Gatekeeper
    if ((currentProfit - state.currentBet) <= state.lockedFloor) {
        state.forceStop = true;
        log('#FF4500', `🛑 PROFIT BANKED: Final Session Profit +$${currentProfit.toFixed(2)}`);
        engine.stop(); return;
    }

    betSize = Number(state.currentBet.toFixed(4));

    log('#FFFFFF', `------------------------------------------------`);
    log('#00FFFF', `WAGERED: $${state.totalWagered.toFixed(2)} | PROFIT: ${currentProfit.toFixed(4)}`);
    log('#FFA500', `FLOOR: ${state.lockedFloor.toFixed(2)} | NEXT: ${betSize.toFixed(4)}`);
});