import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bognot Bingo of the Superheroes",
  description: "Live multiplayer Christmas Bingo for the Bognot family party",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
