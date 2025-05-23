import { ReactNode } from 'react';
import Navbar, { NAVBAR_HEIGHT } from './Navbar';
import Footer from './Footer';
import RefreshWarnings from './RefreshWarnings';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <RefreshWarnings />
      <main 
        style={{ 
          paddingTop: `calc(${NAVBAR_HEIGHT}px + var(--warning-banner-height, 0px))` 
        }} 
        className="flex-1"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
} 