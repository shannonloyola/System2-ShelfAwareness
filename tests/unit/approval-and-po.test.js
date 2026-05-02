import { describe, it, expect, beforeEach } from '@jest/globals';
import ApprovalThresholdService from '../../src/services/ApprovalThresholdService.js';
import PONumberGenerationService from '../../src/services/PONumberGenerationService.js';

describe('ApprovalThresholdService', () => {
  let service;

  beforeEach(() => {
    service = new ApprovalThresholdService();
  });

  describe('getApprovalLevel', () => {
    it('should return MANAGER for amount <= $5,000', () => {
      expect(service.getApprovalLevel(1000)).toBe('MANAGER');
      expect(service.getApprovalLevel(5000)).toBe('MANAGER');
    });

    it('should return DIRECTOR for amount between $5,001 and $25,000', () => {
      expect(service.getApprovalLevel(5001)).toBe('DIRECTOR');
      expect(service.getApprovalLevel(15000)).toBe('DIRECTOR');
      expect(service.getApprovalLevel(25000)).toBe('DIRECTOR');
    });

    it('should return EXECUTIVE for amount between $25,001 and $100,000', () => {
      expect(service.getApprovalLevel(25001)).toBe('EXECUTIVE');
      expect(service.getApprovalLevel(50000)).toBe('EXECUTIVE');
      expect(service.getApprovalLevel(100000)).toBe('EXECUTIVE');
    });

    it('should return BOARD for amount > $100,000', () => {
      expect(service.getApprovalLevel(100001)).toBe('BOARD');
      expect(service.getApprovalLevel(500000)).toBe('BOARD');
    });

    it('should throw error for invalid amount', () => {
      expect(() => service.getApprovalLevel(-100)).toThrow('Valid amount is required');
      expect(() => service.getApprovalLevel(null)).toThrow('Valid amount is required');
      expect(() => service.getApprovalLevel(undefined)).toThrow('Valid amount is required');
    });
  });

  describe('getApprovalLevelWithSupplierStatus', () => {
    it('should apply Active supplier multiplier (1.0)', () => {
      expect(service.getApprovalLevelWithSupplierStatus(5000, 'Active')).toBe('MANAGER');
      expect(service.getApprovalLevelWithSupplierStatus(5001, 'Active')).toBe('DIRECTOR');
    });

    it('should apply Suspended supplier multiplier (0.5)', () => {
      // $10,000 * 0.5 = $5,000 (MANAGER)
      expect(service.getApprovalLevelWithSupplierStatus(10000, 'Suspended')).toBe('MANAGER');
      // $10,001 * 0.5 = $5,000.5 (DIRECTOR)
      expect(service.getApprovalLevelWithSupplierStatus(10001, 'Suspended')).toBe('DIRECTOR');
    });

    it('should apply New supplier multiplier (0.75)', () => {
      // $6,667 * 0.75 = $5,000.25 (DIRECTOR)
      expect(service.getApprovalLevelWithSupplierStatus(6667, 'New')).toBe('DIRECTOR');
    });

    it('should throw error for invalid supplier status', () => {
      expect(() => service.getApprovalLevelWithSupplierStatus(5000, 'Invalid')).toThrow('Valid supplier status is required');
      expect(() => service.getApprovalLevelWithSupplierStatus(5000, null)).toThrow('Valid supplier status is required');
    });
  });

  describe('canApprove', () => {
    it('should allow MANAGER to approve up to $5,000', () => {
      expect(service.canApprove('MANAGER', 1000)).toBe(true);
      expect(service.canApprove('MANAGER', 5000)).toBe(true);
      expect(service.canApprove('MANAGER', 5001)).toBe(false);
    });

    it('should allow DIRECTOR to approve up to $25,000', () => {
      expect(service.canApprove('DIRECTOR', 5001)).toBe(true);
      expect(service.canApprove('DIRECTOR', 25000)).toBe(true);
      expect(service.canApprove('DIRECTOR', 25001)).toBe(false);
    });

    it('should allow EXECUTIVE to approve up to $100,000', () => {
      expect(service.canApprove('EXECUTIVE', 25001)).toBe(true);
      expect(service.canApprove('EXECUTIVE', 100000)).toBe(true);
      expect(service.canApprove('EXECUTIVE', 100001)).toBe(false);
    });

    it('should allow BOARD to approve any amount', () => {
      expect(service.canApprove('BOARD', 100001)).toBe(true);
      expect(service.canApprove('BOARD', 999999)).toBe(true);
    });

    it('should return false for invalid user role', () => {
      expect(service.canApprove('INVALID', 1000)).toBe(false);
    });

    it('should throw error for invalid amount', () => {
      expect(() => service.canApprove('MANAGER', -100)).toThrow('Valid amount is required');
      expect(() => service.canApprove('MANAGER', null)).toThrow('Valid amount is required');
    });
  });

  describe('getRequiredApprovers', () => {
    it('should return MANAGER-level approvers for small amounts', () => {
      const approvers = service.getRequiredApprovers(1000, 'Active');
      expect(approvers).toContain('MANAGER');
    });

    it('should return DIRECTOR-level approvers for mid-range amounts', () => {
      const approvers = service.getRequiredApprovers(10000, 'Active');
      expect(approvers).toContain('DIRECTOR');
      expect(approvers.length).toBeGreaterThan(1);
    });

    it('should return BOARD for large amounts', () => {
      const approvers = service.getRequiredApprovers(150000, 'Active');
      expect(approvers).toContain('BOARD');
      expect(approvers[0]).toBe('BOARD');
    });

    it('should consider supplier status when determining approvers', () => {
      const activeApprovers = service.getRequiredApprovers(10000, 'Active');
      const suspendedApprovers = service.getRequiredApprovers(10000, 'Suspended');

      expect(activeApprovers).not.toEqual(suspendedApprovers);
    });
  });

  describe('isApprovalChainComplete', () => {
    it('should return true when required approval is present', () => {
      const approvals = [{ role: 'DIRECTOR', date: new Date() }];
      expect(service.isApprovalChainComplete(10000, 'Active', approvals)).toBe(true);
    });

    it('should return false when required approval is missing', () => {
      const approvals = [{ role: 'MANAGER', date: new Date() }];
      expect(service.isApprovalChainComplete(10000, 'Active', approvals)).toBe(false);
    });

    it('should return true when higher-level approval is present', () => {
      const approvals = [{ role: 'BOARD', date: new Date() }];
      expect(service.isApprovalChainComplete(10000, 'Active', approvals)).toBe(true);
    });

    it('should return true for small amounts with any approval', () => {
      const approvals = [{ role: 'MANAGER', date: new Date() }];
      expect(service.isApprovalChainComplete(1000, 'Active', approvals)).toBe(true);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => service.isApprovalChainComplete(-100, 'Active', [])).toThrow('Valid amount is required');
      expect(() => service.isApprovalChainComplete(1000, 'Active', 'not-array')).toThrow('Approvals must be an array');
    });
  });

  describe('setThreshold', () => {
    it('should update threshold for valid role', () => {
      service.setThreshold('MANAGER', 10000);
      expect(service.getThresholds().MANAGER).toBe(10000);
    });

    it('should throw error for invalid role', () => {
      expect(() => service.setThreshold('INVALID', 5000)).toThrow('Invalid role');
    });

    it('should throw error for invalid amount', () => {
      expect(() => service.setThreshold('MANAGER', -5000)).toThrow('Valid amount is required');
      expect(() => service.setThreshold('MANAGER', null)).toThrow('Valid amount is required');
    });
  });

  describe('calculateTotalApprovalValue', () => {
    it('should sum up all PO amounts', () => {
      const pos = [
        { amount: 1000 },
        { amount: 2000 },
        { amount: 3000 }
      ];
      expect(service.calculateTotalApprovalValue(pos)).toBe(6000);
    });

    it('should return 0 for empty array', () => {
      expect(service.calculateTotalApprovalValue([])).toBe(0);
    });

    it('should throw error for invalid PO data', () => {
      const pos = [{ amount: 1000 }, { amount: -100 }];
      expect(() => service.calculateTotalApprovalValue(pos)).toThrow('All POs must have valid amounts');
    });

    it('should throw error if not an array', () => {
      expect(() => service.calculateTotalApprovalValue('not-array')).toThrow('POs must be an array');
    });
  });
});

describe('PONumberGenerationService', () => {
  let service;

  beforeEach(() => {
    service = new PONumberGenerationService();
  });

  describe('generateSequential', () => {
    it('should generate sequential PO numbers', () => {
      const po1 = service.generateSequential();
      const po2 = service.generateSequential();
      const po3 = service.generateSequential();

      expect(po1).toBe('PO-000001');
      expect(po2).toBe('PO-000002');
      expect(po3).toBe('PO-000003');
    });

    it('should maintain sequence across multiple calls', () => {
      const pos = [];
      for (let i = 0; i < 5; i++) {
        pos.push(service.generateSequential());
      }

      expect(pos).toEqual([
        'PO-000001',
        'PO-000002',
        'PO-000003',
        'PO-000004',
        'PO-000005'
      ]);
    });

    it('should not generate duplicate numbers', () => {
      const po1 = service.generateSequential();
      const po2 = service.generateSequential();

      expect(po1).not.toBe(po2);
      expect(service.isGenerated(po1)).toBe(true);
      expect(service.isGenerated(po2)).toBe(true);
    });
  });

  describe('generateDateBased', () => {
    it('should generate date-based PO numbers', () => {
      const date = new Date('2026-04-29');
      const po = service.generateDateBased(date);

      expect(po).toMatch(/^PO-2026-04-29-\d{3}$/);
    });

    it('should increment sequence for same date', () => {
      const date = new Date('2026-04-29');
      const po1 = service.generateDateBased(date);
      const po2 = service.generateDateBased(date);

      expect(po1).toBe('PO-2026-04-29-001');
      expect(po2).toBe('PO-2026-04-29-002');
    });

    it('should use current date if none provided', () => {
      const po = service.generateDateBased();
      const currentYear = new Date().getFullYear();

      expect(po).toMatch(new RegExp(`^PO-${currentYear}-\\d{2}-\\d{2}-\\d{3}$`));
    });

    it('should throw error for invalid date', () => {
      expect(() => service.generateDateBased('2026-04-29')).toThrow('Date must be a valid Date object');
    });
  });

  describe('generateSupplierBased', () => {
    it('should generate supplier-based PO numbers', () => {
      const po = service.generateSupplierBased('SUP123');

      expect(po).toMatch(/^PO-SUP123-\d{4}-\d{3}$/);
    });

    it('should handle different supplier IDs', () => {
      const po1 = service.generateSupplierBased('SUPPLIER1');
      const po2 = service.generateSupplierBased('SUPPLIER2');

      expect(po1).toMatch(/^PO-SUPPLI-\d{4}-\d{3}$/);
      expect(po2).toMatch(/^PO-SUPPLI-\d{4}-\d{3}$/);
      expect(po1).not.toBe(po2);
    });

    it('should throw error if supplier ID is missing', () => {
      expect(() => service.generateSupplierBased(null)).toThrow('Supplier ID is required');
      expect(() => service.generateSupplierBased('')).toThrow('Supplier ID is required');
    });

    it('should throw error for invalid date', () => {
      expect(() => service.generateSupplierBased('SUP123', 'invalid')).toThrow('Date must be a valid Date object');
    });
  });

  describe('generateWithChecksum', () => {
    it('should generate PO with checksum', () => {
      const po = service.generateWithChecksum();

      expect(po).toMatch(/^PO-\d{6}-\d$/);
    });

    it('should include valid checksum', () => {
      const po = service.generateWithChecksum();
      const parts = po.split('-');
      const checksum = parts[parts.length - 1];

      expect(parseInt(checksum)).toBeLessThanOrEqual(9);
      expect(parseInt(checksum)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateChecksum', () => {
    it('should calculate valid checksum', () => {
      const checksum1 = service.calculateChecksum('PO-000001');
      const checksum2 = service.calculateChecksum('PO-000002');

      expect(typeof checksum1).toBe('number');
      expect(typeof checksum2).toBe('number');
      expect(checksum1).not.toBe(checksum2);
    });

    it('should throw error for invalid input', () => {
      expect(() => service.calculateChecksum(null)).toThrow('PO number is required');
      expect(() => service.calculateChecksum('')).toThrow('PO number is required');
    });
  });

  describe('validatePONumber', () => {
    it('should validate correct PO number format', () => {
      const result = service.validatePONumber('PO-000001');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject PO number without PO- prefix', () => {
      const result = service.validatePONumber('000001');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('PO-'))).toBe(true);
    });

    it('should reject too short PO number', () => {
      const result = service.validatePONumber('PO-1');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    it('should reject invalid characters', () => {
      const result = service.validatePONumber('PO-@#$%');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
    });

    it('should reject non-string input', () => {
      const result = service.validatePONumber(12345);

      expect(result.valid).toBe(false);
    });
  });

  describe('isGenerated', () => {
    it('should return true for generated numbers', () => {
      const po = service.generateSequential();

      expect(service.isGenerated(po)).toBe(true);
    });

    it('should return false for non-generated numbers', () => {
      expect(service.isGenerated('PO-999999')).toBe(false);
    });
  });

  describe('getTotalGenerated', () => {
    it('should count generated numbers', () => {
      expect(service.getTotalGenerated()).toBe(0);

      service.generateSequential();
      expect(service.getTotalGenerated()).toBe(1);

      service.generateSequential();
      expect(service.getTotalGenerated()).toBe(2);
    });

    it('should not count duplicates', () => {
      service.generateSequential();
      service.generateSequential();
      service.generateSequential();

      expect(service.getTotalGenerated()).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear all generated numbers', () => {
      service.generateSequential();
      service.generateSequential();

      expect(service.getTotalGenerated()).toBe(2);

      service.reset();

      expect(service.getTotalGenerated()).toBe(0);
      expect(service.generateSequential()).toBe('PO-000001');
    });
  });

  describe('extractDateFromPO', () => {
    it('should extract date from date-based PO', () => {
      const date = new Date('2026-04-29');
      const po = service.generateDateBased(date);
      const extracted = service.extractDateFromPO(po);

      expect(extracted.getFullYear()).toBe(2026);
      expect(extracted.getMonth()).toBe(3); // April (0-indexed)
      expect(extracted.getDate()).toBe(29);
    });

    it('should throw error for non-date-based PO', () => {
      const po = service.generateSequential();

      expect(() => service.extractDateFromPO(po)).toThrow('does not contain date information');
    });

    it('should throw error for null input', () => {
      expect(() => service.extractDateFromPO(null)).toThrow('PO number is required');
    });
  });

  describe('extractSupplierIdFromPO', () => {
    it('should extract supplier ID from supplier-based PO', () => {
      const po = service.generateSupplierBased('PHARMA');
      const supplierId = service.extractSupplierIdFromPO(po);

      expect(supplierId).toBe('PHARMA');
    });

    it('should throw error for non-supplier-based PO', () => {
      const po = service.generateSequential();

      expect(() => service.extractSupplierIdFromPO(po)).toThrow('does not contain supplier information');
    });

    it('should throw error for null input', () => {
      expect(() => service.extractSupplierIdFromPO(null)).toThrow('PO number is required');
    });
  });

  describe('generateBatch', () => {
    it('should generate batch of sequential numbers', () => {
      const batch = service.generateBatch(5, 'sequential');

      expect(batch).toHaveLength(5);
      expect(batch[0]).toBe('PO-000001');
      expect(batch[4]).toBe('PO-000005');
    });

    it('should generate batch of date-based numbers', () => {
      const batch = service.generateBatch(3, 'dateBased');

      expect(batch).toHaveLength(3);
      batch.forEach(po => {
        expect(po).toMatch(/^PO-\d{4}-\d{2}-\d{2}-\d{3}$/);
      });
    });

    it('should generate batch with checksums', () => {
      const batch = service.generateBatch(3, 'withChecksum');

      expect(batch).toHaveLength(3);
      batch.forEach(po => {
        expect(po).toMatch(/^PO-\d{6}-\d$/);
      });
    });

    it('should throw error for invalid count', () => {
      expect(() => service.generateBatch(-5, 'sequential')).toThrow('positive number');
      expect(() => service.generateBatch(1001, 'sequential')).toThrow('cannot exceed 1000');
    });

    it('should throw error for invalid strategy', () => {
      expect(() => service.generateBatch(5, 'invalid')).toThrow('Invalid strategy');
    });
  });
});
