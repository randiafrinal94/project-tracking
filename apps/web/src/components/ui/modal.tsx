'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './button';

/**
 * Modal Level 3 (Kinetic Slate): scrim `inverse-surface/40` + blur, panel putih
 * `rounded-2xl` dengan shadow modal Stitch.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-inverse-surface/40 backdrop-blur-[3px]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[12vh] z-[91] flex max-h-[80vh] w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden',
            'rounded-2xl bg-surface-container-lowest shadow-modal focus:outline-none',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-space-md px-space-xl pb-space-md pt-space-lg">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-headline-md text-on-surface">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-body-sm text-on-surface-variant">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton
                icon="close"
                label="Close"
                size="sm"
                className="hover:bg-error-container hover:text-on-error-container"
              />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-space-xl pb-space-lg">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low px-space-xl py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
