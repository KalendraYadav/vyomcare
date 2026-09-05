import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'BioTrack — Biomedical Waste Management',
  description: 'Secure, compliant tracking of biomedical waste from generation to disposal. Chain-of-custody management for hospitals, treatment facilities, and government authorities.',
  keywords: 'biomedical waste, BMW, chain of custody, compliance, hospital waste management',
  robots: 'noindex, nofollow', // Internal permissioned platform
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
