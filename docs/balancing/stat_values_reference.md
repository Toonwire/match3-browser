# Stat Values Reference - Quick Implementation Guide

This document provides exact stat values for all enemies across all stages, ready for implementation.

## World 1: Green (Easy) - Base Multiplier: 1.0x

### Stage 1: Tree Tops
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_wisp | 3 | 3 | **3** | **3** |

### Stage 2: Canopy Layer
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_wisp | 3 | 3 | **4** | **4** |

### Stage 3: Forest Floor
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_wisp | 3 | 3 | **5** | **5** |
| unit_wisp_lieutenant | 5 | 8 | **8** | **12** |

### Stage 4: Root System (Boss)
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_wisp | 3 | 3 | **5** | **5** |
| unit_wisp_lieutenant | 5 | 8 | **9** | **14** |
| unit_wisp_boss | 8 | 15 | **28** | **53** |

---

## World 2: Red (Medium) - Base Multiplier: 1.5x

### Stage 1: Ashfall Peaks
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_whelp | 4 | 2 | **6** | **3** |

### Stage 2: Magma Flow Canyons
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_whelp | 4 | 2 | **8** | **4** |

### Stage 3: Inferno Basin
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_whelp | 4 | 2 | **9** | **5** |

### Stage 4: Sacred Furnace (Boss)
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_whelp_boss | 10 | 12 | **53** | **63** |

---

## World 3: Blue (Hard) - Base Multiplier: 2.25x

### Stage 1: Frozen Wastes
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_slime | 2 | 4 | **5** | **9** |

### Stage 2: Ice Fields
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_slime | 2 | 4 | **6** | **11** |

### Stage 3: Frostbite Chasm
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_slime | 2 | 4 | **7** | **14** |
| unit_slime_lieutenant | 4 | 6 | **14** | **20** |

### Stage 4: Icy Descent
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_slime | 2 | 4 | **8** | **16** |
| unit_slime_lieutenant | 4 | 6 | **16** | **24** |

### Stage 5: Crystal Hollows (Boss)
| Unit | Base Attack | Base HP | Scaled Attack | Scaled HP |
|------|------------|---------|---------------|-----------|
| unit_slime | 2 | 4 | **9** | **18** |
| unit_slime_lieutenant | 4 | 6 | **18** | **27** |
| unit_rimescale | 30 | 200 | **270** | **1800** |

---

## Card Stat Adjustments Summary

### Rank 1 Cards
| Card ID | Current Attack | Current HP | Recommended Attack | Recommended HP |
|---------|---------------|------------|-------------------|---------------|
| card_01_whelp | 4 | 2 | **5** | **3** |
| card_04_slime | 2 | 4 | **3** | **5** |
| card_07_wisp | 3 | 3 | **4** | **4** |

### Rank 2 Cards
| Card ID | Current Attack | Current HP | Recommended Attack | Recommended HP |
|---------|---------------|------------|-------------------|---------------|
| card_02_whelpier | 6 | 4 | **8** | **6** |
| card_05_slimer | 4 | 6 | **6** | **8** |
| card_08_wispier | 5 | 5 | **7** | **7** |
| card_11_icy | 5 | 8 | **7** | **10** |
| card_13_leafmane | 9 | 9 | **11** | **11** |
| card_15_firebro | 12 | 10 | **14** | **12** |

### Rank 3 Cards
| Card ID | Current Attack | Current HP | Recommended Attack | Recommended HP |
|---------|---------------|------------|-------------------|---------------|
| card_03_whelpiest | 10 | 7 | **14** | **10** |
| card_06_slimest | 7 | 10 | **11** | **14** |
| card_09_wispiest | 9 | 8 | **13** | **12** |
| card_12_glacier | 9 | 12 | **15** | **18** |
| card_14_rootold | 20 | 25 | **24** | **30** |
| card_16_coregolem | 26 | 22 | **32** | **28** |
| card_17_rimescale | 30 | 35 | **38** | **45** |

---

## Scaling Formula (For Code Implementation)

```typescript
function calculateScaledStats(
  baseAttack: number,
  baseHp: number,
  worldDifficulty: "Easy" | "Medium" | "Hard",
  stageIndex: number,
  isBoss: boolean
): { attack: number; hp: number } {
  const worldMultipliers = {
    "Easy": 1.0,
    "Medium": 1.5,
    "Hard": 2.25
  };
  
  const worldMultiplier = worldMultipliers[worldDifficulty] || 1.0;
  const stageMultiplier = 1.0 + (stageIndex * 0.25);
  const bossMultiplier = isBoss ? 2.0 : 1.0;
  
  const attack = Math.floor(baseAttack * worldMultiplier * stageMultiplier * bossMultiplier);
  const hp = Math.floor(baseHp * worldMultiplier * stageMultiplier * bossMultiplier);
  
  return { attack, hp };
}
```

---

## Difficulty Progression Visualization

```
World 1 (Easy):
Stage 1: ████░░░░░░ (Easy)
Stage 2: █████░░░░░ (Easy+)
Stage 3: ██████░░░░ (Medium-)
Stage 4: ████████░░ (Medium) [Boss]

World 2 (Medium):
Stage 1: ███████░░░ (Medium)
Stage 2: ████████░░ (Medium+)
Stage 3: █████████░ (Hard-)
Stage 4: ██████████ (Hard) [Boss]

World 3 (Hard):
Stage 1: ██████████ (Hard)
Stage 2: ██████████ (Hard+)
Stage 3: ██████████ (Very Hard)
Stage 4: ██████████ (Very Hard+)
Stage 5: ██████████ (Extreme) [Boss]
```

---

## Key Design Decisions

1. **Exponential Stage Scaling**: Each stage is 25% harder than the previous
2. **World Difficulty Jump**: Medium is 50% harder than Easy, Hard is 50% harder than Medium
3. **Boss Multiplier**: Bosses are 2x stronger, making them true threats
4. **HP Scaling**: HP scales the same as attack, maintaining relative tankiness
5. **Card Power Curve**: Cards need to be stronger to keep up with enemy scaling

---

## Testing Checklist

- [ ] World 1 Stage 1 is beatable with starter cards
- [ ] World 1 Stage 4 boss requires multiple attempts
- [ ] World 2 Stage 1 feels like a difficulty jump
- [ ] World 2 Stage 4 boss is very challenging
- [ ] World 3 Stage 1 requires rank 2+ cards
- [ ] World 3 Stage 5 boss requires rank 3 cards and strategy
- [ ] No stage feels impossible with appropriate cards
- [ ] No stage feels trivial with appropriate cards

