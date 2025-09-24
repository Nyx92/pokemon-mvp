import type { Metadata } from "next"; // Next.js type for page metadata (SEO, title, description, etc.)
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "./shared-components/navbar/Navbar";
import Footer from "./shared-components/footer/Footer";
import RecoilProvider from "./atoms/RecoilProvider";
import SessionProviderWrapper from "@/providers/SessionProviderWrapper";

const inter = Inter({ subsets: ["latin"] }); // Load Inter font with Latin subset

// Default metadata for your app (SEO + browser tab info)
export const metadata: Metadata = {
  title: "Pokémon MVP",
  description: "Marketplace for buying and selling Pokémon cards",
};

// Root layout for the entire app (all pages share this structure)
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // Content of each page will be injected here
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap app with RecoilProvider so state is available globally */}
        <RecoilProvider>
          {/* Wrap with SessionProvider so NextAuth session is available throughout */}
          <SessionProviderWrapper>
            {/* Global navigation bar */}
            <NavBar />
            {/* Main content area with 60px padding to account for NavBar height */}
            <main style={{ paddingTop: "60px" }}>{children}</main>
            {/* Global footer */}
            <Footer />
          </SessionProviderWrapper>
        </RecoilProvider>
      </body>
    </html>
  );
}
