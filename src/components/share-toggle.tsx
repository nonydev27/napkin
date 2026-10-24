"use client";

import { Globe, LockIcon } from "lucide-react";
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
            ? "This napkin is public."
            : "This napkin is private.",
        );
      }
    } catch {
      setMessage("Could not update sharing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-toggle-wrap">
      <button
        className="button share-toggle"
        onClick={() => void toggle()}
        disabled={busy}
      >
        {isPublicState ? <Globe size={14} /> : <LockIcon size={14} />}
        {busy ? "Updating…" : isPublicState ? "Make private" : "Make public"}
      </button>
      {message ? <span className="share-toggle-message">{message}</span> : null}
    </div>
  );
}
