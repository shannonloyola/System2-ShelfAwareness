/**
 * Supplier Service - handles supplier operations
 */

class SupplierService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Get all suppliers
   */
  async getSuppliers() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('suppliers')
        .select('*');
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(id) {
    try {
      if (!id) {
        throw new Error('Supplier ID is required');
      }
      
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching supplier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new supplier
   */
  async createSupplier(supplierData) {
    try {
      if (!supplierData || !supplierData.supplier_name) {
        throw new Error('Supplier name is required');
      }

      if (!supplierData.currency_code) {
        throw new Error('Currency code is required');
      }

      if (!supplierData.lead_time_days || supplierData.lead_time_days <= 0) {
        throw new Error('Lead time must be greater than 0');
      }

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('suppliers')
        .insert([supplierData])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error creating supplier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(id, supplierData) {
    try {
      if (!id) {
        throw new Error('Supplier ID is required');
      }

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error updating supplier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(id) {
    try {
      if (!id) {
        throw new Error('Supplier ID is required');
      }

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { error } = await this.supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search suppliers by name
   */
  async searchSuppliers(searchTerm) {
    try {
      if (!searchTerm) {
        throw new Error('Search term is required');
      }

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('suppliers')
        .select('*')
        .ilike('supplier_name', `%${searchTerm}%`);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error searching suppliers:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate supplier data
   */
  validateSupplierData(data) {
    const errors = [];

    if (!data.supplier_name || typeof data.supplier_name !== 'string') {
      errors.push('Supplier name must be a valid string');
    }

    if (!data.currency_code || typeof data.currency_code !== 'string') {
      errors.push('Currency code must be a valid string');
    }

    if (!data.lead_time_days || typeof data.lead_time_days !== 'number' || data.lead_time_days <= 0) {
      errors.push('Lead time must be a positive number');
    }

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper: validate email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = SupplierService;
