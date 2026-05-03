'use client';

import { ButtonHTMLAttributes } from 'react';

type ReloadButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

export function ReloadButton({ className, children, ...props }: ReloadButtonProps) {
  return (
    <button
      {...props}
      className={className}
      onClick={() => window.location.reload()}
    >
      {children}
    </button>
  );
}
