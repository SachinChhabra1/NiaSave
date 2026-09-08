// This mode is used only by the separately packaged, password-protected showcase.
// It never relaxes COMMERCE_PREVIEW on the member deployment.
let isolatedEntry = false;
export const enableShowcaseEntry = () => { isolatedEntry = true; };
export const isShowcaseEntry = () => isolatedEntry;
export function showcaseReady(env = {...process.env,NIA_SHOWCASE_ENTRY:isolatedEntry?'isolated-v1':''}) {
  return env.NIA_SHOWCASE === '1' && env.NIA_SHOWCASE_ENTRY === 'isolated-v1'
    && (env.VERCEL_ENV !== 'production' || (env.SHOWCASE_ALLOW_CUSTOM_DOMAIN === '1' && /^prj_[a-zA-Z0-9]+$/.test(env.SHOWCASE_PROJECT_ID || '') && env.VERCEL_PROJECT_ID === env.SHOWCASE_PROJECT_ID))
    && /^showcase-[a-z0-9-]{8,64}$/.test(env.SHOWCASE_INSTANCE || '')
    && /^postgres(?:ql)?:\/\//.test(env.SHOWCASE_DATABASE_URL || '')
    && (env.SHOWCASE_PASSWORD || '').length >= 24
    && (env.SHOWCASE_CENTRAL_KEY || '').length >= 32;
}
