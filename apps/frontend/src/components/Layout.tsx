import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.js';
import GoogleSignInButton from './GoogleSignInButton';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import './Layout.css';

const HEADER_LOGO = '/landing/other/header-logo.svg';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-inner">
          <Link to="/" className="layout__brand">
            <img src={HEADER_LOGO} alt="" className="layout__logo" width={40} height={40} />
            <span className="layout__brand-name">Slim</span>
          </Link>
          <div className="layout__actions">
            {!loading && (
              <div className="layout__auth">
                {user ? (
                  <UserMenu user={user} onSignOut={signOut} />
                ) : (
                  <GoogleSignInButton variant="outline" onClick={() => signInWithGoogle()} />
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="layout__main">{children}</main>
      <ThemeToggle />
    </div>
  );
}
