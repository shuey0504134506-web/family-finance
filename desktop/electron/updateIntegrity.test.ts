import { describe, expect, it } from 'vitest';
import { installerMetadata, updateRequest } from './updateIntegrity';

const url = 'https://github.com/shuey0504134506-web/family-finance/releases/download/desktop-v1.0.75/finance-desktop-1.0.75-x64.exe';
const request = updateRequest(url, '1.0.74');
const release = { tag_name: request.tag, draft: false, prerelease: false, assets: [{ name: request.name, browser_download_url: url, digest: `sha256:${'a'.repeat(64)}`, size: 110_000_000 }] };

describe('verified desktop updates', () => {
  it('validates metadata of the selected newer release', () => {
    expect(installerMetadata(release, request)).toEqual({ sha256: 'a'.repeat(64), size: 110_000_000 });
  });
  it('rejects downgrade or mismatched release version', () => {
    expect(() => updateRequest(url, '1.0.75')).toThrow();
    expect(() => updateRequest(url, '1.0.76')).toThrow();
    expect(() => updateRequest(url.replace('finance-desktop-1.0.75', 'finance-desktop-1.0.74'), '1.0.74')).toThrow();
  });
  it('requires a published release, exact asset, digest and size', () => {
    expect(() => installerMetadata({ ...release, draft: true }, request)).toThrow();
    expect(() => installerMetadata({ ...release, prerelease: true }, request)).toThrow();
    expect(() => installerMetadata({ ...release, assets: [{...release.assets[0], digest: null}] }, request)).toThrow();
    expect(() => installerMetadata({ ...release, assets: [{...release.assets[0], size: 1}] }, request)).toThrow();
  });
});
