<Dialog open={showBarcodeLabelDialog} onOpenChange={setShowBarcodeLabelDialog}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-[#111827] text-2xl">Barcode Label Generator</DialogTitle>
      <DialogDescription className="text-[#6B7280]">
        Scan a barcode to identify product and track received count
      </DialogDescription>
    </DialogHeader>

    {/* ── SCAN HANDLER SECTION ── */}
    <div className="bg-[#F0FDFF] border border-[#00A3AD] rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Barcode className="w-5 h-5 text-[#00A3AD]" />
        <span className="font-semibold text-[#111827]">Scan Barcode</span>
        <span className="text-xs text-[#6B7280]">— plug in your barcode scanner and scan any product</span>
      </div>

      <div className="flex gap-2">
        <Input
          ref={scanInputRef}
          type="text"
          inputMode="numeric"
          placeholder="Scan or type barcode here..."
          value={scanInput}
          autoFocus
          className="border-[#00A3AD] focus:ring-[#00A3AD] font-mono text-lg"
          onChange={(e) => setScanInput(sanitizeBarcodeInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleScanBarcode(scanInput);
            }
          }}
        />
        <Button
          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
          onClick={() => handleScanBarcode(scanInput)}
        >
          <Barcode className="w-4 h-4 mr-2" />
          Scan
        </Button>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div className="mt-3 bg-white border border-[#00A3AD]/30 rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6B7280] font-mono">{scanResult.sku}</div>
            <div className="text-sm font-semibold text-[#111827]">{scanResult.name}</div>
            <div className="text-xs text-[#6B7280]">Barcode: {scanResult.barcode}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#6B7280]">Actual Received</div>
            <div className="text-3xl font-bold text-[#00A3AD]">
              {scanCount[scanResult.id] ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* All scanned items summary */}
      {Object.keys(scanCount).length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-[#6B7280] mb-2 font-semibold uppercase tracking-wide">Scanned Items This Session</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Object.entries(scanCount).map(([productId, count]) => {
              const prod = products.find((p) => p.id === productId);
              if (!prod) return null;
              return (
                <div key={productId} className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded px-3 py-1.5 text-sm">
                  <div>
                    <span className="font-mono text-[#00A3AD] text-xs mr-2">{prod.sku}</span>
                    <span className="text-[#111827]">{prod.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#111827]">×{count}</span>
                    <button
                      className="text-xs text-[#F97316] hover:underline"
                      onClick={() => setScanCount((prev) => {
                        const updated = { ...prev };
                        delete updated[productId];
                        return updated;
                      })}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className="mt-2 text-xs text-[#6B7280] hover:text-[#F97316] underline"
            onClick={() => { setScanCount({}); setScanResult(null); }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>

    {/* Search */}
    <div className="mb-4">
      <Input
        type="text"
        placeholder="Search by name, SKU, or barcode…"
        value={barcodeLabelSearch}
        onChange={(e) => setBarcodeLabelSearch(e.target.value)}
        className="border-[#111827]/10"
      />
    </div>

    {/* Product Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto p-1">
      {products
        .filter((p) => p.barcode && p.barcode.trim() !== "")
        .filter((p) =>
          barcodeLabelSearch === "" ||
          p.name.toLowerCase().includes(barcodeLabelSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(barcodeLabelSearch.toLowerCase()) ||
          p.barcode?.includes(barcodeLabelSearch)
        )
        .map((product) => (
          <BarcodeLabelCard
            key={product.id}
            product={product}
            onPrint={(prod) => {
              setPrintTarget(prod);
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  window.print();
                });
              });
            }}
          />
        ))}
    </div>

    {products.filter((p) => p.barcode && p.barcode.trim() !== "").length === 0 && (
      <div className="text-center py-8 text-[#6B7280]">
        No products with barcodes found
      </div>
    )}
  </DialogContent>
</Dialog>