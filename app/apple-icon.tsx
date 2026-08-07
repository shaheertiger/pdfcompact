import { ImageResponse } from "next/og";
import { faviconSvgPaths } from "@/lib/favicon-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const { background, page, fold, foldColor } = faviconSvgPaths();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32">
          <path d={page} fill="#ffffff" />
          <path d={fold} fill={foldColor} />
        </svg>
      </div>
    ),
    size
  );
}
