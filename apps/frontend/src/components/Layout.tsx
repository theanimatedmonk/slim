import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.js';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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
          <div className="flex items-center gap-4">
            <nav className="flex gap-4 text-sm">
              <Link
                to="/"
                className={
                  location.pathname === '/'
                    ? 'text-brand-500'
                    : 'text-gray-400 hover:text-white'
                }
              >
                Home
              </Link>
              {user && (
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
              )}
            </nav>
            {!loading && (
              <div className="flex items-center gap-3 text-sm">
                {user ? (
                  <>
                    <span className="text-gray-400 hidden sm:inline truncate max-w-[160px]">
                      {user.email}
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-gray-400 hover:text-white"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    className="px-3 py-1.5 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100"
                  >
                    Sign in with Google
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
