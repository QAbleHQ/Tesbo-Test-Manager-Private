"use client";

import { useEffect, useState } from "react";
import { getBranding } from "@/lib/api";

const DEFAULT_PRODUCT_NAME = "Tesbo Test Manager";
const DEFAULT_LOGO_URL = "/tesbo-test-manager-logo.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  decorative?: boolean;
};

export function BrandLogo({ className = "h-10 w-auto object-contain", alt, decorative = false }: BrandLogoProps) {
  const [branding, setBranding] = useState({ productName: DEFAULT_PRODUCT_NAME, logoUrl: DEFAULT_LOGO_URL });

  useEffect(() => {
    let alive = true;
    getBranding()
      .then((next) => {
        if (alive) setBranding(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <img
      src={branding.logoUrl || DEFAULT_LOGO_URL}
      alt={decorative ? "" : alt || branding.productName || DEFAULT_PRODUCT_NAME}
      className={className}
    />
  );
}

