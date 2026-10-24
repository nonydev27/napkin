"use client";

import { Check, Copy, ExternalLink, Globe, LockIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ShareToggle({
  id,
  isPublic,
}: {
  id: string;
  isPublic: boolean;
}) {
  const [isPublicState, setIsPublicState] = useState(isPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, share: !isPublicState }),
      });
      const result = (await response.json()) as {
        project?: { is_public: boolean };
        error?: string;
      };
      if (!response.ok || !result.project) {
        setMessage(result.error || "Could not update sharing.");
      } else {
        setIsPublicState(result.project.is_public);
        setMessage(
          result.project.is_public
            ? "Public share enabled."
            : "Made private.",
        );
        window.setTimeout(() => setMessage(null), 3500);
      }
    } catch {
      setMessage("Could not update sharing.");
    } finally {
      setBusy(false);
    }
  }

  async function copyShareUrl() {
    try {
      const shareUrl = `${window.location.origin}/share/${id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage("Could not copy link to clipboard.");
    }
  }

  return (
    <div className="share-toggle-wrap">
      <button
        className={`share-toggle ${isPublicState ? "is-public" : ""}`}
        disabled={busy}
        onClick={() => void toggle()}
        type="button"
      >
        {isPublicState ? <Globe size={13} /> : <LockIcon size={13} />}
        <span>{busy ? "Updating…" : isPublicState ? "Make private" : "Make public"}</span>
      </button>

      {isPublicState && (
        <>
          <button
            className="share-copy-button"
            onClick={() => void copyShareUrl()}
            title="Copy public link"
            type="button"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Link copied!" : "Copy link"}</span>
          </button>
          <Link
            className="share-view-link"
            href={`/share/${id}`}
            rel="noreferrer"
            target="_blank"
            title="Open public view"
          >
            <span>View public</span>
            <ExternalLink size={12} />
          </Link>
        </>
      )}

      {message && <span className="share-toggle-message">{message}</span>}
    </div>
  );
}
