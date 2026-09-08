// This mode is used only by the separately packaged, password-protected showcase.
// It never relaxes COMMERCE_PREVIEW on the member deployment.
export function showcaseReady(env = process.env) {
  return env.NIA_SHOWCASE === '1' && env.NIA_SHOWCASE_ENTRY === 'isolated-v1'
    && env.VERCEL_ENV !== 'production'
    && /^showcase-[a-z0-9-]{8,64}$/.test(env.SHOWCASE_INSTANCE || '')
    && /^postgres(?:ql)?:\/\//.test(env.SHOWCASE_DATABASE_URL || '')
    && (env.SHOWCASE_PASSWORD || '').length >= 24
    && (env.SHOWCASE_CENTRAL_KEY || '').length >= 32;
}
