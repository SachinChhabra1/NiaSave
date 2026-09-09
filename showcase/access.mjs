import { createHash, timingSafeEqual } from 'node:crypto';
export function showcaseAccess(authorization, password = process.env.SHOWCASE_PASSWORD) {
  if (typeof password !== 'string' || password.length < 24 || typeof authorization !== 'string' || !authorization.startsWith('Basic ')) return false;
  const provided = Buffer.from(authorization.slice(6), 'base64').toString();
  const digest = v => createHash('sha256').update(v).digest();
  return timingSafeEqual(digest(provided), digest('showcase:' + password));
}
