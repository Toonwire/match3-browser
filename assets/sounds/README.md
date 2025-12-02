# Sound Effects Directory

Place all sound effect files in this directory.

## Supported Formats
- `.mp3` (recommended - best browser compatibility)
- `.wav`
- `.ogg`

## File Naming Convention

Use descriptive names:
- `match_pop.mp3` - Match found sound
- `combo_2.mp3` - 2 combo sound
- `combo_3.mp3` - 3 combo sound
- `damage_dealt.mp3` - Damage sound
- `healing.mp3` - Healing sound
- `victory.mp3` - Victory sound
- `defeat.mp3` - Defeat sound

## Usage

See `docs/design/audio_guide.md` for detailed usage instructions.

## Example

```typescript
import { AudioManager } from "../../engine/AudioManager";

// Play a sound
AudioManager.playSound("match_pop.mp3");

// Play with custom volume
AudioManager.playSound("combo_3.mp3", { volume: 0.8 });
```

