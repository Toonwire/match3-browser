# Game Balancing Documentation

This directory contains comprehensive balancing documentation for the match-3 rogue-like game.

## Documents

### [stat_scaling.md](./stat_scaling.md)

Complete guide to the stat scaling system, including:

- Scaling formulas and multipliers
- Detailed stat tables for all worlds and stages
- Card stat recommendations
- Design philosophy and rogue-like considerations

### [stat_values_reference.md](./stat_values_reference.md)

Quick reference implementation guide with:

- Exact stat values for all enemies across all stages
- Card stat adjustment recommendations
- Code implementation example
- Testing checklist

## Quick Summary

### Enemy Scaling System

- **World Difficulty Multipliers**: Easy (1.0x), Medium (1.5x), Hard (2.25x)
- **Stage Multiplier**: `1.0 + (stageIndex * 0.25)` - exponential progression
- **Boss Multiplier**: 2.0x on top of other multipliers
- **Result**: Enemies scale from 3-3 stats (World 1 Stage 1) to 270-1800 stats (World 3 Stage 5 Boss)

### Card Balancing

- **Rank 1**: Slightly buffed (3-5 attack, 3-5 HP) - viable for World 1
- **Rank 2**: Moderately buffed (6-14 attack, 6-12 HP) - necessary for World 2
- **Rank 3**: Significantly buffed (11-38 attack, 10-45 HP) - required for World 3

### Key Features

- **Exponential difficulty curve** - each stage feels meaningfully harder
- **Boss fights are true challenges** - 2x multiplier makes them memorable
- **World transitions are significant** - clear difficulty jumps between worlds
- **Rogue-like ready** - supports permadeath and resource management

## Implementation Priority

1. **High Priority**: Implement enemy stat scaling in `BattleScene.ts`
2. **High Priority**: Update card stats in `cards.yaml` per recommendations
3. **Medium Priority**: Test difficulty curve with playtesting
4. **Low Priority**: Add elite enemy variants (1.5x regular enemies)

## Next Steps

1. Review the stat scaling formulas
2. Implement the scaling system in code
3. Update card stats in `cards.yaml`
4. Playtest each world/stage combination
5. Adjust based on player feedback

---

**Note**: These values are tuned for a **harder, rogue-like experience**. If the game feels too difficult, consider:

- Reducing world multipliers by 10-20%
- Reducing stage multiplier increment (0.25 → 0.20)
- Increasing card stats further
- Adding more healing opportunities
