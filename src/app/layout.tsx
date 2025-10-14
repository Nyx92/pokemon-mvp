import type { Metadata } from "next"; // Next.js type for page metadata (SEO, title, description, etc.)
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "./shared-components/navbar/Navbar";
import Footer from "./shared-components/footer/Footer";
import SessionProviderWrapper from "@/providers/SessionProviderWrapper";
import SessionSync from "@/providers/SessionSync";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] }); // Load Inter font with Latin subset

// Default metadata for your app (SEO + browser tab info)
export const metadata: Metadata = {
  title: "Pokémon MVP",
  description: "Marketplace for buying and selling Pokémon cards",
};

// Root layout for the entire app (all pages share this structure)
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // Content of each page will be injected here
}>) {
  // Fetch session on the server before rendering
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap with SessionProvider so NextAuth session is available throughout */}
        <SessionProviderWrapper>
          {/* ✅ Keeps Zustand store in sync with NextAuth session */}
          <SessionSync />
          {/* Global navigation bar */}
          {/* Pass initial user info down to NavBar */}
          <NavBar initialUser={session?.user} />
          {/* Main content area with 60px padding to account for NavBar height */}
          <main style={{ paddingTop: "60px" }}>{children}</main>
          {/* Global footer */}
          <Footer />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
