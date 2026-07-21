"use client";

import { useState } from "react";
import { IconClipboardCheck, IconCopy } from "@tabler/icons-react";
import { cx } from "@/components/ui/cx";

export type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  iconOnly = false,
  size = "sm",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const iconSize = size === "sm" ? 13 : 15;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={iconOnly ? (copied ? copiedLabel : label) : undefined}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] font-medium text-[var(--muted)] hover:border-[var(--brand-border)] hover:text-[var(--foreground)]",
        size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-xs",
        iconOnly && "px-1.5",
        className,
      )}
    >
      {copied ? <IconClipboardCheck size={iconSize} stroke={1.9} /> : <IconCopy size={iconSize} stroke={1.9} />}
      {!iconOnly && (copied ? copiedLabel : label)}
    </button>
  );
}
