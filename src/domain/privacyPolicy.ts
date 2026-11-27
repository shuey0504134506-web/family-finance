export const PRIVACY_POLICY_VERSION = 1;
export const PRIVACY_CONSENT_REQUIRED = 'יש לאשר את מדיניות הפרטיות כדי להמשיך.';

export function assertPrivacyAccepted(input: { privacyAccepted: boolean }): void {
  if (input.privacyAccepted !== true) throw new Error(PRIVACY_CONSENT_REQUIRED);
}
