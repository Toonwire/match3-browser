# Sound Effect Resources & Recommendations

## Free Sound Libraries (Recommended)

### 1. **Freesound.org** ⭐ Best Overall
- **URL**: https://freesound.org
- **Pros**: 
  - Huge library (500k+ sounds)
  - Creative Commons licenses
  - Good search and filtering
  - High quality sounds
- **Cons**: Requires account (free)
- **License**: Various CC licenses (check each file)
- **Best for**: All types of sound effects

### 2. **OpenGameArt.org**
- **URL**: https://opengameart.org
- **Pros**: 
  - Game-focused content
  - Clear licensing
  - Good for game-specific sounds
- **License**: Various (CC0, CC-BY, etc.)
- **Best for**: Game-specific sound effects

### 3. **Zapsplat** ⭐ Great Quality
- **URL**: https://www.zapsplat.com
- **Pros**: 
  - Professional quality
  - Well-organized categories
  - Free with account
- **Cons**: Requires free account, attribution needed
- **License**: Free with attribution
- **Best for**: High-quality sound effects

### 4. **Kenney.nl** ⭐ Game Assets
- **URL**: https://kenney.nl/assets
- **Pros**: 
  - Game asset packs
  - CC0 (no attribution needed)
  - Consistent style
- **License**: CC0 (public domain)
- **Best for**: Complete sound packs

### 5. **Mixkit**
- **URL**: https://mixkit.co/free-sound-effects/
- **Pros**: 
  - Free, no attribution needed
  - Good selection
  - Easy to browse
- **License**: Free for commercial use
- **Best for**: Quick, no-hassle downloads

### 6. **Pixabay**
- **URL**: https://pixabay.com/sound-effects/
- **Pros**: 
  - Free for commercial use
  - Large library
  - No attribution required
- **License**: Pixabay License (free)
- **Best for**: Commercial projects

## Sound Creation Tools

### 1. **Audacity** ⭐ Free & Powerful
- **URL**: https://www.audacityteam.org
- **Type**: Audio editor
- **Pros**: 
  - Completely free
  - Powerful editing
  - Cross-platform
  - Can generate tones, apply effects
- **Best for**: Editing and processing sounds

### 2. **Bfxr** ⭐ Procedural Sound Generator
- **URL**: https://www.bfxr.net (web version)
- **Type**: Sound generator
- **Pros**: 
  - Generate retro game sounds
  - Quick and easy
  - No download needed (web version)
- **Best for**: Retro-style game sounds (match pops, UI beeps)

### 3. **ChipTone**
- **URL**: https://sfbgames.itch.io/chiptone
- **Type**: Chiptune sound generator
- **Pros**: 
  - Retro 8-bit sounds
  - Free
  - Easy to use
- **Best for**: Pixel art / retro game sounds

### 4. **LMMS** (Linux MultiMedia Studio)
- **URL**: https://lmms.io
- **Type**: Music production
- **Pros**: 
  - Free DAW
  - Can create music and sounds
- **Best for**: Creating custom music/sounds

## Recommended Sound Packs for Match3 Games

### 1. **Kenney Game Audio**
- **URL**: https://kenney.nl/assets/game-audio
- **What**: Complete game audio pack
- **License**: CC0
- **Includes**: UI sounds, impact sounds, etc.

### 2. **Game UI Sound Pack** (various sources)
- Search for "game UI sound pack" on Freesound/OpenGameArt
- **What**: Button clicks, menu sounds, etc.

### 3. **Retro Game Sound Effects**
- Search for "retro game sounds" or "8-bit sounds"
- **What**: Classic game-style sounds

## Specific Sound Recommendations for Your Game

### Match Pop Sounds
- Search: "pop", "bubble pop", "match", "success"
- **Bfxr**: Perfect for generating match pop sounds
- **Freesound**: Search "game match" or "success sound"

### Combo Sounds
- Search: "combo", "power up", "level up", "achievement"
- **Progression**: Use ascending pitch/energy for higher combos
- **Bfxr**: Generate with increasing complexity

### Damage Sounds
- Search: "impact", "hit", "punch", "damage"
- **Freesound**: Many combat/hit sounds available
- **Tip**: Layer multiple sounds for more impact

### Healing Sounds
- Search: "heal", "magic", "sparkle", "chime"
- **Bfxr**: Generate soft, pleasant tones
- **Freesound**: Search "healing" or "magic spell"

### UI Sounds
- Search: "click", "button", "select", "menu"
- **Kenney**: Has UI sound packs
- **Bfxr**: Great for simple UI beeps

## Best Practices

### File Format
- **Use MP3** for best browser compatibility
- **Bitrate**: 128-192 kbps is usually sufficient
- **Sample Rate**: 44.1 kHz (standard)

### File Size
- Keep sounds under 100KB when possible
- Short sounds (0.1-0.5 seconds) for UI
- Longer sounds (1-3 seconds) for music/ambient

### Naming Convention
- Use descriptive names: `match_pop.mp3`, `combo_3.mp3`
- Include numbers for variations: `damage_1.mp3`, `damage_2.mp3`
- Keep names lowercase with underscores

### Sound Design Tips
1. **Match Pop**: Short, snappy (0.1-0.3s)
2. **Combo**: Build intensity with each level
3. **Damage**: Sharp attack, quick decay
4. **Healing**: Soft, pleasant, rising tone
5. **UI**: Subtle, non-intrusive

## Quick Start Workflow

1. **Start with Bfxr** (https://www.bfxr.net)
   - Generate match pop sounds
   - Export as WAV
   - Convert to MP3 (use Audacity or online converter)

2. **Get UI sounds from Kenney**
   - Download their UI pack
   - Pick sounds you like
   - Rename appropriately

3. **Get combat sounds from Freesound**
   - Search for "game hit" or "impact"
   - Filter by license (CC0 preferred)
   - Download and test in game

4. **Edit in Audacity** (if needed)
   - Trim silence
   - Normalize volume
   - Apply fade in/out
   - Export as MP3

## Licensing Checklist

When using free sounds, always check:
- ✅ License type (CC0 = no attribution, CC-BY = attribution needed)
- ✅ Commercial use allowed?
- ✅ Modification allowed?
- ✅ Attribution requirements (if any)

## Recommended Tools for This Project

**Quick Start (No Download)**:
1. Bfxr.net - Generate match/combo sounds
2. Freesound.org - Download damage/healing sounds
3. Online MP3 converter - Convert formats if needed

**Full Workflow**:
1. Audacity - Edit and process all sounds
2. Freesound.org - Source library
3. Kenney.nl - UI sound packs

## Example: Creating a Match Pop Sound

1. Go to https://www.bfxr.net
2. Click "Pickup/Coin" preset
3. Adjust sliders:
   - Increase "Pitch" slightly
   - Adjust "Decay" for length
   - Try "Change" for variation
4. Click "Export Wav"
5. Open in Audacity
6. Trim silence, normalize, export as MP3
7. Save as `match_pop.mp3` in `assets/sounds/`

