import Link from 'next/link';
import { ProjectStatusBadge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { daysFromToday, shortDate } from '@/lib/format';
import type { Project } from '@/lib/types';

/**
 * Baris list (Kinetic Slate › Lists & Backlog Rows): full-width, divider hairline,
 * hover `bg-[#F8FAFC]`, key `code-inline` → judul `body-md` → meta.
 */
export function ProjectRow({ project, href }: { project: Project; href: string }) {
  const { stats } = project;
  const overdueTarget =
    project.targetDate && project.status !== 'completed' && daysFromToday(project.targetDate) < 0;

  return (
    <Link
      href={href}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-space-lg gap-y-2 px-space-md py-space-md transition-colors hover:bg-[#f8fafc] sm:grid-cols-[minmax(0,1fr)_140px_96px_104px] 2xl:grid-cols-[minmax(0,1fr)_200px_96px_104px]"
    >
      <div className="flex min-w-0 items-center gap-space-md">
        <span className="w-14 shrink-0 font-mono text-code-inline text-outline transition-colors group-hover:text-primary">
          {project.keyPrefix}
        </span>
        <div className="min-w-0">
          <p className="truncate text-body-md font-medium text-on-surface transition-colors group-hover:text-primary">
            {project.name}
          </p>
          <p className="truncate text-body-sm text-on-surface-variant">
            {stats.totalTasks} tasks
            {stats.overdueTasks > 0 && <span className="text-error"> · {stats.overdueTasks} overdue</span>}
          </p>
        </div>
      </div>

      <div className="order-last col-span-2 flex items-center gap-space-sm sm:order-none sm:col-span-1">
        <ProgressBar value={stats.completionRate} tone={stats.completionRate === 100 ? 'success' : 'primary'} label={`${project.name} completion`} />
        <span className="tabular w-9 shrink-0 text-right text-label-sm text-on-surface-variant">{stats.completionRate}%</span>
      </div>

      <div className={cn('hidden items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] sm:flex', overdueTarget ? 'text-error' : 'text-outline')}>
        <Icon name="event" size={15} />
        {project.targetDate ? shortDate(project.targetDate) : 'No target'}
      </div>

      <div className="flex justify-end">
        <ProjectStatusBadge status={project.status} />
      </div>
    </Link>
  );
}

export function ProjectRowSkeleton() {
  return (
    <div className="flex items-center gap-space-lg px-space-md py-space-md">
      <Skeleton className="h-4 w-12" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="hidden h-1.5 w-40 sm:block" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}
