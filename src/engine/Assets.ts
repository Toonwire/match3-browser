const red10x10png =
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAnklEQVR4AUSQARLEIAgDF///5uY22M45RiEkYHsyJFw8zBtPnplk0drkoIqBQg9pjCstCLd+jpT7q/YupOrU5SbGHf0OvgIH0mK7XPlsuKPrUC0fRbO3B1XsCyaOlh8RjzVYMa2mX4Hfs/cpaR96366eMdOIiLGZHd8g/FcLSehfaEeMTrvRFUwvylW8mXzuG+tbCj6pKgf1DSCnjh8AAAD//x3esDEAAAAGSURBVAMA5hFXBkQL0msAAAAASUVORK5CYII=";
export const IMG_URL_PLACEHOLDER = "data:image/png;base64," + red10x10png;

export class Assets {
  private imageCache = new Map<string, HTMLImageElement>();

  async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) return this.imageCache.get(src)!;
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => {
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
          img.src = IMG_URL_PLACEHOLDER;
        };
      });
    });
    this.imageCache.set(src, img);
    return img;
  }

  async fetchText(path: string): Promise<string> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch: ${path}`);
    return await res.text();
  }
}
