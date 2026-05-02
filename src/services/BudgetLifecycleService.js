/**
 * Budget lifecycle rules for purchase orders.
 * Keeps budget math pure so lifecycle events can be unit-tested safely.
 */
class BudgetLifecycleService {
  constructor(initialBudget) {
    this.budget = this.#normalizeBudget(initialBudget);
    this.appliedPurchaseOrders = new Map();
  }

  deductForPurchaseOrder(po) {
    const normalizedPO = this.#normalizePO(po);

    if (this.appliedPurchaseOrders.has(normalizedPO.poId)) {
      throw new Error('Budget deduction already applied for this PO');
    }

    if (normalizedPO.amount > this.getRemainingBudget()) {
      throw new Error('Insufficient budget for purchase order');
    }

    this.budget.used += normalizedPO.amount;
    this.appliedPurchaseOrders.set(normalizedPO.poId, normalizedPO.amount);

    return this.getBudgetSnapshot();
  }

  refundForPurchaseOrder(poId) {
    if (!poId) {
      throw new Error('PO ID is required');
    }

    if (!this.appliedPurchaseOrders.has(poId)) {
      throw new Error('No budget deduction found for this PO');
    }

    const refundAmount = this.appliedPurchaseOrders.get(poId);
    this.budget.used = Math.max(0, this.budget.used - refundAmount);
    this.appliedPurchaseOrders.delete(poId);

    return this.getBudgetSnapshot();
  }

  applyLifecycleEvent(event) {
    if (!event || !event.type) {
      throw new Error('Lifecycle event type is required');
    }

    if (event.type === 'PO_APPROVED') {
      return this.deductForPurchaseOrder({
        poId: event.poId,
        amount: event.amount,
      });
    }

    if (event.type === 'PO_REJECTED' || event.type === 'PO_CANCELLED') {
      return this.refundForPurchaseOrder(event.poId);
    }

    if (event.type === 'PO_DRAFTED') {
      return this.getBudgetSnapshot();
    }

    throw new Error(`Unsupported lifecycle event: ${event.type}`);
  }

  getRemainingBudget() {
    return this.budget.total - this.budget.used;
  }

  getBudgetSnapshot() {
    return {
      total: this.budget.total,
      used: this.budget.used,
      remaining: this.getRemainingBudget(),
    };
  }

  #normalizeBudget(budget) {
    if (!budget || !Number.isFinite(Number(budget.total)) || Number(budget.total) < 0) {
      throw new Error('Valid total budget is required');
    }

    const used = Number(budget.used ?? 0);
    const total = Number(budget.total);

    if (!Number.isFinite(used) || used < 0) {
      throw new Error('Valid used budget is required');
    }

    if (used > total) {
      throw new Error('Used budget cannot exceed total budget');
    }

    return { total, used };
  }

  #normalizePO(po) {
    if (!po || !po.poId) {
      throw new Error('PO ID is required');
    }

    const amount = Number(po.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Valid PO amount is required');
    }

    return {
      poId: po.poId,
      amount,
    };
  }
}

export default BudgetLifecycleService;
