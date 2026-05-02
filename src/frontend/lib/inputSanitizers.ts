import type * as React from "react";

const NAVIGATION_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Enter",
  "Escape",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

type NumberKeydownOptions = {
  allowDecimal?: boolean;
  allowNegative?: boolean;
};

export function sanitizeDigits(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  if (typeof maxLength === "number") {
    return digits.slice(0, maxLength);
  }
  return digits;
}

export function sanitizeIntegerInput(value: string) {
  return sanitizeDigits(value);
}

export function sanitizeSignedIntegerInput(value: string) {
  if (value === "" || value === "-") return value;

  const trimmed = value.replace(/[^\d-]/g, "");
  const isNegative = trimmed.startsWith("-");
  const digits = trimmed.replace(/-/g, "");

  if (!digits) {
    return isNegative ? "-" : "";
  }

  return `${isNegative ? "-" : ""}${digits}`;
}

export function sanitizeDecimalInput(
  value: string,
  maxDecimals = 2,
) {
  if (value === "") return "";

  const sanitized = value.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = sanitized.split(".");
  const fraction = rest.join("").slice(0, maxDecimals);

  if (sanitized.startsWith(".")) {
    return fraction ? `0.${fraction}` : "0.";
  }

  if (rest.length === 0) {
    return whole;
  }

  return `${whole}.${fraction}`;
}

export function sanitizePhoneInput(value: string) {
  return sanitizeDigits(value, 10);
}

export function isPhoneValid(value: string) {
  return /^\d{1,10}$/.test(value);
}

export function blockInvalidNumberKeys(
  event: React.KeyboardEvent<HTMLInputElement>,
  options: NumberKeydownOptions = {},
) {
  const { allowDecimal = false, allowNegative = false } = options;

  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (NAVIGATION_KEYS.has(event.key)) return;

  const currentValue = event.currentTarget.value;
  const selectionStart = event.currentTarget.selectionStart ?? 0;

  if (/^\d$/.test(event.key)) return;

  if (
    allowDecimal &&
    event.key === "." &&
    !currentValue.includes(".")
  ) {
    return;
  }

  if (
    allowNegative &&
    event.key === "-" &&
    selectionStart === 0 &&
    !currentValue.includes("-")
  ) {
    return;
  }

  event.preventDefault();
}
