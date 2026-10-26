import { ImageResponse } from "next/og";

export const alt = "Napkin — from napkin to real";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        background: "#11120e",
      }}
    >
      <div
        style={{
          width: 168,
          height: 168,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 48,
          background: "#dbfa69",
        }}
      >
        <svg width="128" height="128" viewBox="0 0 32 32">
          <path
            d="M4 1h24a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H10L1 22V4a3 3 0 0 1 3-3Z"
            fill="#dbfa69"
          />
          <path d="M10 31 1 22h6a3 3 0 0 1 3 3v6Z" fill="#c2e64a" />
          <path
            d="M9 10.5c2.4-2.6 4.6 2.2 7-.4 2.3-2.5 4.4 1.9 6.8-.5"
            fill="none"
            stroke="#11120e"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
          <rect fill="#11120e" height="2.4" rx="1.2" width="9" x="9" y="16" />
          <rect fill="#11120e" height="2.4" rx="1.2" width="6" x="9" y="21" />
          <circle cx="21.5" cy="17.2" fill="#11120e" r="1.5" />
          <circle cx="20" cy="22.2" fill="#11120e" r="1.2" />
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 82,
          fontWeight: 750,
          letterSpacing: -4,
          color: "#f2f1e9",
        }}
      >
        napkin
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: "#b4b5a9",
          letterSpacing: -1,
        }}
      >
        Draw a sketch. Get a real, responsive UI.
      </div>
    </div>,
    { ...size },
  );
}
