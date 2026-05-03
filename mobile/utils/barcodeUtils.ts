/**
 * Barcode utilities for the ShelfAwareness mobile app.
 */

/**
 * Checks if a string is a valid EAN-13 barcode.
 * EAN-13 must be exactly 13 digits.
 */
export const isEAN13 = (data: string): boolean => {
  return /^\d{13}$/.test(data);
};

/**
 * Checks if a string is a valid Code 128 barcode.
 * Code 128 is highly variable but usually alphanumeric and between 1-80 chars.
 * For our system, we expect standard SKU formats.
 */
export const isCode128 = (data: string): boolean => {
  return /^[A-Z0-9-]{1,50}$/.test(data);
};

/**
 * Validates if the scanned data is a supported barcode format.
 */
export const isValidBarcode = (data: string): boolean => {
  const cleanData = data.trim();
  return isEAN13(cleanData) || isCode128(cleanData);
};

/**
 * Cleans the scanned barcode data.
 */
export const cleanBarcode = (data: string): string => {
  return data.trim().toUpperCase();
};
