import { useTheme } from '../context/ThemeContext.js';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className={`theme-toggle__option${theme === 'light' ? ' theme-toggle__option--active' : ''}`}
        aria-pressed={theme === 'light'}
        onClick={() => setTheme('light')}
      >
        <span className="theme-toggle__icon" aria-hidden>
          ☀
        </span>
        <span className="theme-toggle__label">Light</span>
      </button>
      <button
        type="button"
        className={`theme-toggle__option${theme === 'dark' ? ' theme-toggle__option--active' : ''}`}
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme('dark')}
      >
        <span className="theme-toggle__icon" aria-hidden>
          ☽
        </span>
        <span className="theme-toggle__label">Dark</span>
      </button>
    </div>
  );
}
