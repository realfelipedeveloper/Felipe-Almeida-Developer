import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Administração | Felipe Almeida Developer',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
