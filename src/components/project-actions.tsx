"use client";

import { ArrowDownToLine, Check, Copy } from "lucide-react";
import { useState } from "react";

export function ProjectDownloadButton({
  code,
  title,
  className = "button button-lime",
}: {
  code: string;
  title: string;
  className?: string;
}) {
  function download() {
    if (!code) return;
    const blob = new Blob([code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.trim().replace(/\s+/g, "-").toLowerCase() || "napkin-ui"}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button className={className} onClick={download} type="button">
      <ArrowDownToLine size={14} /> Download HTML
    </button>
  );
}

export function ProjectCopyButton({
  code,
  className = "button share-copy-button",
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  }

  return (
    <button className={className} onClick={() => void copy()} type="button">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied HTML!" : "Copy HTML"}
    </button>
  );
}
