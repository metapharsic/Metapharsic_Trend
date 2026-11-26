"use client";

import React from "react";
import {
  buildSvgWatermarkDataUri,
  DEFAULT_WATERMARK_COMPANY,
  DEFAULT_WATERMARK_NOTICE,
  DEFAULT_WATERMARK_PLATFORM,
} from "@/lib/watermark";

export interface DocumentWatermarkProps {
  companyName?: string | null;
  subtitle?: string;
  logoUrl?: string | null;
  className?: string;
  /** Shows a centered large company seal/logo in addition to tiled diagonal text */
  showCenterSeal?: boolean;
  /** Slightly stronger opacity on statutory GST invoices */
  variant?: "subtle" | "invoice" | "print-only";
}

/**
 * Printable diagonal watermark overlay for GST invoices, batch print sheets,
 * drawers, and window.print() PDF outputs across Trend MR.
 */
export function DocumentWatermark({
  companyName,
  subtitle = DEFAULT_WATERMARK_NOTICE,
  logoUrl,
  className = "",
  showCenterSeal = false,
  variant = "subtle",
}: DocumentWatermarkProps) {
  const displayCompany = (companyName || DEFAULT_WATERMARK_COMPANY).toUpperCase();
  const svgUri = buildSvgWatermarkDataUri({
    companyName: displayCompany,
    platform: DEFAULT_WATERMARK_PLATFORM,
    notice: subtitle,
  });

  const visibilityClass =
    variant === "print-only"
      ? "hidden print:block fixed inset-0 z-[9999]"
      : "absolute inset-0 z-0";

  const opacityStyle = variant === "invoice" ? 0.11 : variant === "print-only" ? 0.08 : 0.065;

  return (
    <div
      aria-hidden="true"
      data-testid="document-watermark"
      className={`${visibilityClass} pointer-events-none select-none overflow-hidden ${className}`}
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Repeating diagonal text tiles */}
      <div
        className="w-full h-full"
        style={{
          opacity: opacityStyle,
          backgroundImage: `url("${svgUri}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "340px 210px",
        }}
      />

      {/* Optional centered company emblem seal */}
      {showCenterSeal && (
        <div className="invoice-watermark absolute inset-0 flex flex-col items-center justify-center opacity-[0.12] -rotate-25 text-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || "/logo.png"}
            alt=""
            className="w-28 h-28 mb-1 object-contain grayscale opacity-60"
            onError={(e) => {
              const target = e.currentTarget;
              if (typeof window !== "undefined" && target.src !== window.location.origin + "/logo.png") {
                target.src = "/logo.png";
              }
            }}
          />
          <span className="text-lg font-serif font-black tracking-widest uppercase">{displayCompany}</span>
          <span className="text-[9px] font-mono font-bold tracking-widest mt-0.5 uppercase text-slate-800">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
