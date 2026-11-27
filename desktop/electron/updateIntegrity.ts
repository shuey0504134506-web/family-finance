import { isNewerVersion } from '../../src/domain/releases';

const RELEASE_ROOT = 'https://github.com/shuey0504134506-web/family-finance/releases/download/';
const API_ROOT = 'https://api.github.com/repos/shuey0504134506-web/family-finance/releases/tags/';
export const MIN_INSTALLER_BYTES = 5 * 1024 * 1024;
export const MAX_INSTALLER_BYTES = 300 * 1024 * 1024;

/** Accept only the expected asset of a newer, published release. */
export function updateRequest(url: unknown, current: string) {
  if (typeof url !== 'string' || !url.startsWith(RELEASE_ROOT)) throw new Error('bad-url');
  const match = /^desktop-v(\d+\.\d+\.\d+)\/finance-desktop-(\d+\.\d+\.\d+)-x64\.exe$/.exec(url.slice(RELEASE_ROOT.length));
  if (!match || match[1] !== match[2] || !isNewerVersion(match[1], current)) throw new Error('bad-version');
  return { url, tag: `desktop-v${match[1]}`, name: `finance-desktop-${match[1]}-x64.exe`, api: `${API_ROOT}desktop-v${match[1]}` };
}

export function installerMetadata(release: unknown, request: ReturnType<typeof updateRequest>) {
  const r = release as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown } | null;
  if (!r || r.tag_name !== request.tag || r.draft !== false || r.prerelease !== false || !Array.isArray(r.assets)) throw new Error('bad-release');
  const asset = r.assets.find(a => a && a.name === request.name && a.browser_download_url === request.url);
  if (!asset || typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || !Number.isSafeInteger(asset.size) || asset.size < MIN_INSTALLER_BYTES || asset.size > MAX_INSTALLER_BYTES) throw new Error('bad-asset');
  return { sha256: asset.digest.slice(7), size: asset.size as number };
}
