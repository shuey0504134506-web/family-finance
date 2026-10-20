/** בחירת קובץ ההתקנה העדכני (תוכנת חלונות או APK) מרשימת הגרסאות ב-GitHub. */
export const RELEASES_PAGE = 'https://github.com/shuey0504134506-web/family-finance/releases';
export const RELEASES_API = 'https://api.github.com/repos/shuey0504134506-web/family-finance/releases?per_page=100';

export interface ReleaseAsset { name: string; browser_download_url: string }
export interface ReleaseInfo { tag_name: string; draft?: boolean; prerelease?: boolean; assets?: ReleaseAsset[] }

/** "desktop-v1.0.13" -> [1, 0, 13]. תג בלי מספרי גרסה מקבל [0]. */
function versionOf(tag: string): number[] {
  const m = /(\d+(?:\.\d+)*)\s*$/.exec(tag);
  return m ? m[1].split('.').map(Number) : [0];
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * הקובץ מהגרסה הגבוהה ביותר, לא מהראשונה ברשימה (GitHub ממיין לפי תאריך יצירה,
 * ולכן גרסה ישנה יכולה להופיע לפני גרסה חדשה).
 */
export function latestRelease(releases: ReleaseInfo[], kind: 'windows' | 'android'): { version: string; url: string } | null {
  const ext = kind === 'windows' ? '.exe' : '.apk';
  const prefix = kind === 'windows' ? 'desktop' : 'android';
  let best: { v: number[]; url: string; version: string } | null = null;
  for (const r of releases) {
    if (r.draft || r.prerelease) continue;
    if (!r.tag_name.toLowerCase().startsWith(prefix)) continue;
    const asset = (r.assets ?? []).find((a) => a.name.toLowerCase().endsWith(ext) && !/portable/i.test(a.name));
    if (!asset) continue;
    const v = versionOf(r.tag_name);
    if (!best || compareVersions(v, best.v) > 0) best = { v, url: asset.browser_download_url, version: v.join('.') };
  }
  return best ? { version: best.version, url: best.url } : null;
}

export function pickInstaller(releases: ReleaseInfo[], kind: 'windows' | 'android'): string | null {
  return latestRelease(releases, kind)?.url ?? null;
}

/** האם a חדשה מ-b. גרסאות כמו "1.0.19" או "desktop-v1.0.19"; גרסה לא מובנת נחשבת ישנה. */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = versionOf(a);
  const pb = versionOf(b);
  if (pa[0] === 0 && pa.length === 1) return false;
  return compareVersions(pa, pb) > 0;
}
