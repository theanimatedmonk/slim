import type { ReactElement } from 'react';
import './Tooltip.css';

interface Props {
  label: string;
  children: ReactElement;
}

export default function Tooltip({ label, children }: Props) {
  return (
    <span className="tooltip">
      {children}
      <span className="tooltip__label" role="tooltip">
        {label}
      </span>
    </span>
  );
}
