/**
 * Approval Threshold Rules Service
 * Handles approval rules based on PO amount and supplier status
 */

class ApprovalThresholdService {
  constructor() {
    this.thresholds = {
      MANAGER: 5000,       // Manager approval up to $5,000
      DIRECTOR: 25000,     // Director approval up to $25,000
      EXECUTIVE: 100000,   // Executive approval up to $100,000
      BOARD: Infinity      // Board approval for any amount
    };

    this.supplierMultipliers = {
      'Active': 1.0,
      'Suspended': 0.5,
      'New': 0.75
    };
  }

  /**
   * Get required approval level for a PO amount
   */
  getApprovalLevel(amount) {
    if (!amount || amount < 0) {
      throw new Error('Valid amount is required');
    }

    if (amount <= this.thresholds.MANAGER) {
      return 'MANAGER';
    } else if (amount <= this.thresholds.DIRECTOR) {
      return 'DIRECTOR';
    } else if (amount <= this.thresholds.EXECUTIVE) {
      return 'EXECUTIVE';
    } else {
      return 'BOARD';
    }
  }

  /**
   * Get approval level considering supplier status
   */
  getApprovalLevelWithSupplierStatus(amount, supplierStatus) {
    if (!amount || amount < 0) {
      throw new Error('Valid amount is required');
    }

    if (!supplierStatus || !this.supplierMultipliers[supplierStatus]) {
      throw new Error('Valid supplier status is required');
    }

    // Apply supplier multiplier to the amount
    const multiplier = this.supplierMultipliers[supplierStatus];
    const effectiveAmount = amount * multiplier;

    return this.getApprovalLevel(effectiveAmount);
  }

  /**
   * Check if user has required approval authority
   */
  canApprove(userRole, amount) {
    if (!userRole) {
      throw new Error('User role is required');
    }

    if (!amount || amount < 0) {
      throw new Error('Valid amount is required');
    }

    const requiredLevel = this.getApprovalLevel(amount);
    const roleHierarchy = ['MANAGER', 'DIRECTOR', 'EXECUTIVE', 'BOARD'];
    const requiredIndex = roleHierarchy.indexOf(requiredLevel);
    const userIndex = roleHierarchy.indexOf(userRole);

    if (userIndex === -1) {
      return false;
    }

    return userIndex >= requiredIndex;
  }

  /**
   * Get all users required to approve based on amount and supplier
   */
  getRequiredApprovers(amount, supplierStatus = 'Active') {
    if (!amount || amount < 0) {
      throw new Error('Valid amount is required');
    }

    const approvalLevel = this.getApprovalLevelWithSupplierStatus(amount, supplierStatus);
    const roleHierarchy = ['MANAGER', 'DIRECTOR', 'EXECUTIVE', 'BOARD'];
    const levelIndex = roleHierarchy.indexOf(approvalLevel);

    if (levelIndex === -1) {
      return [];
    }

    // Return all roles that can approve this level and above
    return roleHierarchy.slice(levelIndex);
  }

  /**
   * Validate if approval chain is complete
   */
  isApprovalChainComplete(amount, supplierStatus, approvals) {
    if (!amount || amount < 0) {
      throw new Error('Valid amount is required');
    }

    if (!Array.isArray(approvals)) {
      throw new Error('Approvals must be an array');
    }

    const requiredApprovers = this.getRequiredApprovers(amount, supplierStatus);
    const approverRoles = approvals.map(a => a.role);

    // Check if at least one from required level approved
    if (requiredApprovers.length === 0) {
      return true;
    }

    const hasRequiredApproval = requiredApprovers.some(role => 
      approverRoles.includes(role)
    );

    return hasRequiredApproval;
  }

  /**
   * Set custom threshold for a role
   */
  setThreshold(role, amount) {
    if (!role || !this.thresholds.hasOwnProperty(role)) {
      throw new Error('Invalid role');
    }

    if (!amount || amount < 0) {
      throw new Error('Valid amount is required');
    }

    this.thresholds[role] = amount;
  }

  /**
   * Get all thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }

  /**
   * Calculate total approval value across multiple POs
   */
  calculateTotalApprovalValue(pos) {
    if (!Array.isArray(pos)) {
      throw new Error('POs must be an array');
    }

    return pos.reduce((sum, po) => {
      if (!po.amount || po.amount < 0) {
        throw new Error('All POs must have valid amounts');
      }
      return sum + po.amount;
    }, 0);
  }
}

export default ApprovalThresholdService;
