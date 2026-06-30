// Clickjacking — tricking you into clicking something you can't see. A malicious page loads the real
// target site (your bank, say) in an invisible iframe, positions its sensitive button under a decoy the
// page invites you to click ("Win a prize!"), and makes the iframe transparent. Your click lands on the
// REAL button inside the framed site — which is fully logged in via your cookies — so you "Transfer
// money" or "Delete account" without knowing. The defense is to forbid being framed by other origins:
// the legacy X-Frame-Options header (DENY / SAMEORIGIN) or the modern CSP frame-ancestors directive.
// The browser refuses to render the frame at all if the policy doesn't permit the framing origin, so the
// overlay has nothing to hijack. Reference: OWASP clickjacking; RFC 7034 (X-Frame-Options); CSP Level 2/3.

export interface FramePolicy { xfo: 'DENY' | 'SAMEORIGIN' | null; frameAncestors: string[] | null } // null = header not set
export interface FrameDecision { allowed: boolean; reason: string; clickjackable: boolean }

/** Can `framerOrigin` embed `targetOrigin` in an iframe under `policy`? frame-ancestors (if present)
 *  takes precedence over X-Frame-Options; with no protection at all, framing is allowed (and the page
 *  is clickjackable). */
export function canFrame(targetOrigin: string, framerOrigin: string, policy: FramePolicy): FrameDecision {
  const sameOrigin = framerOrigin === targetOrigin;
  // modern: CSP frame-ancestors wins when set
  if (policy.frameAncestors !== null) {
    if (policy.frameAncestors.length === 0 || policy.frameAncestors.includes("'none'")) {
      return { allowed: false, reason: "frame-ancestors 'none' — no site may frame it", clickjackable: false };
    }
    const allowed = policy.frameAncestors.some((a) => (a === "'self'" ? sameOrigin : a === '*' || a === framerOrigin));
    return { allowed, reason: allowed ? `framer is in frame-ancestors` : `framer not in frame-ancestors`, clickjackable: allowed && !sameOrigin };
  }
  // legacy: X-Frame-Options
  if (policy.xfo === 'DENY') return { allowed: false, reason: 'X-Frame-Options: DENY', clickjackable: false };
  if (policy.xfo === 'SAMEORIGIN') return { allowed: sameOrigin, reason: sameOrigin ? 'same origin allowed' : 'X-Frame-Options: SAMEORIGIN blocks cross-origin', clickjackable: false };
  // no framing protection at all
  return { allowed: true, reason: 'no X-Frame-Options or frame-ancestors → any site can frame it', clickjackable: !sameOrigin };
}
