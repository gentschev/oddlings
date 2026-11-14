import type Phaser from 'phaser';

/** Smallest power of two that is not below `n`. */
export function powerOfTwoAtLeast(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** Frame name of the art inside its padded texture. It becomes the texture's default frame. */
export const ART_FRAME = 'art';

/**
 * Replaces a loaded image with a copy padded to power-of-two sides, so the renderer builds
 * mipmaps for it. Without them a 640 px pal drawn 60 px wide on the map samples a few
 * texels out of each 10 x 10 block and its outline breaks up and shimmers as it moves.
 * The art sits in the top-left corner under one frame of its own size, so display
 * sizes, origins and manifest coordinates stay as they were.
 */
export function padForMipmaps(textures: Phaser.Textures.TextureManager, rawKey: string, key: string): void {
  const image = textures.get(rawKey).getSourceImage() as HTMLImageElement;
  const { width, height } = image;
  const canvas = document.createElement('canvas');
  canvas.width = powerOfTwoAtLeast(width); canvas.height = powerOfTwoAtLeast(height);
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  textures.addCanvas(key, canvas)!.add(ART_FRAME, 0, 0, 0, width, height);
  textures.remove(rawKey);
}
