import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface ProductOption {
  sku: string;
  name: string;
  price?: number;
  stock?: number;
  [key: string]: any;
}

interface SearchableProductSelectProps {
  options: ProductOption[];
  value: string; // the selected sku
  onChange: (sku: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableProductSelect({
  options,
  value,
  onChange,
  placeholder = "Select product...",
  className = "",
  disabled = false,
}: SearchableProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.sku === value);

  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.name);
    } else {
      setSearchTerm("");
    }
  }, [value, selectedOption]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedOption) {
          setSearchTerm(selectedOption.name);
        } else {
          setSearchTerm("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption]);

  const filtered = options.filter((o) =>
    (o.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.sku || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          disabled={disabled}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">No products found</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.sku}
                onClick={() => {
                  onChange(opt.sku);
                  setSearchTerm(opt.name);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 transition-colors flex justify-between items-center ${
                  opt.sku === value ? "bg-teal-50/50 font-medium text-teal-700" : "text-gray-700"
                }`}
              >
                <div className="truncate pr-2">
                  <p className="font-medium truncate">{opt.name}</p>
                  <p className="text-xs text-gray-400 truncate">{opt.sku}</p>
                </div>
                {(opt.stock !== undefined || opt.price !== undefined) && (
                  <div className="text-right text-xs text-gray-500 pl-2 shrink-0">
                    {opt.price !== undefined && <p>₱{opt.price.toLocaleString()}</p>}
                    {opt.stock !== undefined && <p>Stock: {opt.stock}</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
