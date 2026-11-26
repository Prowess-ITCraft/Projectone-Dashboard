import { useMemo } from 'react';
import { useActor } from '@/app/actor';
import { useApiQuery } from '@/data/api';
import { can } from '@/domain/permissions';

/*
  The active assignments a screen may show, grouped by project, and (for an Admin) the active engineers to choose
  from. An engineer's own list holds only their assignments; the server decides that.
*/
export function useEngineers() {
  const { actor } = useActor();
  const admin = can(actor, 'assign_engineers');
  const assignments = useApiQuery((a) => (a.listAssignments ? a.listAssignments() : Promise.resolve([])));
  const users = useApiQuery((a) => (admin && a.listUsers ? a.listUsers() : Promise.resolve([])), [admin]);

  return useMemo(() => {
    const byProject = new Map();
    (assignments.data ?? []).forEach((x) => {
      if (!byProject.has(x.projectId)) byProject.set(x.projectId, []);
      byProject.get(x.projectId).push(x);
    });
    const engineers = (users.data ?? [])
      .filter((u) => u.active && !can(u, 'view_all_projects'))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { byProject, engineers, assignments: assignments.data ?? [], loading: assignments.loading };
  }, [assignments.data, assignments.loading, users.data]);
}
