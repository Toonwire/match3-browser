# Stat Scaling & Balancing Guide

## Overview

This document outlines the stat scaling system for a rogue-like match-3 game. The goal is to create challenging, escalating difficulty that rewards strategic play and punishes mistakes.

## Core Principles

1. **Exponential scaling**: Each stage should feel noticeably harder than the previous
2. **World difficulty multipliers**: Easy/Medium/Hard worlds have base multipliers
3. **Stage progression**: Later stages in a world are significantly harder
4. **Boss scaling**: Bosses should be 2-3x stronger than regular enemies
5. **Player cards stay static**: Player power comes from card collection/upgrades, not auto-scaling

---

## Enemy Unit Scaling Formula

### Base Multipliers by World Difficulty

- **Easy** (World 1 - Green): `1.0x` base
- **Medium** (World 2 - Red): `1.5x` base
- **Hard** (World 3 - Blue): `2.25x` base

### Stage Multiplier

Stage multiplier increases exponentially:

```
stageMultiplier = 1.0 + (stageIndex * 0.25)
```

Where `stageIndex` is 0-based (first stage = 0, second = 1, etc.)

### Final Enemy Stat Calculation

```
scaledAttack = baseAttack * worldMultiplier * stageMultiplier
scaledHp = baseHp * worldMultiplier * stageMultiplier
```

### Boss Multiplier

Bosses get an additional `2.0x` multiplier on top of the above:

```
bossAttack = baseAttack * worldMultiplier * stageMultiplier * 2.0
bossHp = baseHp * worldMultiplier * stageMultiplier * 2.0
```

---

## Detailed Stat Tables

### World 1: Green (Easy)

**Base Multiplier: 1.0x**

#### Stage 1: Tree Tops (stageIndex = 0)

- **unit_wisp**:
  - Attack: 3 × 1.0 × 1.0 = **3** (unchanged)
  - HP: 3 × 1.0 × 1.0 = **3** (unchanged)

#### Stage 2: Canopy Layer (stageIndex = 1)

- **unit_wisp**:
  - Attack: 3 × 1.0 × 1.25 = **4** (+33%)
  - HP: 3 × 1.0 × 1.25 = **4** (+33%)

#### Stage 3: Forest Floor (stageIndex = 2)

- **unit_wisp**:
  - Attack: 3 × 1.0 × 1.5 = **5** (+67%)
  - HP: 3 × 1.0 × 1.5 = **5** (+67%)
- **unit_wisp_lieutenant**:
  - Attack: 5 × 1.0 × 1.5 = **8** (+60%)
  - HP: 8 × 1.0 × 1.5 = **12** (+50%)

#### Stage 4: Root System (stageIndex = 3) - Boss Stage

- **unit_wisp**:
  - Attack: 3 × 1.0 × 1.75 = **5** (+67%)
  - HP: 3 × 1.0 × 1.75 = **5** (+67%)
- **unit_wisp_lieutenant**:
  - Attack: 5 × 1.0 × 1.75 = **9** (+80%)
  - HP: 8 × 1.0 × 1.75 = **14** (+75%)
- **unit_wisp_boss**:
  - Attack: 8 × 1.0 × 1.75 × 2.0 = **28** (+250%)
  - HP: 15 × 1.0 × 1.75 × 2.0 = **53** (+253%)

---

### World 2: Red (Medium)

**Base Multiplier: 1.5x**

#### Stage 1: Ashfall Peaks (stageIndex = 0)

- **unit_whelp**:
  - Attack: 4 × 1.5 × 1.0 = **6** (+50%)
  - HP: 2 × 1.5 × 1.0 = **3** (+50%)

#### Stage 2: Magma Flow Canyons (stageIndex = 1)

- **unit_whelp**:
  - Attack: 4 × 1.5 × 1.25 = **8** (+100%)
  - HP: 2 × 1.5 × 1.25 = **4** (+100%)

#### Stage 3: Inferno Basin (stageIndex = 2)

- **unit_whelp**:
  - Attack: 4 × 1.5 × 1.5 = **9** (+125%)
  - HP: 2 × 1.5 × 1.5 = **5** (+150%)

#### Stage 4: Sacred Furnace (stageIndex = 3) - Boss Stage

- **unit_whelp_boss**:
  - Attack: 10 × 1.5 × 1.75 × 2.0 = **53** (+430%)
  - HP: 12 × 1.5 × 1.75 × 2.0 = **63** (+425%)

---

### World 3: Blue (Hard)

**Base Multiplier: 2.25x**

#### Stage 1: Frozen Wastes (stageIndex = 0)

- **unit_slime**:
  - Attack: 2 × 2.25 × 1.0 = **5** (+150%)
  - HP: 4 × 2.25 × 1.0 = **9** (+125%)

#### Stage 2: Ice Fields (stageIndex = 1)

- **unit_slime**:
  - Attack: 2 × 2.25 × 1.25 = **6** (+200%)
  - HP: 4 × 2.25 × 1.25 = **11** (+175%)

#### Stage 3: Frostbite Chasm (stageIndex = 2)

- **unit_slime**:
  - Attack: 2 × 2.25 × 1.5 = **7** (+250%)
  - HP: 4 × 2.25 × 1.5 = **14** (+250%)
- **unit_slime_lieutenant**:
  - Attack: 4 × 2.25 × 1.5 = **14** (+250%)
  - HP: 6 × 2.25 × 1.5 = **20** (+233%)

#### Stage 4: Icy Descent (stageIndex = 3)

- **unit_slime**:
  - Attack: 2 × 2.25 × 1.75 = **8** (+300%)
  - HP: 4 × 2.25 × 1.75 = **16** (+300%)
- **unit_slime_lieutenant**:
  - Attack: 4 × 2.25 × 1.75 = **16** (+300%)
  - HP: 6 × 2.25 × 1.75 = **24** (+300%)

#### Stage 5: Crystal Hollows (stageIndex = 4) - Boss Stage

- **unit_slime**:
  - Attack: 2 × 2.25 × 2.0 = **9** (+350%)
  - HP: 4 × 2.25 × 2.0 = **18** (+350%)
- **unit_slime_lieutenant**:
  - Attack: 4 × 2.25 × 2.0 = **18** (+350%)
  - HP: 6 × 2.25 × 2.0 = **27** (+350%)
- **unit_rimescale**:
  - Attack: 30 × 2.25 × 2.0 × 2.0 = **270** (+800%)
  - HP: 200 × 2.25 × 2.0 × 2.0 = **1800** (+800%)

---

## Card Stat Balancing

### Current Issues

- Rank 1 cards are too weak for later stages
- Rank 2-3 cards have inconsistent power curves
- Some cards are significantly stronger than others at same rank

### Recommended Card Adjustments

#### Rank 1 Cards (Early Game)

These should be viable for World 1, but struggle in World 2+:

- **card_01_whelp**: Attack 4 → **5**, HP 2 → **3** (slightly stronger)
- **card_04_slime**: Attack 2 → **3**, HP 4 → **5** (more balanced)
- **card_07_wisp**: Attack 3 → **4**, HP 3 → **4** (slightly stronger)

#### Rank 2 Cards (Mid Game)

These should handle World 2, struggle in World 3:

- **card_02_whelpier**: Attack 6 → **8**, HP 4 → **6** (more durable)
- **card_05_slimer**: Attack 4 → **6**, HP 6 → **8** (more offensive)
- **card_08_wispier**: Attack 5 → **7**, HP 5 → **7** (balanced)
- **card_11_icy**: Attack 5 → **7**, HP 8 → **10** (tankier)
- **card_13_leafmane**: Attack 9 → **11**, HP 9 → **11** (stronger)
- **card_15_firebro**: Attack 12 → **14**, HP 10 → **12** (stronger)

#### Rank 3 Cards (Late Game)

These should be necessary for World 3:

- **card_03_whelpiest**: Attack 10 → **14**, HP 7 → **10** (stronger)
- **card_06_slimest**: Attack 7 → **11**, HP 10 → **14** (stronger)
- **card_09_wispiest**: Attack 9 → **13**, HP 8 → **12** (stronger)
- **card_12_glacier**: Attack 9 → **15**, HP 12 → **18** (much stronger)
- **card_14_rootold**: Attack 20 → **24**, HP 25 → **30** (stronger)
- **card_16_coregolem**: Attack 26 → **32**, HP 22 → **28** (stronger)
- **card_17_rimescale**: Attack 30 → **38**, HP 35 → **45** (stronger)

---

## Implementation Notes

### Scaling System Implementation

The scaling should be applied in `BattleScene.ts` when initializing enemies:

```typescript
// Calculate scaling multipliers
const worldMultipliers = {
  Easy: 1.0,
  Medium: 1.5,
  Hard: 2.25,
};

const worldMultiplier = worldMultipliers[world.difficulty] || 1.0;
const stageIndex = world.stages.findIndex((s) => s.id === stageId);
const stageMultiplier = 1.0 + stageIndex * 0.25;
const isBoss = unit.tags?.includes("Boss") ?? false;
const bossMultiplier = isBoss ? 2.0 : 1.0;

// Apply scaling
const scaledAttack = Math.floor(unit.attack * worldMultiplier * stageMultiplier * bossMultiplier);
const scaledHp = Math.floor(unit.hp * worldMultiplier * stageMultiplier * bossMultiplier);
```

### Difficulty Curve Analysis

**World 1 Progression:**

- Stage 1: Easy tutorial (3-3 stats)
- Stage 2: Slight increase (4-4 stats)
- Stage 3: Introduction of lieutenants (5-5, 8-12)
- Stage 4: Boss fight (28-53 boss)

**World 2 Progression:**

- Stage 1: Noticeable jump (6-3 stats, but low HP)
- Stage 2: More enemies, higher stats (8-4)
- Stage 3: Multiple enemies (9-5)
- Stage 4: Boss fight (53-63 boss)

**World 3 Progression:**

- Stage 1: Significant difficulty spike (5-9 stats)
- Stage 2: Harder (6-11)
- Stage 3: Lieutenants appear (7-14, 14-20)
- Stage 4: Very hard (8-16, 16-24)
- Stage 5: Extreme boss fight (270-1800 boss)

---

## Rogue-like Considerations

### Why This Scaling Works for Rogue-likes

1. **Meaningful Progression**: Each stage feels like a real step up
2. **Resource Management**: Players must carefully manage cards/items
3. **Risk/Reward**: Later stages offer better loot but are much harder
4. **Permadeath Ready**: If permadeath is added, the difficulty curve supports it
5. **Strategic Depth**: Forces players to optimize loadouts and strategies

### Additional Hardening Suggestions

1. **Reduce healing availability**: Make healing potions rarer
2. **Increase enemy variety**: Add more enemy types with unique mechanics
3. **Elite enemies**: Add 1.5x scaled versions of regular enemies as "elites"
4. **Time pressure**: Consider adding turn limits or enemy scaling over time
5. **Boss mechanics**: Add unique boss abilities that require specific strategies

---

## Testing Recommendations

1. **Playtest each world** with starter cards to ensure they're challenging but not impossible
2. **Verify boss fights** require multiple attempts with optimal play
3. **Check stage transitions** feel smooth, not jarring
4. **Balance around** players having 2-3 rank 2 cards by World 2, 2-3 rank 3 cards by World 3
5. **Monitor player feedback** on difficulty spikes

---

## Future Scaling Considerations

If more worlds are added:

- **World 4**: 3.0x base multiplier
- **World 5**: 4.0x base multiplier
- Consider **prestige/NG+** system with exponential scaling

For infinite scaling (endless mode):

- Use formula: `base * (1.15 ^ worldNumber) * (1.0 + stageIndex * 0.2)`
- Cap at reasonable maximums to prevent overflow
