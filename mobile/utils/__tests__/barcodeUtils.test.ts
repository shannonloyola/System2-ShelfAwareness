import { isEAN13, isCode128, isValidBarcode, cleanBarcode } from '../barcodeUtils';

describe('barcodeUtils', () => {
  describe('isEAN13', () => {
    it('should return true for valid 13-digit numeric string', () => {
      expect(isEAN13('1234567890123')).toBe(true);
    });

    it('should return false for shorter strings', () => {
      expect(isEAN13('123456789012')).toBe(false);
    });

    it('should return false for longer strings', () => {
      expect(isEAN13('12345678901234')).toBe(false);
    });

    it('should return false for non-numeric strings', () => {
      expect(isEAN13('123456789012A')).toBe(false);
    });
  });

  describe('isCode128', () => {
    it('should return true for alphanumeric strings', () => {
      expect(isCode128('SKU-12345')).toBe(true);
      expect(isCode128('ABCDEF')).toBe(true);
    });

    it('should return false for invalid characters', () => {
      expect(isCode128('SKU@123')).toBe(false);
    });
  });

  describe('isValidBarcode', () => {
    it('should validate EAN13', () => {
      expect(isValidBarcode('1234567890123')).toBe(true);
    });

    it('should validate Code128', () => {
      expect(isValidBarcode('SKU-999')).toBe(true);
    });

    it('should fail invalid formats', () => {
      expect(isValidBarcode('INVALID@#!')).toBe(false);
    });
  });

  describe('cleanBarcode', () => {
    it('should trim and uppercase', () => {
      expect(cleanBarcode('  sku-123  ')).toBe('SKU-123');
    });
  });
});
