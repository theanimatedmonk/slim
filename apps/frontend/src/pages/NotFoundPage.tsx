import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../lib/analytics';
import './NotFoundPage.css';

export default function NotFoundPage() {
  useEffect(() => {
    track('404 Viewed');
  }, []);
  return (
    <div className="not-found">
      <section className="not-found__hero">
        <p className="not-found__code" aria-hidden>
          4<span className="not-found__code-accent">0</span>4
        </p>
        <h1 className="not-found__headline">
          This page got <span className="not-found__headline-accent">optimised away.</span>
        </h1>
        <p className="not-found__subhead">
          We squeeze out the bytes that don&apos;t belong — looks like this URL was one of them.
          The page you&apos;re after doesn&apos;t exist or has moved.
        </p>
        <Link to="/" className="not-found__cta">
          Back to home
        </Link>
      </section>
    </div>
  );
}
