'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/button';
import { useRealtime } from '@/hooks/realtime';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMe } from '@/providers/auth-provider';
import { cn } from '@/lib/cn';
import { Header } from './header';
import { Sidebar } from './sidebar';

const COLLAPSE_KEY = 'pt.sidebar.collapsed';

/**
 * Kerangka aplikasi Stitch: sidebar fixed + header sticky + canvas `bg-surface`.
 * Breakpoint Kinetic Slate: ≥1280 sidebar penuh (bisa diciutkan), 768–1279 icon rail, <768 drawer.
 */
/** Sinkron realtime (SSE) untuk workspace aktif. */
function RealtimeBridge() {
  const workspace = useWorkspace();
  const { user } = useMe();
  useRealtime(workspace.id, user.id);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // storage tidak tersedia (private mode) — pakai default.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // abaikan
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <RealtimeBridge />
      {/* Rail (tablet, atau desktop saat diciutkan) */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden w-16 flex-col bg-surface-container-low shadow-chrome md:flex',
          !collapsed && 'xl:hidden',
        )}
      >
        <Sidebar variant="rail" />
        <div className="hidden justify-center pb-gutter xl:flex">
          <IconButton icon="left_panel_open" label="Expand sidebar" onClick={toggleCollapsed} />
        </div>
      </aside>

      {/* Sidebar penuh (desktop) */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-surface-container-low shadow-chrome',
          !collapsed && 'xl:flex',
        )}
      >
        <Sidebar variant="full" />
        <div className="flex justify-end px-gutter pb-gutter">
          <IconButton icon="left_panel_close" label="Collapse sidebar" size="sm" onClick={toggleCollapsed} />
        </div>
      </aside>

      {/* Drawer (mobile) */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-inverse-surface/40 backdrop-blur-[3px] md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-[61] flex w-64 flex-col bg-surface-container-low shadow-level-3 focus:outline-none md:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Workspace navigation menu</Dialog.Description>
            <Sidebar variant="full" onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className={cn('md:pl-16', !collapsed && 'xl:pl-64')}>
        <Header onOpenMenu={() => setMobileOpen(true)} />
        <main className="min-h-[calc(100vh-4rem)] w-full bg-surface px-gutter py-gutter-md md:px-gutter-lg">{children}</main>
      </div>
    </div>
  );
}
