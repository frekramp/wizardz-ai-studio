import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ArtWall } from "@/components/art-wall";
import { WizardCursor } from "@/components/wizard-cursor";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wizardz AI Studio",
  description:
    "Conjure anything with the Wizardz Spellbook. Turn a selfie or a prompt into a Wizardz-style wizard — animate it and make it yours.",
  metadataBase: new URL("https://wizardz.art"),
  openGraph: {
    title: "Wizardz AI Studio",
    description: "Conjure anything with the Wizardz Spellbook. 🧙",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ArtWall />
        {children}
        <WizardCursor />
      </body>
    </html>
  );
}
