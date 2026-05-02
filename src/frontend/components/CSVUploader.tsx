/**
 * CSVUploader.tsx
 * Drop-in React component for the Pharma Distribution Management System.
 *
 * Usage:
 *   <CSVUploader onParsed={(rows) => console.log(rows)} />
 *
 * Props:
 *   onParsed  — called with the cleaned CSVRow[] payload once parsing succeeds
 *   onError   — (optional) called if the file cannot be parsed
 */

import React, { useCallback, useRef, useState } from "react";
import { parseCSVFile, CSVRow } from "@/lib/csvParser";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CSVUploaderProps {
  onParsed: (rows: CSVRow[]) => void;
  onError?: (message: string) => void;
  /** Maximum rows to preview in the table (default: 10) */
  previewLimit?: number;
}

type UploadState = "idle" | "parsing" | "success" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  onParsed,
  onError,
  previewLimit = 10,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragOver, setDragOver]       = useState(false);
  const [fileName, setFileName]       = useState<string | null>(null);
  const [preview, setPreview]         = useState<CSVRow[]>([]);
  const [totalRows, setTotalRows]     = useState(0);
  const [skippedRows, setSkippedRows] = useState(0);
  const [warnings, setWarnings]       = useState<string[]>([]);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File validation ─────────────────────────────────────────────────────────

  const isCSVFile = (file: File): boolean => {
    const validExtension = file.name.toLowerCase().endsWith(".csv");
    const validMime = [
      "text/csv",
      "text/plain",
      "application/csv",
      "application/vnd.ms-excel", // some OS/browsers report .csv with this MIME
    ].includes(file.type) || file.type === ""; // empty type = dragged from desktop on some OSes
    return validExtension && validMime;
  };

  // ── File handler ────────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      if (!isCSVFile(file)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "unknown";
        const msg = `Only CSV files are accepted. You uploaded a .${ext} file.`;
        setErrorMsg(msg);
        setUploadState("error");
        onError?.(msg);
        return;
      }

      setFileName(file.name);
      setUploadState("parsing");
      setErrorMsg(null);
      setWarnings([]);
      setPreview([]);

      try {
        const result = await parseCSVFile(file);

        setTotalRows(result.data.length);
        setSkippedRows(result.skippedRows);
        setWarnings(result.errors);
        setPreview(result.data.slice(0, previewLimit));
        setUploadState("success");

        // ✅ Hand the cleaned JSON payload to the parent
        onParsed(result.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown parse error.";
        setErrorMsg(msg);
        setUploadState("error");
        onError?.(msg);
      }
    },
    [onParsed, onError, previewLimit]
  );

  // ── Drag-and-drop handlers ──────────────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so the same file can be re-selected
    e.target.value = "";
  };

  const reset = () => {
    setUploadState("idle");
    setFileName(null);
    setPreview([]);
    setTotalRows(0);
    setSkippedRows(0);
    setWarnings([]);
    setErrorMsg(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          // Only highlight if the dragged item looks like a CSV
          const items = Array.from(e.dataTransfer.items);
          const looksLikeCSV = items.some(
            (item) => item.type === "text/csv" || item.type === "text/plain" || item.type === ""
          );
          setDragOver(looksLikeCSV);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors select-none",
          dragOver
            ? "border-[#00A3AD] bg-[#00A3AD]/5"
            : uploadState === "success"
            ? "border-[#00A3AD] bg-[#00A3AD]/5"
            : uploadState === "error"
            ? "border-[#F97316] bg-[#F97316]/5"
            : "border-slate-300 bg-slate-50 hover:border-[#00A3AD] hover:bg-[#00A3AD]/5",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onInputChange}
        />

        {uploadState === "idle" && (
          <>
            <UploadIcon />
            <p className="text-sm font-medium text-slate-600">
              Drag & drop a CSV file here, or{" "}
              <span className="text-[#00A3AD] underline">browse</span>
            </p>
            <p className="text-xs text-slate-400">
              Required columns: <code>sku</code> and <code>qty</code>
            </p>
          </>
        )}

        {uploadState === "parsing" && (
          <p className="text-sm text-[#00A3AD] animate-pulse">Parsing {fileName}…</p>
        )}

        {uploadState === "success" && (
          <>
            <CheckIcon />
            <p className="text-sm font-semibold text-[#00A3AD]">{fileName}</p>
            <p className="text-xs text-[#00A3AD]">
              {totalRows} valid row{totalRows !== 1 ? "s" : ""} loaded
              {skippedRows > 0 && ` · ${skippedRows} skipped`}
            </p>
          </>
        )}

        {uploadState === "error" && (
          <>
            <ErrorIcon />
            <p className="text-sm font-semibold text-[#F97316]">Parse failed</p>
            <p className="text-xs text-[#F97316] text-center max-w-xs">{errorMsg}</p>
          </>
        )}
      </div>

      {/* Action buttons */}
      {(uploadState === "success" || uploadState === "error") && (
        <button
          onClick={reset}
          className="text-xs text-slate-500 underline hover:text-slate-700 transition-colors"
        >
          Upload a different file
        </button>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <details className="rounded-lg border border-[#F97316]/30 bg-[#F97316]/5 px-4 py-3 text-xs text-[#F97316]">
          <summary className="cursor-pointer font-medium">
            ⚠ {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 list-disc pl-4 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1A2B47] text-white uppercase text-xs">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">QTY</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 font-mono font-medium text-slate-800">
                    {row.sku}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalRows > previewLimit && (
            <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-200">
              Showing {previewLimit} of {totalRows} rows
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const UploadIcon = () => (
  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-10 h-10 text-[#00A3AD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-10 h-10 text-[#F97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

export default CSVUploader;
