export type QRRoute = 
  | { type: 'shipment'; trackingNumber: string }
  | { type: 'bin'; zone: string; aisle: string; bin: string }
  | { type: 'product'; query: string }
  | { type: 'order'; orderNo: string }
  | { type: 'unknown'; raw: string };

export function resolveQRCode(scanned: string): QRRoute {
  const value = scanned.trim();

  // 1. If value starts with "SA-" → type: 'shipment'
  if (value.startsWith('SA-')) {
    return { type: 'shipment', trackingNumber: value };
  }

  // 2. If value starts with "BIN:" → parse "BIN:{zone}-{aisle}-{bin}"
  if (value.startsWith('BIN:')) {
    const parts = value.substring(4).split('-');
    if (parts.length === 3) {
      return {
        type: 'bin',
        zone: parts[0],
        aisle: parts[1],
        bin: parts[2],
      };
    }
  }

  // 3. If value matches /^ORD-/ → type: 'order'
  if (/^ORD-/.test(value)) {
    return { type: 'order', orderNo: value };
  }

  // 4. If value matches /^\d{13}$/ → type: 'product' (EAN-13)
  if (/^\d{13}$/.test(value)) {
    return { type: 'product', query: value };
  }

  // 5. If value matches /^[A-Z]{2,}-[A-Z]{2,}-\d/ → type: 'product' (SKU pattern)
  if (/^[A-Z]{2,}-[A-Z]{2,}-\d/.test(value)) {
    return { type: 'product', query: value };
  }

  // 6. Anything else → type: 'unknown'
  return { type: 'unknown', raw: value };
}
