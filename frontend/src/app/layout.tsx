import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vision2Retail | Store Intelligence",
  description: "Computer-vision retail video analysis — object detection, multi-object tracking, and operational insights powered by YOLOv8 and ByteTrack.",
  keywords: ["retail analytics", "computer vision", "object detection", "YOLOv8", "video analysis"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Vision2Retail | Store Intelligence",
    description: "AI-powered retail video analysis: object detection, tracking, heatmaps, and activity timelines.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
