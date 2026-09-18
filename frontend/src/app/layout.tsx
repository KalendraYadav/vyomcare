import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'VyomCare — National Biomedical Waste Oversight System',
  description: 'Authoritative chain-of-custody tracking and regulatory compliance oversight platform for healthcare facilities, hazardous transport fleets, and state pollution control authorities.',
  keywords: 'biomedical waste, BMW rules 2016, chain of custody, compliance, CPCB, MPCB, hospital waste management, healthcare logistics',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
