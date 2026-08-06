"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

type AdSlotProps = {
  slot?: string;
  className?: string;
  format?: string;
};

/**
 * Renders a Google AdSense unit once NEXT_PUBLIC_ADSENSE_CLIENT (and a slot id)
 * are configured. Until then it renders nothing, so the layout stays clean
 * in development and before the site is approved for AdSense.
 */
export default function AdSlot({ slot, className, format = "auto" }: AdSlotProps) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot || pushed.current) return;
    try {
      (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle =
        (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle || [];
      (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle.push({});
      pushed.current = true;
    } catch {
      // AdSense script not loaded yet; safe to ignore.
    }
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;

  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
