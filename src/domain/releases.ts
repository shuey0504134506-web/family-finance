/** בחירת קובץ ההתקנה העדכני (תוכנת חלונות או APK) מרשימת הגרסאות ב-GitHub. */
export const RELEASES_PAGE = 'https://github.com/shuey0504134506-web/family-finance/releases';
export const RELEASES_API = 'https://api.github.com/repos/shuey0504134506-web/family-finance/releases?per_page=30';

export interface ReleaseAsset { name: string; browser_download_url: string }
export interface ReleaseInfo { tag_name: string; draft?: boolean; prerelease?: boolean; assets?: ReleaseAsset[] }

export function pickInstaller(releases: ReleaseInfo[], kind: 'windows' | 'android'): string | null {
  const ext = kind === 'windows' ? '.exe' : '.apk';
  for (const r of releases) {
    if (r.draft) continue;
    const asset = (r.assets ?? []).find((a) => a.name.toLowerCase().endsWith(ext));
    if (asset) return asset.browser_download_url;
  }
  return null;
}
