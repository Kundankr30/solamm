import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BN } from "@coral-xyz/anchor"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a human-readable token amount string (e.g. "1.5") to raw integer BN
 * without floating-point precision loss.
 * Example: parseTokenAmount("1.5", 6) => BN("1500000")
 */
export function parseTokenAmount(amount: string, decimals: number): BN {
  if (!amount || isNaN(Number(amount))) return new BN(0);

  const [whole, frac = ""] = amount.split(".");
  // Pad or truncate fractional part to match decimals
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  const raw = (whole || "0") + paddedFrac;
  // Remove leading zeros but keep at least "0"
  return new BN(raw.replace(/^0+/, "") || "0");
}
