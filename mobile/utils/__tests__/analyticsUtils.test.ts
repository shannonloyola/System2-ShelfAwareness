import { calculateDefectRate, calculateReliabilityScore, getRiskLevel } from '../analyticsUtils';

describe('analyticsUtils', () => {
  describe('calculateDefectRate', () => {
    it('should calculate correct percentage', () => {
      expect(calculateDefectRate(100, 5)).toBe(5);
      expect(calculateDefectRate(200, 10)).toBe(5);
    });

    it('should handle zero POs', () => {
      expect(calculateDefectRate(0, 5)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(calculateDefectRate(3, 1)).toBe(33.33);
    });
  });

  describe('calculateReliabilityScore', () => {
    it('should calculate weighted score correctly', () => {
      // 100 on time, 0 defect -> 100*0.7 + 100*0.3 = 100
      expect(calculateReliabilityScore(100, 0)).toBe(100);
      
      // 50 on time, 0 defect -> 50*0.7 + 100*0.3 = 35 + 30 = 65
      expect(calculateReliabilityScore(50, 0)).toBe(65);
    });

    it('should clamp between 0 and 100', () => {
      expect(calculateReliabilityScore(120, -10)).toBe(100);
      expect(calculateReliabilityScore(-10, 110)).toBe(0);
    });
  });

  describe('getRiskLevel', () => {
    it('should return low risk for good stats', () => {
      const result = getRiskLevel(90, 96, 2);
      expect(result.level).toBe('low');
    });

    it('should return medium risk for average stats', () => {
      const result = getRiskLevel(75, 86, 8);
      expect(result.level).toBe('medium');
    });

    it('should return high risk for poor stats', () => {
      const result = getRiskLevel(50, 60, 20);
      expect(result.level).toBe('high');
    });
  });
});
