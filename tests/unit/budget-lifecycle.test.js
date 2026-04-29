import { describe, it, expect, beforeEach } from '@jest/globals';
import BudgetLifecycleService from '../../src/services/BudgetLifecycleService.js';

describe('BudgetLifecycleService', () => {
  let service;

  beforeEach(() => {
    service = new BudgetLifecycleService({
      total: 100000,
      used: 10000,
    });
  });

  describe('deductForPurchaseOrder', () => {
    it('deducts an approved PO amount from the remaining budget', () => {
      const snapshot = service.deductForPurchaseOrder({
        poId: 'PO-001',
        amount: 25000,
      });

      expect(snapshot).toEqual({
        total: 100000,
        used: 35000,
        remaining: 65000,
      });
    });

    it('parses numeric string PO amounts before deducting', () => {
      const snapshot = service.deductForPurchaseOrder({
        poId: 'PO-002',
        amount: '12500.50',
      });

      expect(snapshot.used).toBe(22500.5);
      expect(snapshot.remaining).toBe(77499.5);
    });

    it('prevents duplicate deductions for the same PO', () => {
      service.deductForPurchaseOrder({ poId: 'PO-003', amount: 5000 });

      expect(() =>
        service.deductForPurchaseOrder({ poId: 'PO-003', amount: 5000 }),
      ).toThrow('Budget deduction already applied for this PO');
    });

    it('blocks deductions that exceed the remaining budget', () => {
      expect(() =>
        service.deductForPurchaseOrder({ poId: 'PO-004', amount: 95000 }),
      ).toThrow('Insufficient budget for purchase order');
    });
  });

  describe('refundForPurchaseOrder', () => {
    it('refunds the deducted amount when a PO is rejected', () => {
      service.deductForPurchaseOrder({ poId: 'PO-005', amount: 20000 });

      const snapshot = service.refundForPurchaseOrder('PO-005');

      expect(snapshot).toEqual({
        total: 100000,
        used: 10000,
        remaining: 90000,
      });
    });

    it('prevents refunds when no matching deduction exists', () => {
      expect(() => service.refundForPurchaseOrder('PO-MISSING')).toThrow(
        'No budget deduction found for this PO',
      );
    });

    it('prevents double refunds for the same PO', () => {
      service.deductForPurchaseOrder({ poId: 'PO-006', amount: 10000 });
      service.refundForPurchaseOrder('PO-006');

      expect(() => service.refundForPurchaseOrder('PO-006')).toThrow(
        'No budget deduction found for this PO',
      );
    });
  });

  describe('applyLifecycleEvent', () => {
    it('deducts budget on PO_APPROVED lifecycle events', () => {
      const snapshot = service.applyLifecycleEvent({
        type: 'PO_APPROVED',
        poId: 'PO-007',
        amount: 15000,
      });

      expect(snapshot.used).toBe(25000);
      expect(snapshot.remaining).toBe(75000);
    });

    it('refunds budget on PO_REJECTED lifecycle events', () => {
      service.applyLifecycleEvent({
        type: 'PO_APPROVED',
        poId: 'PO-008',
        amount: 30000,
      });

      const snapshot = service.applyLifecycleEvent({
        type: 'PO_REJECTED',
        poId: 'PO-008',
      });

      expect(snapshot.used).toBe(10000);
      expect(snapshot.remaining).toBe(90000);
    });

    it('refunds budget on PO_CANCELLED lifecycle events', () => {
      service.applyLifecycleEvent({
        type: 'PO_APPROVED',
        poId: 'PO-009',
        amount: 45000,
      });

      const snapshot = service.applyLifecycleEvent({
        type: 'PO_CANCELLED',
        poId: 'PO-009',
      });

      expect(snapshot.used).toBe(10000);
      expect(snapshot.remaining).toBe(90000);
    });

    it('does not change budget on PO_DRAFTED lifecycle events', () => {
      const snapshot = service.applyLifecycleEvent({
        type: 'PO_DRAFTED',
        poId: 'PO-010',
        amount: 50000,
      });

      expect(snapshot).toEqual({
        total: 100000,
        used: 10000,
        remaining: 90000,
      });
    });

    it('throws for unsupported lifecycle events', () => {
      expect(() =>
        service.applyLifecycleEvent({
          type: 'PO_ARCHIVED',
          poId: 'PO-011',
        }),
      ).toThrow('Unsupported lifecycle event: PO_ARCHIVED');
    });
  });

  describe('validation', () => {
    it('requires a valid initial total budget', () => {
      expect(() => new BudgetLifecycleService({ total: -1 })).toThrow(
        'Valid total budget is required',
      );
    });

    it('requires used budget to be less than or equal to total budget', () => {
      expect(() => new BudgetLifecycleService({ total: 1000, used: 2000 })).toThrow(
        'Used budget cannot exceed total budget',
      );
    });

    it('requires valid PO amounts', () => {
      expect(() =>
        service.deductForPurchaseOrder({ poId: 'PO-012', amount: 0 }),
      ).toThrow('Valid PO amount is required');
    });
  });
});
