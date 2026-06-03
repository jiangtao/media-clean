import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ProgressHTMLAttributes,
  ReactNode,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '../lib';

type CardElement = 'article' | 'aside' | 'div' | 'section';

export function Card({
  as = 'section',
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: CardElement }) {
  const Component = as;
  return <Component className={cn('mc-card', className)} {...props} />;
}

export function Badge({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'amber' | 'blue' | 'green' }) {
  return <span className={cn('mc-badge', tone, className)} {...props} />;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: 'compact';
  variant?: 'danger' | 'primary' | 'secondary';
}>(function Button({
  variant = 'secondary',
  size,
  active,
  className,
  ...props
}, ref) {
  return <button ref={ref} className={cn('mc-button', variant, size, active && 'active', className)} {...props} />;
});

export function IconButton({
  size,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'large'; children: ReactNode }) {
  return (
    <button className={cn('icon-button', size, className)} {...props}>
      {children}
    </button>
  );
}

export function Progress({ className, ...props }: ProgressHTMLAttributes<HTMLProgressElement>) {
  return <progress className={cn('progress', className)} {...props} />;
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton-card', className)} {...props} />;
}
