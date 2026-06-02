import { useEffect, useState } from 'react';
import Icon from './Icon';
import './ConfirmModal.css';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = 'Delete file',
  message,
  confirmLabel = 'Yes, Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [displayMessage, setDisplayMessage] = useState(message);
  const [displayTitle, setDisplayTitle] = useState(title);

  useEffect(() => {
    if (open) {
      setDisplayMessage(message);
      setDisplayTitle(title);
      setVisible(true);
      setIsClosing(false);
      setIsEntering(true);
      return;
    }

    if (visible) {
      setIsClosing(true);
    }
  }, [open, message, title, visible]);

  useEffect(() => {
    if (!visible || isClosing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beginClose(onCancel);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, isClosing, onCancel]);

  useEffect(() => {
    if (!isClosing) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) return;

    finishClose();
  }, [isClosing]);

  const beginClose = (callback: () => void) => {
    if (isClosing) return;
    setIsClosing(true);
    callback();
  };

  const finishClose = () => {
    setVisible(false);
    setIsClosing(false);
    setIsEntering(false);
  };

  const handlePanelAnimationEnd = (e: React.AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;

    if (isClosing && e.animationName === 'confirm-modal-out') {
      finishClose();
      return;
    }

    if (isEntering && e.animationName === 'confirm-modal-in') {
      setIsEntering(false);
    }
  };

  const handleOverlayAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (isClosing && e.animationName === 'confirm-modal-overlay-out') {
      finishClose();
    }
  };

  if (!visible) return null;

  const overlayClass = [
    'confirm-modal__overlay',
    isEntering && 'confirm-modal__overlay--open',
    isClosing && 'confirm-modal__overlay--closing',
  ]
    .filter(Boolean)
    .join(' ');

  const panelClass = [
    'confirm-modal',
    isEntering && 'confirm-modal--open',
    isClosing && 'confirm-modal--closing',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={overlayClass}
        onClick={() => beginClose(onCancel)}
        onAnimationEnd={handleOverlayAnimationEnd}
        aria-hidden
      />
      <div
        className={panelClass}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        onAnimationEnd={handlePanelAnimationEnd}
      >
        <div className="confirm-modal__header">
          <h2 id="confirm-modal-title" className="confirm-modal__title">
            {displayTitle}
          </h2>
          <button
            type="button"
            onClick={() => beginClose(onCancel)}
            className="confirm-modal__close"
            aria-label="Close"
          >
            <Icon size="md" viewBox="0 0 20 20" fill="currentColor" stroke="none">
              <path d="M10 11.7971L6.20972 15.5874C5.97011 15.827 5.66514 15.9468 5.29483 15.9468C4.92451 15.9468 4.61955 15.827 4.37993 15.5874C4.14031 15.3478 4.02051 15.0428 4.02051 14.6725C4.02051 14.3022 4.14031 13.9972 4.37993 13.7576L8.17021 9.96733L4.37993 6.20972C4.14031 5.97011 4.02051 5.66514 4.02051 5.29483C4.02051 4.92451 4.14031 4.61955 4.37993 4.37993C4.61955 4.14032 4.92451 4.02051 5.29483 4.02051C5.66514 4.02051 5.97011 4.14032 6.20972 4.37993L10 8.17021L13.7576 4.37993C13.9972 4.14032 14.3022 4.02051 14.6725 4.02051C15.0428 4.02051 15.3478 4.14032 15.5874 4.37993C15.8488 4.64133 15.9795 4.95196 15.9795 5.31182C15.9795 5.67168 15.8488 5.97098 15.5874 6.20972L11.7971 9.96733L15.5874 13.7576C15.827 13.9972 15.9468 14.3022 15.9468 14.6725C15.9468 15.0428 15.827 15.3478 15.5874 15.5874C15.326 15.8488 15.0158 15.9795 14.6568 15.9795C14.2978 15.9795 13.9981 15.8488 13.7576 15.5874L10 11.7971Z" />
            </Icon>
          </button>
        </div>

        <p id="confirm-modal-message" className="confirm-modal__message">
          {displayMessage}
        </p>

        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--cancel"
            onClick={() => beginClose(onCancel)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--confirm"
            onClick={() => beginClose(onConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
