'use client';

import React from 'react';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SUCCESS,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_EMERALD,
  SPINNER,
} from '@/lib/constants/styles';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'emerald';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  success: BTN_SUCCESS,
  danger: BTN_DANGER,
  outline: BTN_OUTLINE,
  emerald: BTN_EMERALD,
};

export default function Button({
  variant = 'primary',
  loading = false,
  loadingText,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClass = variantClasses[variant];

  return (
    <button
      className={`${baseClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <div className={SPINNER}></div>
          <span>{loadingText || children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
