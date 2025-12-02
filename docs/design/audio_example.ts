/**
 * Example: How to add sound effects to BattleScene
 * 
 * This file shows example code snippets for adding sounds to various events.
 * Copy the relevant parts into BattleScene.ts
 */

import { AudioManager } from "../../engine/AudioManager";

// ============================================================================
// Example 1: Match Pop Sound
// ============================================================================
// Add to startCurrentMatchAnimation() method:

private startCurrentMatchAnimation() {
  // ... existing code ...
  
  // Play match pop sound
  AudioManager.playSound("match_pop.mp3", { volume: 0.7 });
  
  // Play combo sound based on combo count
  if (comboCount > 1) {
    let comboSound: string;
    if (comboCount >= 5) {
      comboSound = "combo_5.mp3";
    } else if (comboCount >= 3) {
      comboSound = "combo_3.mp3";
    } else {
      comboSound = "combo_2.mp3";
    }
    AudioManager.playSound(comboSound, { volume: 0.8 });
  }
}

// ============================================================================
// Example 2: Damage Sound
// ============================================================================
// Add to applyDamageToEnemiesWithLogging() method:

private applyDamageToEnemiesWithLogging(...) {
  // ... existing code ...
  
  // Play damage sound when damage is dealt
  if (finalDamage > 0) {
    AudioManager.playSound("damage_dealt.mp3", { volume: 0.6 });
  }
}

// ============================================================================
// Example 3: Healing Sound
// ============================================================================
// Add to applyHealingToPlayerUnitsWithLogging() method:

private applyHealingToPlayerUnitsWithLogging(...) {
  // ... existing code ...
  
  // Play healing sound
  if (actualHealing > 0) {
    AudioManager.playSound("healing.mp3", { volume: 0.5 });
  }
}

// ============================================================================
// Example 4: Victory/Defeat Sounds
// ============================================================================
// Add to checkForVictory() and checkForDefeat() methods:

private checkForVictory(): void {
  // ... existing code ...
  
  if (this.isVictorious && !this.victoryTriggered) {
    AudioManager.playSound("victory.mp3", { volume: 0.8 });
    // ... rest of code ...
  }
}

private checkForDefeat(): void {
  // ... existing code ...
  
  if (this.isDefeated && !this.defeatTriggered) {
    AudioManager.playSound("defeat.mp3", { volume: 0.8 });
    // ... rest of code ...
  }
}

// ============================================================================
// Example 5: Preload Sounds on Scene Init
// ============================================================================
// Add to init() method in BattleScene:

async init(): Promise<void> {
  // ... existing code ...
  
  // Preload commonly used sounds for better performance
  await AudioManager.preloadSounds([
    "match_pop.mp3",
    "combo_2.mp3",
    "combo_3.mp3",
    "combo_5.mp3",
    "damage_dealt.mp3",
    "healing.mp3",
    "victory.mp3",
    "defeat.mp3",
  ]);
}

// ============================================================================
// Example 6: UI Sounds (for other scenes)
// ============================================================================
// In BaseScene, WorldScene, etc.:

// Button click
if (this.pointInRect(x, y, buttonRegion)) {
  AudioManager.playSound("button_click.mp3", { volume: 0.5 });
  // ... handle click ...
}

// Card selection
onCardSelect(cardId: string) {
  AudioManager.playSound("card_select.mp3", { volume: 0.6 });
  // ... handle selection ...
}

