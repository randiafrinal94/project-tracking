'use client';

import { Suspense, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { TaskModalHost, useTaskParam } from '@/components/task/task-modal-host';
import { CrossProjectBoard } from '@/components/tasks/cross-project-board';
import { WorkspaceTaskFilters } from '@/components/tasks/workspace-task-filters';
import { ButtonLink } from '@/components/ui/button';
import { useProjects } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import type { TaskFilters } from '@/lib/types';

function KanbanPage() {
  const workspace = useWorkspace();
  const projects = useProjects(workspace.id);
  const { open } = useTaskParam();
  const [filters, setFilters] = useState<TaskFilters>({ assigneeId: 'me' });

  return (
    <div className="flex flex-col">
      <PageHeader
        icon="view_kanban"
        title="Kanban"
        meta={<span>Status board across all projects. Drag a card to change its status; order within a column follows each project.</span>}
        actions={
          <ButtonLink href={`/${workspace.slug}/tasks`} icon="list_alt">
            List
          </ButtonLink>
        }
      >
        <WorkspaceTaskFilters filters={filters} onChange={setFilters} projects={projects.data ?? []} showStatus={false} />
      </PageHeader>
      <CrossProjectBoard workspaceId={workspace.id} filters={filters} canEdit={workspace.can('member')} onOpen={(t) => open(t)} />
      <TaskModalHost />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <KanbanPage />
    </Suspense>
  );
}
