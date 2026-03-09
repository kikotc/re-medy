import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import DesktopNav from "@/components/DesktopNav";
import AuroraBackground from "@/components/AuroraBackground";

export const metadata: Metadata = {
  title: "re-medy",
  description: "Medication safety and adherence app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <AuroraBackground />
        <DesktopNav />
        <main className="relative z-10 mx-auto min-h-screen max-w-md px-4 pb-20 pt-24 md:max-w-5xl md:px-8 md:pb-8">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}