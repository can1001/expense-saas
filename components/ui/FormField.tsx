'use client';

import React from 'react';
import { LABEL_BASE, LABEL_REQUIRED, ERROR_MESSAGE } from '@/lib/constants/styles';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function FormField({
  label,
  error,
  required = false,
  children,
  className = '',
}: FormFieldProps) {
  const labelClass = required
    ? `${LABEL_BASE} ${LABEL_REQUIRED}`
    : LABEL_BASE;

  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className={ERROR_MESSAGE}>{error}</p>}
    </div>
  );
}
