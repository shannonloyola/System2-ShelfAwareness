const { describe, it, expect, beforeEach } = require('@jest/globals');
const SupplierService = require('../../src/services/SupplierService');

describe('SupplierService', () => {
  let service;
  let mockSupabase;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis()
    };

    service = new SupplierService(mockSupabase);
  });

  describe('getSuppliers', () => {
    it('should return all suppliers successfully', async () => {
      const mockData = [
        { id: '1', supplier_name: 'Supplier 1', currency_code: 'USD', lead_time_days: 7 }
      ];
      mockSupabase.select.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.getSuppliers();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should handle error when fetching suppliers', async () => {
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

      const result = await service.getSuppliers();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing supabase client', async () => {
      service = new SupplierService(null);
      const result = await service.getSuppliers();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Supabase client not initialized');
    });
  });

  describe('getSupplierById', () => {
    it('should return supplier by ID', async () => {
      const mockData = { id: '1', supplier_name: 'Test Supplier', currency_code: 'USD', lead_time_days: 7 };
      mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.getSupplierById('1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should return error if ID is missing', async () => {
      const result = await service.getSupplierById(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ID is required');
    });

    it('should handle database error', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

      const result = await service.getSupplierById('999');

      expect(result.success).toBe(false);
    });
  });

  describe('createSupplier', () => {
    it('should create supplier successfully', async () => {
      const supplierData = {
        supplier_name: 'New Supplier',
        currency_code: 'USD',
        lead_time_days: 10,
        contact_person: 'John Doe'
      };
      const mockData = { id: '123', ...supplierData };
      mockSupabase.insert.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockResolvedValueOnce({ data: [mockData], error: null });

      const result = await service.createSupplier(supplierData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should return error if supplier_name is missing', async () => {
      const result = await service.createSupplier({ currency_code: 'USD', lead_time_days: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Supplier name is required');
    });

    it('should return error if currency_code is missing', async () => {
      const result = await service.createSupplier({ supplier_name: 'Test', lead_time_days: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Currency code is required');
    });

    it('should return error if lead_time_days is invalid', async () => {
      const result = await service.createSupplier({
        supplier_name: 'Test',
        currency_code: 'USD',
        lead_time_days: 0
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lead time must be greater than 0');
    });

    it('should handle database error during creation', async () => {
      const supplierData = {
        supplier_name: 'Test',
        currency_code: 'USD',
        lead_time_days: 10
      };
      mockSupabase.insert.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

      const result = await service.createSupplier(supplierData);

      expect(result.success).toBe(false);
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier successfully', async () => {
      const updateData = { supplier_name: 'Updated Supplier' };
      const mockData = { id: '1', ...updateData };
      mockSupabase.update.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockResolvedValueOnce({ data: [mockData], error: null });

      const result = await service.updateSupplier('1', updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should return error if ID is missing', async () => {
      const result = await service.updateSupplier(null, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('ID is required');
    });

    it('should handle database error during update', async () => {
      mockSupabase.update.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

      const result = await service.updateSupplier('1', { supplier_name: 'Updated' });

      expect(result.success).toBe(false);
    });
  });

  describe('deleteSupplier', () => {
    it('should delete supplier successfully', async () => {
      mockSupabase.delete.mockResolvedValueOnce({ error: null });

      const result = await service.deleteSupplier('1');

      expect(result.success).toBe(true);
    });

    it('should return error if ID is missing', async () => {
      const result = await service.deleteSupplier(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ID is required');
    });

    it('should handle database error during delete', async () => {
      mockSupabase.delete.mockResolvedValueOnce({ error: new Error('DB Error') });

      const result = await service.deleteSupplier('1');

      expect(result.success).toBe(false);
    });
  });

  describe('searchSuppliers', () => {
    it('should search suppliers by name', async () => {
      const mockData = [
        { id: '1', supplier_name: 'Test Supplier', currency_code: 'USD', lead_time_days: 7 }
      ];
      mockSupabase.ilike.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.searchSuppliers('Test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should return error if search term is missing', async () => {
      const result = await service.searchSuppliers(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search term is required');
    });

    it('should handle database error during search', async () => {
      mockSupabase.ilike.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

      const result = await service.searchSuppliers('Test');

      expect(result.success).toBe(false);
    });
  });

  describe('validateSupplierData', () => {
    it('should validate correct supplier data', () => {
      const validData = {
        supplier_name: 'Valid Supplier',
        currency_code: 'USD',
        lead_time_days: 7,
        email: 'supplier@example.com'
      };

      const result = service.validateSupplierData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation if supplier_name is missing', () => {
      const invalidData = {
        currency_code: 'USD',
        lead_time_days: 7
      };

      const result = service.validateSupplierData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Supplier name'));
    });

    it('should fail validation if currency_code is missing', () => {
      const invalidData = {
        supplier_name: 'Test',
        lead_time_days: 7
      };

      const result = service.validateSupplierData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Currency code'));
    });

    it('should fail validation if lead_time_days is invalid', () => {
      const invalidData = {
        supplier_name: 'Test',
        currency_code: 'USD',
        lead_time_days: -1
      };

      const result = service.validateSupplierData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Lead time'));
    });

    it('should fail validation if email is invalid', () => {
      const invalidData = {
        supplier_name: 'Test',
        currency_code: 'USD',
        lead_time_days: 7,
        email: 'invalid-email'
      };

      const result = service.validateSupplierData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid email'));
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      const result = service.isValidEmail('test@example.com');
      expect(result).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(service.isValidEmail('invalid')).toBe(false);
      expect(service.isValidEmail('invalid@')).toBe(false);
      expect(service.isValidEmail('@example.com')).toBe(false);
    });
  });
});
