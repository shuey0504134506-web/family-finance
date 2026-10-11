import { MAX_ATTACHMENT_CHARS, MAX_ATTACHMENT_DIM, isAttachmentImage } from '../domain/attachment';

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

/** מקטין צילום של קבלה או תלוש ל-JPEG קטן (עד 1400 פיקסלים בצלע הארוכה), עד שהוא נכנס במגבלה. */
export async function fileToAttachment(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('type');
  const img = await loadImage(file);
  let dim = MAX_ATTACHMENT_DIM;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const scale = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = canvas.toDataURL('image/jpeg', attempt === 0 ? 0.78 : 0.65);
    if (data.length <= MAX_ATTACHMENT_CHARS && isAttachmentImage(data)) return data;
    dim = Math.round(dim * 0.8);
  }
  throw new Error('size');
}
