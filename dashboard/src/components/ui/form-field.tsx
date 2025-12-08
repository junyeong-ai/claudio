'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, hint, className, children }: FormFieldProps) {
  const id = React.useId();

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {React.isValidElement(children) &&
        React.cloneElement(children as React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
          id,
          'aria-invalid': !!error,
          'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
        })}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

interface InputFieldProps extends React.ComponentProps<typeof Input> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

function InputField({ label, required, error, hint, className, ...props }: InputFieldProps) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <Input className={cn(error && 'border-destructive', className)} {...props} />
    </FormField>
  );
}

interface TextareaFieldProps extends React.ComponentProps<typeof Textarea> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

function TextareaField({ label, required, error, hint, className, ...props }: TextareaFieldProps) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <Textarea className={cn(error && 'border-destructive', className)} {...props} />
    </FormField>
  );
}

export { FormField, InputField, TextareaField };
