import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Icon from './Icon';
import './UserMenu.css';

interface Props {
  user: User;
  onSignOut: () => void | Promise<void>;
}

function getDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName = meta?.full_name ?? meta?.name;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  const emailPrefix = user.email?.split('@')[0];
  if (!emailPrefix) return 'User';

  return emailPrefix
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase() || '?';
}

function getAvatarUrl(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const raw = meta?.avatar_url ?? meta?.picture;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return null;
}

function UserAvatar({
  name,
  photoUrl,
  size,
}: {
  name: string;
  photoUrl?: string | null;
  size: 'sm' | 'lg';
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = getInitial(name);
  const showImage = Boolean(photoUrl) && !imageFailed;

  return (
    <span className={`user-menu__avatar user-menu__avatar--${size}`} aria-hidden>
      {showImage ? (
        <img
          src={photoUrl!}
          alt=""
          className="user-menu__avatar-img"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

export default function UserMenu({ user, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const displayName = getDisplayName(user);
  const email = user.email ?? '';
  const photoUrl = getAvatarUrl(user);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  const handleSignOut = () => {
    close();
    void onSignOut();
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <UserAvatar name={displayName} photoUrl={photoUrl} size="sm" />
        <span className="user-menu__trigger-name">{displayName}</span>
      </button>

      {open && (
        <div id={menuId} className="user-menu__panel" role="menu">
          <div className="user-menu__profile">
            <UserAvatar name={displayName} photoUrl={photoUrl} size="lg" />
            <p className="user-menu__name">{displayName}</p>
            {email && <p className="user-menu__email">{email}</p>}
          </div>

          <div className="user-menu__divider" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="user-menu__item"
            onClick={handleSignOut}
          >
            <Icon size="sm" viewBox="0 0 20 20" fill="currentColor" stroke="none">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
               <path d="M9.66699 1.66699C10.039 1.66699 10.4073 1.74048 10.751 1.88281C11.0947 2.0252 11.4078 2.23397 11.6709 2.49707C11.9338 2.76005 12.1419 3.07248 12.2842 3.41602C12.4265 3.75967 12.5 4.12803 12.5 4.5V6.66699C12.5 6.88801 12.4121 7.09958 12.2559 7.25586C12.0996 7.41214 11.888 7.5 11.667 7.5C11.446 7.5 11.2344 7.41214 11.0781 7.25586C10.9218 7.09958 10.834 6.88801 10.834 6.66699V4.5C10.8339 4.19085 10.7107 3.89447 10.4922 3.67578C10.2734 3.45699 9.97641 3.33398 9.66699 3.33398H4.5C4.1907 3.33407 3.8945 3.45707 3.67578 3.67578C3.45707 3.8945 3.33407 4.1907 3.33398 4.5V15.5C3.33398 15.8094 3.45699 16.1064 3.67578 16.3252C3.89448 16.5438 4.19078 16.6669 4.5 16.667H9.66699C9.97641 16.667 10.2734 16.544 10.4922 16.3252C10.7109 16.1064 10.834 15.8093 10.834 15.5V13.334C10.834 13.113 10.9218 12.9004 11.0781 12.7441C11.2344 12.5881 11.4461 12.5 11.667 12.5C11.8879 12.5 12.0996 12.5881 12.2559 12.7441C12.4121 12.9004 12.5 13.113 12.5 13.334V15.5C12.5 16.2514 12.2021 16.9726 11.6709 17.5039C11.1395 18.0353 10.4184 18.334 9.66699 18.334H4.5C3.74875 18.3339 3.02833 18.0351 2.49707 17.5039C1.96572 16.9726 1.66699 16.2514 1.66699 15.5V4.5C1.66708 3.74867 1.96579 3.02835 2.49707 2.49707C3.02835 1.96579 3.74867 1.66708 4.5 1.66699H9.66699Z" fill="black"/>
               <path d="M15 6.66699C15.2209 6.66699 15.4326 6.75495 15.5889 6.91113L18.0889 9.41113C18.2451 9.56737 18.333 9.77908 18.333 10C18.333 10.2209 18.245 10.4326 18.0889 10.5889L15.5889 13.0889C15.4317 13.2407 15.2214 13.3251 15.0029 13.3232C14.7845 13.3213 14.5754 13.2336 14.4209 13.0791C14.2664 12.9246 14.1787 12.7155 14.1768 12.4971C14.1749 12.2786 14.2594 12.0683 14.4111 11.9111L15.4883 10.833H5.83301C5.61223 10.8329 5.40032 10.7459 5.24414 10.5898C5.08786 10.4336 5 10.221 5 10C5.00004 9.77908 5.08795 9.56737 5.24414 9.41113C5.40034 9.25493 5.61211 9.16708 5.83301 9.16699H15.4883L14.4111 8.08887C14.255 7.9326 14.167 7.72094 14.167 7.5C14.167 7.27908 14.2549 7.06737 14.4111 6.91113C14.5674 6.75495 14.7791 6.66699 15 6.66699Z" fill="black"/>
            </svg>
    
            </Icon>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
