import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CacheProvider } from "@/context/CacheContext";
import AuthModal from "@/components/AuthModal";
import Navbar from '@/components/Navbar';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Dashboard Inversiones",
  description:
    "Página para ver de manera rápida el dashboard de tus inversiones.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <CacheProvider>
            <Navbar />
            {children}
            <AuthModal />
          </CacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
