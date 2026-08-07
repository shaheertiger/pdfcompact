import { ImageResponse } from "next/og";
import { OgContent } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgContent />, size);
}
