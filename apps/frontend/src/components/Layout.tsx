import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface-elevated/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-sm">
              AO
            </span>
            Android Asset Optimiser
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              to="/"
              className={location.pathname === '/' ? 'text-brand-500' : 'text-gray-400 hover:text-white'}
            >
              Home
            </Link>
            <Link
              to="/workspace"
              className={
                location.pathname === '/workspace'
                  ? 'text-brand-500'
                  : 'text-gray-400 hover:text-white'
              }
            >
              Workspace
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
