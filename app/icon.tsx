import { ImageResponse } from "next/og";
import { faviconSvgPaths } from "@/lib/favicon-svg";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const { background, page, fold, foldColor } = faviconSvgPaths();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 7,
          background,
          display: "flex",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32">
          <path d={page} fill="#ffffff" />
          <path d={fold} fill={foldColor} />
        </svg>
      </div>
    ),
    size
  );
}
