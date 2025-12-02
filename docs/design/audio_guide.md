# Audio Guide

## Where to Put Sound Files

Place all sound effect files in the `assets/sounds/` directory:

```
assets/
  sounds/
    match_pop.mp3
    combo_2.mp3
    combo_3.mp3
    combo_4.mp3
    damage_dealt.mp3
    healing.mp3
    victory.mp3
    defeat.mp3
    ...
```

### Supported Formats
- `.mp3` (recommended for browser compatibility)
- `.wav`
- `.ogg`

## How to Play Sound Files

### Basic Usage

```typescript
import { AudioManager } from "../../engine/AudioManager";

// Play a sound with default settings
AudioManager.playSound("match_pop.mp3");

// Play a sound with custom volume
AudioManager.playSound("combo_3.mp3", { volume: 0.8 });

// Play a looping sound (e.g., background music)
AudioManager.playSound("battle_music.mp3", { loop: true, volume: 0.5 });
```

### Example: Adding Sounds to Battle Scene

```typescript
// In BattleScene.ts

import { AudioManager } from "../../engine/AudioManager";

// When a match is found
private startCurrentMatchAnimation() {
  // ... existing code ...
  
  // Play match pop sound
  AudioManager.playSound("match_pop.mp3", { volume: 0.7 });
  
  // Play combo sound if combo count > 1
  if (comboCount > 1) {
    const comboSound = comboCount >= 5 ? "combo_5.mp3" 
                     : comboCount >= 3 ? "combo_3.mp3" 
                     : "combo_2.mp3";
    AudioManager.playSound(comboSound, { volume: 0.8 });
  }
}

// When damage is dealt
private applyDamageToEnemiesWithLogging(...) {
  // ... existing code ...
  
  AudioManager.playSound("damage_dealt.mp3", { volume: 0.6 });
}

// When healing occurs
private applyHealingToPlayerUnitsWithLogging(...) {
  // ... existing code ...
  
  AudioManager.playSound("healing.mp3", { volume: 0.5 });
}

// On victory
if (this.isVictorious && !this.victoryTriggered) {
  AudioManager.playSound("victory.mp3", { volume: 0.8 });
}

// On defeat
if (this.isDefeated && !this.defeatTriggered) {
  AudioManager.playSound("defeat.mp3", { volume: 0.8 });
}
```

### Preloading Sounds (Optional)

For better performance, preload sounds during scene initialization:

```typescript
async init(): Promise<void> {
  // Preload commonly used sounds
  await AudioManager.preloadSounds([
    "match_pop.mp3",
    "combo_2.mp3",
    "combo_3.mp3",
    "damage_dealt.mp3",
    "healing.mp3",
  ]);
}
```

### Volume Control

```typescript
// Set master volume (affects all sounds)
AudioManager.setMasterVolume(0.5); // 50% volume

// Get current master volume
const currentVolume = AudioManager.getMasterVolume();
```

### Advanced: Stopping Sounds

```typescript
// Stop all sounds
AudioManager.stopAllSounds();

// Clear cache (useful when switching scenes)
AudioManager.clearCache();
```

## Recommended Sound Events

Here are some suggested sound effects to add:

### Match3 Grid
- `match_pop.mp3` - When a match is found
- `combo_2.mp3` - 2 combos
- `combo_3.mp3` - 3 combos
- `combo_4.mp3` - 4 combos
- `combo_5.mp3` - 5+ combos
- `cascade.mp3` - When cascading matches occur

### Combat
- `damage_dealt.mp3` - When damage is dealt
- `damage_taken.mp3` - When player takes damage
- `healing.mp3` - When healing occurs
- `critical_hit.mp3` - For critical/elemental advantage hits

### UI
- `button_click.mp3` - Button clicks
- `card_select.mp3` - Card selection
- `panel_open.mp3` - Panel/menu opens

### Battle Events
- `victory.mp3` - Battle victory
- `defeat.mp3` - Battle defeat
- `turn_switch.mp3` - Turn switches
- `enemy_attack.mp3` - Enemy attacks

## Browser Compatibility Notes

- Some browsers (especially mobile) require user interaction before playing audio
- The AudioManager handles this gracefully by catching errors
- Consider adding a "Click to enable sound" button on first load if needed
- MP3 format has the best browser support

