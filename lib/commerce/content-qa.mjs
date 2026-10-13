export const MEMBER_LANGUAGES = ['en','hi','ta','bn'];
export const MIN_VIEWPORT_PX = 320;
export const SENSITIVE_LOG = /bearer\s+[a-z0-9._\-]+|niaOpsToken|STAFF_TOKEN|password|otp|\+91[6-9]\d{9}|[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}|(?:^|[\s=])(?:sk|tok|staff|key)_[a-z0-9._\-]{8,}/i;

export function fallbackCopy(lang, english, dictionaries={}) {
  if (!english) return '';
  if (!lang || lang === 'en' || !MEMBER_LANGUAGES.includes(lang)) return english;
  const hit = dictionaries[lang]?.[english];
  return (typeof hit === 'string' && hit.trim()) ? hit : english;
}

export function journeyA11y(root={}) {
  const issues = [];
  if ((root.minWidth || 0) > 0 && root.minWidth < MIN_VIEWPORT_PX) issues.push('viewport');
  if (root.keyboard === false) issues.push('keyboard');
  const controls = root.controls || [];
  for (const c of controls) {
    if (!c.label && !c.ariaLabel && !c.text) issues.push('label:'+(c.action||'unknown'));
    if (c.iconOnly && !c.visibleLabel) issues.push('visible-label:'+(c.action||'unknown'));
    if (c.focusable === false && c.action) issues.push('focus:'+c.action);
  }
  return {ok: issues.length === 0, issues};
}

export function redactClientLog(value) {
  if (value == null) return value;
  if (typeof value === 'string') return SENSITIVE_LOG.test(value) ? '[redacted]' : value;
  if (Array.isArray(value)) return value.map(redactClientLog);
  if (typeof value === 'object') {
    const out = {};
    for (const [k,v] of Object.entries(value)) {
      if (/token|bearer|password|otp|phone|email|authorization|niaOpsToken|staffToken|credential|secret|session|cookie|api.?key|aadhaar|upi|account|member.?id|subject/i.test(k)) out[k] = '[redacted]';
      else out[k] = redactClientLog(v);
    }
    return out;
  }
  return value;
}
