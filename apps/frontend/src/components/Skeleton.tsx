import type { HTMLAttributes } from 'react';
import './Skeleton.css';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'pill' | 'circle';
}

export default function Skeleton({ variant = 'default', className = '', ...rest }: Props) {
  const variantClass =
    variant === 'pill' ? 'skeleton--pill' : variant === 'circle' ? 'skeleton--circle' : '';

  return (
    <div
      className={['skeleton', variantClass, className].filter(Boolean).join(' ')}
      aria-hidden
      {...rest}
    />
  );
}
