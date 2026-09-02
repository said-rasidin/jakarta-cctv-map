import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peta CCTV Jakarta",
  description: "Peta interaktif CCTV publik DKI Jakarta.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
