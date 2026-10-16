/**
 * בתוכנה (Electron) לחיצה על שדה בחירת קובץ פותחת חלון בחירה מובנה של המערכת, דרך התהליך הראשי,
 * במקום חלון הדפדפן שבחלק מהמחשבים אינו נפתח. הקבצים שנבחרו נכנסים לשדה כאילו נבחרו רגיל,
 * ולכן כל מסך באפליקציה (ייבוא, שחזור מגיבוי, צירוף תמונה, לוגו) ממשיך לעבוד בלי שינוי.
 */
const TYPES: Record<string, string> = {
  csv: 'text/csv', txt: 'text/plain', json: 'application/json', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', xls: 'application/vnd.ms-excel', htm: 'text/html', html: 'text/html',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function installNativeFilePicker(): void {
  const native = window.desktopFiles;
  if (!native) return;
  let busy = false;
  document.addEventListener(
    'click',
    (e) => {
      const input = e.target instanceof HTMLInputElement && e.target.type === 'file' ? e.target : null;
      if (!input) return;
      e.preventDefault();
      if (busy) return;
      busy = true;
      void native
        .pick(input.accept, input.multiple)
        .then((picked) => {
          if (picked.length === 0) return;
          const dt = new DataTransfer();
          for (const p of picked) {
            const ext = p.name.split('.').pop()?.toLowerCase() ?? '';
            dt.items.add(new File([p.data], p.name, { type: TYPES[ext] ?? '' }));
          }
          input.files = dt.files;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        })
        .catch(() => undefined)
        .finally(() => { busy = false; });
    },
    true,
  );
}
