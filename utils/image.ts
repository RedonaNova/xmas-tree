import { COLORS, MAX_PHOTO_SIZE } from '../constants';

/**
 * Makes an image square (1:1) for the Polaroid: the image spans the full width,
 * landscape images get padding above/below, portrait images are cropped top/bottom.
 * Large images are scaled down to MAX_PHOTO_SIZE.
 *
 * @param url The source URL of the image (data URL, object URL or same-origin URL).
 * @param paddingColor The color to use for the padding (defaults to Polaroid frame color).
 * @returns A Promise that resolves to a data URL of the processed image.
 */
export const processImageWithPadding = (url: string, paddingColor: string = COLORS.POLAROID_FRAME): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { width, height } = img;

      // Already square and small enough: use as-is
      if (width === height && width <= MAX_PHOTO_SIZE) {
        resolve(url);
        return;
      }

      const scale = Math.min(1, MAX_PHOTO_SIZE / width);
      const size = Math.round(width * scale);
      const drawHeight = height * scale;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(url);
        return;
      }

      // Fill background with padding color (exactly the same as Polaroid frame)
      ctx.fillStyle = paddingColor;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, (size - drawHeight) / 2, size, drawHeight);

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      console.error("Failed to load image for padding processing:", url);
      // Fallback to original URL if processing fails
      resolve(url);
    };
    img.src = url;
  });
};
