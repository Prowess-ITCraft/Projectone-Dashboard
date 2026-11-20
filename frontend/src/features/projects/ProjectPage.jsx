import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useActor } from '@/app/actor';
import { homeFor } from '@/app/navigation';
import { ErrorState, Icon, LoadingState, PageHead, StatusBadge, TabNav } from '@/components';
import { useApiQuery } from '@/data/api';
import { entryPathLabel, PROJECT_STATUS, statusOf } from '@/domain/projects';
import { can } from '@/domain/permissions';
import { PrismSuiteBadge } from '@/features/customers/PrismSuiteBadge';
import { ProjectEngineers } from './AssignEngineers';
import ChecklistTab from './ChecklistTab';
import { useEngineers } from './useEngineers';
import { formatDate } from './labels';
import OverviewTab from './OverviewTab';
import DocumentsTab from './DocumentsTab';
import LinesTab from './LinesTab';
import CoverageTab from './CoverageTab';
import ModulesTab from './ModulesTab';
import EngineerProjectPage from './EngineerProjectPage';

/* An engineer gets their own, much smaller page, and never loads the Admin project data */
export default function ProjectPage() {
  const { actor } = useActor();
  return can(actor, 'view_all_projects') ? <AdminProjectPage /> : <EngineerProjectPage />;
}

function AdminProjectPage() {
  const { id } = useParams();
  const { actor } = useActor();
  const { data, error, loading, reload } = useApiQuery((api) => api.getProject(id), [id]);
  const team = useEngineers();
  const allProjects = can(actor, 'view_all_projects');

  if (loading) return <LoadingState label="Opening the project" />;
  if (error) {
    return <ErrorState title="This project could not be opened" message={error.message} onRetry={reload} />;
  }

  const { project, customer, documents, lines, modules, audited } = data;
  const status = PROJECT_STATUS[statusOf(project)];
  const base = `/projects/${project.id}`;
  const tabs = [
    { to: base, label: 'Overview', end: true },
    { to: `${base}/documents`, label: 'Documents', count: documents.filter((d) => d.active).length },
    { to: `${base}/lines`, label: 'Order lines', count: lines.length },
    { to: `${base}/coverage`, label: 'Coverage' },
    { to: `${base}/modules`, label: 'Modules', count: modules.length },
    { to: `${base}/checklist`, label: 'Checklist' },
  ];

  return (
    <>
      <Link to={allProjects ? '/projects' : homeFor(actor)} className="back">
        <Icon name="ArrowLeft" size={14} />
        {allProjects ? 'All projects' : 'My work'}
      </Link>
      <PageHead
        title={customer?.name ?? 'Project'}
        sub={`${project.number}, ${project.entryPath ? entryPathLabel(project.entryPath) : 'entry path needed'}, created ${formatDate(new Date(project.createdAt).toISOString())}`}
      >
        <div className="head-badges">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {audited && <PrismSuiteBadge />}
        </div>
      </PageHead>
      <div className="project-team">
        <span className="project-team-label">Engineers</span>
        <ProjectEngineers
          project={project}
          customerName={customer?.name}
          assigned={team.byProject.get(project.id) ?? []}
          engineers={team.engineers}
        />
      </div>
      <TabNav items={tabs} label="Project sections" />

      <Routes>
        <Route index element={<OverviewTab snapshot={data} />} />
        <Route path="documents" element={<DocumentsTab snapshot={data} />} />
        <Route path="lines" element={<LinesTab snapshot={data} />} />
        <Route path="coverage" element={<CoverageTab snapshot={data} />} />
        <Route path="modules" element={<ModulesTab snapshot={data} />} />
        <Route path="checklist" element={<ChecklistTab snapshot={data} />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </>
  );
}
