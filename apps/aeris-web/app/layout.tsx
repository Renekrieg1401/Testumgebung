import type { Metadata, Viewport } from 'next';
import type { JSX, ReactNode } from 'react';
import { Providers } from './providers';
import { ServiceWorkerRegistration } from '../components/ServiceWorkerRegistration';
import './globals.css';

export const metadata: Metadata = {
  title: 'AERIS — Begleiter für pflegende Angehörige',
  description:
    'AERIS unterstützt pflegende Angehörige mit verschlüsselten Selbsteinschätzungen. Alle Daten werden ausschließlich auf dem Gerät entschlüsselt.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3d5a6c',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="de">
      <body>
        <a href="#app" className="skip-link">
          Zum Inhalt springen
        </a>
        <header className="appbar">
          <span className="brand">AERIS</span>
        </header>
        <div id="app">
          <Providers>{children}</Providers>
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
