import type { Metadata } from 'next';
import { ExperienceLayer } from '@/components/experience-layer';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Administração | Felipe Almeida Developer',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="admin-root min-h-screen antialiased">
        <ExperienceLayer />
        {children}
      </body>
    </html>
  );
}
