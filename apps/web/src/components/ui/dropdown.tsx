'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cloneElement, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';

export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;

/** Menu Level 3 (Kinetic Slate › Elevation): putih, ring tipis, shadow overlay. */
export function DropdownContent({
  className,
  children,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[80] min-w-[220px] rounded-lg bg-surface-container-lowest p-1 shadow-level-3 ring-1 ring-surface-container',
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownItem({
  icon,
  shortcut,
  destructive,
  active,
  asChild,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  icon?: string;
  shortcut?: string;
  destructive?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  // Radix Slot butuh tepat satu elemen anak: sisipkan ikon/label ke dalam elemen tersebut.
  const content =
    asChild && isValidElement<{ children?: ReactNode }>(children) ? (
      cloneElement(children, undefined, <>
        {icon && <Icon name={icon} size={18} className="text-current opacity-80" />}
        {icon ? <span className="min-w-0 flex-1 truncate">{children.props.children}</span> : children.props.children}
        {shortcut && <span className="font-mono text-[11px] text-outline">{shortcut}</span>}
      </>)
    ) : (
      <>
        {icon && <Icon name={icon} size={18} className="text-current opacity-80" />}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {shortcut && <span className="font-mono text-[11px] text-outline">{shortcut}</span>}
      </>
    );

  return (
    <DropdownMenu.Item
      asChild={asChild}
      className={cn(
        'flex cursor-pointer select-none items-center gap-space-sm rounded-md px-space-sm py-1.5 text-label-md outline-none transition-colors',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive
          ? 'text-error data-[highlighted]:bg-error-container'
          : 'text-on-surface data-[highlighted]:bg-primary-fixed/40 data-[highlighted]:text-primary-container',
        active && 'bg-primary-fixed/40 text-primary-container',
        className,
      )}
      {...props}
    >
      {content}
    </DropdownMenu.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-space-sm pb-1 pt-1.5 text-label-sm tracking-wider text-on-surface-variant uppercase">
      {children}
    </DropdownMenu.Label>
  );
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-surface-container" />;
}
