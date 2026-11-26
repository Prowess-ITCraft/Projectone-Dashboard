import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useActor } from '@/app/actor';
import { homeFor } from '@/app/navigation';
import { ErrorState, Icon, LoadingState, PageHead, TabNav } from '@/components';
import { useApiQuery } from '@/data/api';
import ChecklistTab from './ChecklistTab';
import WorkLinesTab from './WorkLinesTab';

/*
  A project as an engineer sees it: the header (project number and customer name) and two tabs, Order lines and
  Checklist, opening on Checklist. The data comes from one server call that carries only these two things, so nothing
  else about the project is on the screen or in the response.
*/
export default function EngineerProjectPage() {
  const { id } = useParams();
  const { actor } = useActor();
  const { data, error, loading, reload } = useApiQuery((api) => api.getWork(id), [id]);

  if (loading) return <LoadingState label="Opening the project" />;
  if (error) {
    return <ErrorState title="This project could not be opened" message={error.message} onRetry={reload} />;
  }

  const { project, lines } = data;
  const base = `/projects/${project.id}`;
  const tabs = [
    { to: `${base}/lines`, label: 'Order lines', count: lines.length },
    { to: `${base}/checklist`, label: 'Checklist' },
  ];

  return (
    <>
      <Link to={homeFor(actor)} className="back">
        <Icon name="ArrowLeft" size={14} />
        My work
      </Link>
      <PageHead title={project.customerName || 'Project'} sub={project.number} />
      <TabNav items={tabs} label="Project sections" />
      <Routes>
        <Route path="lines" element={<WorkLinesTab lines={lines} />} />
        <Route path="checklist" element={<ChecklistTab projectId={project.id} />} />
        <Route path="*" element={<Navigate to={`${base}/checklist`} replace />} />
      </Routes>
    </>
  );
}
