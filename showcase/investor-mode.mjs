// Only the separately assembled entry can activate this flag.
import { isShowcaseEntry } from '../lib/commerce/showcase-mode.mjs';
export function investorDemo(env = process.env) {
  return isShowcaseEntry() && env.NIA_SHOWCASE === '1' && env.NIASAVE_INVESTOR_DEMO === '1';
}
export const demoHeaders = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self' https://www.nia.one https://nia.one https://*.vercel.app",
  'x-content-type-options': 'nosniff',
};
