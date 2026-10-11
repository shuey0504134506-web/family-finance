import { LOGO_SIZE, MAX_LOGO_CHARS, isLogoData } from '../domain/logo';

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });

/** מקטין תמונה שנבחרה ללוגו קטן (עד 256x256, באותו יחס) ומחזיר data URL. זורק שגיאה אם אינה תמונה תקינה. */
export async function fileToLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('type');
  const img = await loadImage(file);
  const scale = Math.min(1, LOGO_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, w, h);
  // שומרים שקיפות כשאפשר (webp או png). אם הקובץ גדול מדי: jpeg על רקע לבן.
  for (const [type, quality] of [['image/webp', 0.85], ['image/png', undefined]] as const) {
    const data = canvas.toDataURL(type, quality);
    if (data.startsWith(`data:${type}`) && data.length <= MAX_LOGO_CHARS && isLogoData(data)) return data;
  }
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const jpeg = canvas.toDataURL('image/jpeg', 0.8);
  if (isLogoData(jpeg)) return jpeg;
  throw new Error('size');
}
