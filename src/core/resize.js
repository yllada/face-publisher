const MAX_SIDE = 1080;
const QUALITY = 0.85;
const OUTPUT_TYPE = 'image/jpeg';

export async function resizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(tw, th);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
  }
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, tw, th);
  bitmap.close?.();

  if (canvas.convertToBlob) {
    return canvas.convertToBlob({ type: OUTPUT_TYPE, quality: QUALITY });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      OUTPUT_TYPE,
      QUALITY
    );
  });
}
