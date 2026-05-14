import type { Metadata } from 'next';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Media Clean Report',
  description: 'Local Media Clean review workbench',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
