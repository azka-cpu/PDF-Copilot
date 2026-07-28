import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PDF Copilot",
  description: "Ask questions about your PDFs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="bg-paper text-slate-text">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
