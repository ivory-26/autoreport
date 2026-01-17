import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AutoReport - Zero-Click Documentation",
  description: "Autonomous project documentation from Git commits. Let AI write your reports while you code.",
  keywords: ["documentation", "AI", "automation", "git", "reports", "software", "developer tools"],
  authors: [{ name: "AutoReport Team" }],
  
  // Favicon
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  
  // Open Graph (Facebook, LinkedIn, WhatsApp, Discord, etc.)
  openGraph: {
    title: "AutoReport - Zero-Click Documentation",
    description: "Autonomous project documentation from Git commits. Let AI write your reports while you code.",
    url: "https://autoreport-five.vercel.app",
    siteName: "AutoReport",
    images: [
      {
        url: "/banner.jpeg",
        width: 1200,
        height: 630,
        alt: "AutoReport - AI-Powered Documentation",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "AutoReport - Zero-Click Documentation",
    description: "Autonomous project documentation from Git commits. Let AI write your reports while you code.",
    images: ["/banner.jpeg"],
  },
  
  // Additional metadata
  robots: {
    index: true,
    follow: true,
  },
  
  metadataBase: new URL("https://autoreport-five.vercel.app"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
