/**
 * Analytics and KPI utilities for the ShelfAwareness mobile app.
 * Logic aligned with backend implementation.
 */

const round = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Calculates the defect rate as a percentage.
 */
export const calculateDefectRate = (totalPos: number, totalDiscrepancies: number): number => {
  if (totalPos <= 0) return 0;
  return round((totalDiscrepancies / totalPos) * 100);
};

/**
 * Calculates the reliability score based on on-time delivery and defect rate.
 * Weight: 70% On-Time Delivery, 30% Defect-Free Rate (100 - defectRate)
 */
export const calculateReliabilityScore = (onTimeDeliveryPct: number, defectRate: number): number => {
  const score = onTimeDeliveryPct * 0.7 + (100 - defectRate) * 0.3;
  return round(clamp(score, 0, 100));
};

/**
 * Determines the risk level based on performance metrics.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

export const getRiskLevel = (
  reliabilityScore: number,
  onTimeDeliveryPct: number,
  defectRate: number
): { level: RiskLevel; summary: string } => {
  if (
    reliabilityScore >= 85 &&
    onTimeDeliveryPct >= 95 &&
    defectRate <= 5
  ) {
    return {
      level: 'low',
      summary: 'Supplier looks healthy',
    };
  }

  if (
    reliabilityScore >= 70 &&
    onTimeDeliveryPct >= 85 &&
    defectRate <= 10
  ) {
    return {
      level: 'medium',
      summary: 'Monitor supplier performance',
    };
  }

  return {
    level: 'high',
    summary: 'Warning: High Risk',
  };
};
