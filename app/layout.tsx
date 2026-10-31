import type { Metadata, Viewport } from "next";
import { League_Gothic, Pixelify_Sans, VT323 } from "next/font/google";
import "./globals.css";

const terminal = VT323({
  variable: "--font-vt323",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

const display = League_Gothic({
  variable: "--font-league-gothic",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const pixel = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THE LAST SIGNAL",
  description:
    "A short interactive psychological horror experience. An abandoned research computer, a voice that claims to be its creator, and a process you must not kill.",
  openGraph: {
    title: "THE LAST SIGNAL",
    description: "November 2. The machine was never meant to speak back.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${terminal.variable} ${display.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
