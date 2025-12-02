/**
 * AudioManager - Handles loading and playing sound effects
 * 
 * Sound files should be placed in: assets/sounds/
 * Supported formats: .mp3, .wav, .ogg
 * 
 * Usage:
 *   AudioManager.playSound("match_pop.mp3");
 *   AudioManager.playSound("combo_3.mp3", { volume: 0.8 });
 */

type SoundOptions = {
  volume?: number; // 0.0 to 1.0, defaults to 1.0
  loop?: boolean; // Whether to loop the sound, defaults to false
};

export class AudioManager {
  private static soundCache = new Map<string, HTMLAudioElement>();
  private static masterVolume = 1.0; // Global volume control (0.0 to 1.0)

  /**
   * Sets the master volume for all sounds
   * @param volume - Volume from 0.0 (mute) to 1.0 (max)
   */
  static setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Gets the current master volume
   */
  static getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Preloads a sound file (optional, sounds are loaded on first play)
   * @param soundPath - Path to sound file relative to assets/sounds/
   */
  static async preloadSound(soundPath: string): Promise<void> {
    const fullPath = `/assets/sounds/${soundPath}`;
    if (this.soundCache.has(fullPath)) {
      return; // Already loaded
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(fullPath);
      audio.addEventListener("canplaythrough", () => {
        this.soundCache.set(fullPath, audio);
        resolve();
      });
      audio.addEventListener("error", (e) => {
        console.warn(`Failed to load sound: ${soundPath}`, e);
        reject(e);
      });
      // Start loading
      audio.load();
    });
  }

  /**
   * Preloads multiple sound files
   * @param soundPaths - Array of paths to sound files
   */
  static async preloadSounds(soundPaths: string[]): Promise<void> {
    await Promise.all(soundPaths.map((path) => this.preloadSound(path).catch(() => {})));
  }

  /**
   * Plays a sound effect
   * @param soundPath - Path to sound file relative to assets/sounds/
   * @param options - Optional volume and loop settings
   * @returns The Audio element (can be used to stop/pause if needed)
   */
  static playSound(soundPath: string, options: SoundOptions = {}): HTMLAudioElement | null {
    const fullPath = `/assets/sounds/${soundPath}`;
    let audio = this.soundCache.get(fullPath);

    // If not cached, create new audio element
    if (!audio) {
      audio = new Audio(fullPath);
      this.soundCache.set(fullPath, audio);
    } else {
      // Clone the audio element to allow overlapping sounds
      audio = audio.cloneNode() as HTMLAudioElement;
    }

    // Apply options
    const volume = (options.volume ?? 1.0) * this.masterVolume;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = options.loop ?? false;

    // Play the sound
    audio.play().catch((error) => {
      // Some browsers require user interaction before playing audio
      console.warn(`Failed to play sound: ${soundPath}`, error);
    });

    return audio;
  }

  /**
   * Stops all currently playing sounds
   */
  static stopAllSounds(): void {
    for (const audio of this.soundCache.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Clears the sound cache (useful for memory management)
   */
  static clearCache(): void {
    this.stopAllSounds();
    this.soundCache.clear();
  }
}

