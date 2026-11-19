/** Phone photos are often 4 to 12 MB. Shrinking them in the browser keeps uploads quick on mobile data and the page light for buyers. */
const MAX_SIDE = 1600;
export const MAX_PHOTOS = 8;

export async function shrinkImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name || 'That file'} is not a JPG, PNG or WebP photo.`);
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error(`${file.name || 'That photo'} could not be read.`);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not prepare that photo.');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white rather than black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Your browser could not prepare that photo.');
  return blob;
}
