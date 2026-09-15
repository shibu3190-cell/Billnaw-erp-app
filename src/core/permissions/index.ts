/* ==========================================================================
   BILLNAW — ROLE-BASED UI PERMISSIONS (typed extraction, Phase 5)

   Ported from app.js's applyRoleSecurity(). app.js's own comment on the
   original is the load-bearing fact about this module, repeated here
   verbatim so it survives the move:

     NOTE: hiding these elements is a usability measure, NOT the security
     boundary. Anyone can un-hide a DOM node from devtools. The actual
     enforcement is server-side: fetch_items_for_role / fetch_sales_for_role
     return cost as NULL for cashiers, and shop_profit_summary refuses them
     outright, so there is no cost data in the page to reveal.

   Nothing in this file, or in src/services/supabase/ which it has no
   relationship to, changes that. This module decides what the UI *should*
   look like for a role; it enforces nothing.

   One real (behavior-preserving) signature change from the legacy
   function, same kind already applied to the alerts/printer extractions:
   the original read `$qa`/`$id` (window globals from dom.js) and wrote to
   `APP_STATE.isOwner` implicitly. This version takes the DOM query
   functions and a state setter as explicit parameters instead, which is
   what makes computeRoleSecurity's decision logic testable in Node
   without a real DOM — see tests/permissions-parity.js, which runs the
   *actual* legacy applyRoleSecurity() against a stub DOM and diffs its
   observable output against this module's, rather than just trusting
   that the refactor preserved behavior.

   app.js's applyRoleSecurity() remains UNCHANGED and is still what
   index.html loads and calls.
   ========================================================================== */

export interface RoleSecurityDecision {
  isOwner: boolean;
  badgeText: string;
  badgeBackground: string;
  badgeColor: string;
}

// Pure: same role string in, same decision out, no DOM involved. This is
// the part worth unit-testing directly, independent of any DOM stubbing.
export function computeRoleSecurity(role: string): RoleSecurityDecision {
  const isOwner = role === 'Owner' || role === 'owner';
  return {
    isOwner,
    badgeText: isOwner ? '👑 Owner' : '🛒 Staff',
    badgeBackground: isOwner ? 'var(--forest-panel)' : '#eef5f1',
    badgeColor: isOwner ? 'var(--accent-gold)' : 'var(--forest-dark)',
  };
}

export interface RoleSecurityDeps {
  queryAll: (selector: string) => ArrayLike<{ style: { display: string } }>;
  getById: (id: string) => { innerText: string; style: { background: string; color: string } } | null;
  setIsOwner: (isOwner: boolean) => void;
}

export function applyRoleSecurity(role: string, deps: RoleSecurityDeps): RoleSecurityDecision {
  const decision = computeRoleSecurity(role);
  deps.setIsOwner(decision.isOwner);

  Array.prototype.forEach.call(deps.queryAll('.admin-only'), (el: { style: { display: string } }) => {
    el.style.display = decision.isOwner ? '' : 'none';
  });
  Array.prototype.forEach.call(deps.queryAll('.cost-sensitive'), (el: { style: { display: string } }) => {
    el.style.display = decision.isOwner ? '' : 'none';
  });

  const badge = deps.getById('roleBadge');
  if (badge) {
    badge.innerText = decision.badgeText;
    badge.style.background = decision.badgeBackground;
    badge.style.color = decision.badgeColor;
  }

  return decision;
}
