import type { Metadata } from 'next';
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react/ssr';
import { getComponentChunkLinks, getFontLinks } from '@porsche-design-system/components-react/partials';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tic-Tac-Toe Lab',
  description: 'Four game modes and a minimax opponent, built on the Porsche Design System.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="scheme-light-dark">
      <head>
        {getComponentChunkLinks({ format: 'jsx' })}
        {getFontLinks({ format: 'jsx' })}
      </head>
      <body>
        <PorscheDesignSystemProvider>{children}</PorscheDesignSystemProvider>
      </body>
    </html>
  );
}
