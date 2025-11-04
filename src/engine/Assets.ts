export class Assets {
  private imageCache = new Map<string, HTMLImageElement>();

  async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) return this.imageCache.get(src)!;
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => new Promise((res) => (img.onload = () => res(undefined))));
    this.imageCache.set(src, img);
    return img;
  }

  async fetchText(path: string): Promise<string> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch: ${path}`);
    return await res.text();
  }
}


