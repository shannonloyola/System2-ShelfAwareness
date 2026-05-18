import React, { useRef } from "react";
import QRCode from "react-qr-code";

interface Field {
  label: string;
  value: string;
}

interface Item {
  name: string;
  sku?: string;
  qty?: number;
  quantity?: number;
}

interface QRLabelModalProps {
  qrValue: string;
  title: string;
  subtitle: string;
  fields: Field[];
  items?: Item[];
  isOpen: boolean;
  onClose: () => void;
}

export const QRLabelModal: React.FC<QRLabelModalProps> = ({
  qrValue,
  title,
  subtitle,
  fields,
  items,
  isOpen,
  onClose,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = () => {
    const svgElement = document.getElementById("qr-code-svg");
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const blobURL = window.URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 250;
      canvas.height = 250;
      const context = canvas.getContext("2d");
      if (context) {
        // Draw white background
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 250, 250);
        context.drawImage(image, 25, 25, 200, 200);
        const png = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = png;
        downloadLink.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_qr.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    image.src = blobURL;
  };

  const generatedDateStr = new Date().toLocaleString();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm non-printable-actions">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10 font-bold"
        >
          ✕
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto p-6 flex-1 flex flex-col items-center">
          {/* Printable Label Card */}
          <div
            ref={printAreaRef}
            className="printable-label w-full p-6 bg-white border border-gray-150 rounded-lg flex flex-col items-center shadow-sm"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {/* Top Center Headers */}
            <div className="text-center mb-1">
              <span className="text-[#00A3AD] font-bold text-xs uppercase tracking-widest block">
                SHELF AWARENESS
              </span>
              <span className="text-gray-400 text-[10px] font-medium tracking-wider uppercase block">
                Medical Logistics
              </span>
            </div>

            {/* Teal thin divider */}
            <div className="w-full h-[1px] bg-[#00A3AD]/30 my-3" />

            {/* QR Code Container */}
            <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-center justify-center">
              <QRCode
                id="qr-code-svg"
                value={qrValue}
                size={200}
                fgColor="#1A2B47"
                bgColor="#ffffff"
                level="H"
              />
            </div>

            {/* QR Label Info */}
            <div className="text-center mt-4 w-full">
              <h4 className="text-lg font-bold text-[#111827] tracking-tight leading-tight">
                {title}
              </h4>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                {subtitle}
              </p>
            </div>

            {/* Divider line */}
            <div className="w-full h-[1px] bg-gray-100 my-4" />

            {/* Fields two-column grid */}
            {fields && fields.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 w-full text-left">
                {fields.map((f, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      {f.label}
                    </span>
                    <span className="text-xs text-gray-800 font-mono font-semibold mt-0.5 break-all">
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Optional Items Table */}
            {items && items.length > 0 && (
              <div className="w-full mt-4">
                <div className="w-full h-[1px] bg-gray-100 my-3" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                  CARTON ITEMS
                </span>
                <div className="border border-gray-100 rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <th className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px]">Item / Product</th>
                        {items.some(it => it.sku) && <th className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px]">SKU</th>}
                        <th className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} className="border-b last:border-0 border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-850">{it.name}</td>
                          {items.some(item => item.sku) && <td className="px-3 py-2 font-mono text-gray-600">{it.sku || "-"}</td>}
                          <td className="px-3 py-2 text-right font-bold text-gray-900">{it.qty ?? it.quantity ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Divider line before footer */}
            <div className="w-full h-[1px] bg-gray-100 my-3" />

            {/* Footer */}
            <div className="w-full text-center">
              <span className="text-gray-400 text-[9px] font-mono tracking-normal">
                Generated: {generatedDateStr}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 non-printable-actions">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 bg-[#1A2B47] hover:bg-[#2A3B57] text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            🖨 Print Label
          </button>
          <button
            onClick={handleDownloadPNG}
            className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            ⬇ Download PNG
          </button>
        </div>

        {/* CSS for printing ONLY the printable label */}
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
            }
            body > * {
              display: none !important;
            }
            .fixed, .non-printable-actions {
              display: none !important;
              position: static !important;
              background: none !important;
              backdrop-filter: none !important;
            }
            html, body {
              height: auto !important;
              overflow: visible !important;
            }
            .printable-label {
              display: flex !important;
              position: absolute !important;
              left: 50% !important;
              top: 50px !important;
              transform: translateX(-50%) !important;
              width: 380px !important;
              border: 1px solid #ccc !important;
              border-radius: 8px !important;
              padding: 24px !important;
              box-shadow: none !important;
              visibility: visible !important;
              background: white !important;
              z-index: 999999 !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
