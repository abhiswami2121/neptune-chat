/**
 * compute-mrr.ts
 * Calculate Monthly Recurring Revenue from payment records.
 * Used by reporting domain for morning pulse and financial metrics.
 *
 * Phase 8 — Neptune Custom Functions
 */

export interface MRRResult {
  totalMrr: number;
  activeSubscriptions: number;
  avgSubscriptionValue: number;
  churnedMrr: number;
  newMrr: number;
  netNewMrr: number;
  periodStart: string;
  periodEnd: string;
}

export function computeMRR(
  activeSubscriptions: Array<{ amount: number; startDate: string; endDate?: string }>,
  periodStart: string,
  periodEnd: string
): MRRResult {
  const active = activeSubscriptions.filter(
    (s) => s.startDate <= periodEnd && (!s.endDate || s.endDate >= periodStart)
  );

  const churned = activeSubscriptions.filter(
    (s) => s.endDate && s.endDate >= periodStart && s.endDate <= periodEnd
  );

  const newSubs = activeSubscriptions.filter(
    (s) => s.startDate >= periodStart && s.startDate <= periodEnd
  );

  const totalMrr = active.reduce((sum, s) => sum + s.amount, 0);
  const churnedMrr = churned.reduce((sum, s) => sum + s.amount, 0);
  const newMrr = newSubs.reduce((sum, s) => sum + s.amount, 0);

  return {
    totalMrr: Math.round(totalMrr * 100) / 100,
    activeSubscriptions: active.length,
    avgSubscriptionValue: active.length > 0 ? Math.round((totalMrr / active.length) * 100) / 100 : 0,
    churnedMrr: Math.round(churnedMrr * 100) / 100,
    newMrr: Math.round(newMrr * 100) / 100,
    netNewMrr: Math.round((newMrr - churnedMrr) * 100) / 100,
    periodStart,
    periodEnd,
  };
}
