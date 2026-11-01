import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CacheProvider } from "@/context/CacheContext";
import { PrivacyProvider, PRIVACY_STORAGE_KEY } from "@/context/PrivacyContext";
import AuthModal from "@/components/AuthModal";
import Navbar from '@/components/Navbar';
import { Analytics } from "@vercel/analytics/next";

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

// Se ejecuta antes del primer pintado para que los importes ya aparezcan
// difuminados al recargar si el modo privacidad estaba activo (sin parpadeo).
const privacyInitScript = `try{if(localStorage.getItem('${PRIVACY_STORAGE_KEY}')==='on'){document.documentElement.setAttribute('data-privacy','on')}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: privacyInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Analytics/>
        <AuthProvider>
          <CacheProvider>
            <PrivacyProvider>
              <Navbar />
              {children}
              <AuthModal />
            </PrivacyProvider>
          </CacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
