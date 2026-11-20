import { createLocalApi } from '@/data/local/localApi';
import { createClient } from './client';
import { createRemoteStorage } from './remoteStorage';

/* The API's snake_case records as the camelCase the screens use */
const toSession = (me) =>
  me && {
    id: me.id,
    email: me.email,
    name: me.full_name,
    role: me.role,
    actions: me.actions,
    mustChangePassword: me.must_change_password,
  };
const toUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.full_name,
  role: u.role,
  active: u.is_active,
  mustChangePassword: u.must_change_password,
  passwordIsDefault: u.password_is_default,
  createdAt: Date.parse(u.created_at),
  lastLoginAt: u.last_login_at ? Date.parse(u.last_login_at) : null,
});
const toAssignment = (a) => ({
  projectId: a.project_id,
  engineerId: a.engineer_id,
  name: a.full_name,
  email: a.email,
  assignedAt: Date.parse(a.assigned_at),
});
const toNotification = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  projectId: n.project_id,
  read: n.is_read,
  createdAt: Date.parse(n.created_at),
});
const toEvidence = (e) => ({
  id: e.id,
  name: e.name,
  mediaType: e.media_type,
  size: e.size,
  uploadedByName: e.uploaded_by_name,
  uploadedAt: Date.parse(e.uploaded_at),
  canRemove: e.can_remove,
});
const toComment = (c) => ({ id: c.id, body: c.body, authorName: c.author_name, createdAt: Date.parse(c.created_at) });
const toStep = (s) => ({
  id: s.id,
  phase: s.phase,
  position: s.position,
  title: s.title,
  state: s.state,
  done: s.done,
  locked: s.locked,
  lockedReason: s.locked_reason,
  startDate: s.start_date,
  endDate: s.end_date,
  progress: s.progress,
  evidence: s.evidence.map(toEvidence),
  comments: s.comments.map(toComment),
});
const toLimits = (l) => ({ maxBytes: l.max_bytes, maxFiles: l.max_files, accepted: l.accepted, acceptedText: l.accepted_text });
const toChecklist = (c) => ({ limits: toLimits(c.limits), steps: c.steps.map(toStep) });

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/*
  ProjectOneApi on the Project One API. The intake rules still run in the shared data layer (localApi), now saving to
  the server through the remote storage; accounts, assignments, alerts and checklist steps are server calls. Screens
  see one object with the same methods as before plus these.
*/
export function createHttpApi({ fixtures, baseUrl = '/api', fetchImpl } = {}) {
  const authListeners = new Set();
  const client = createClient({
    baseUrl,
    fetchImpl,
    onAuthProblem: (error) => authListeners.forEach((l) => l(error)),
  });
  const storage = createRemoteStorage(client);
  const api = createLocalApi({ storage, fixtures });

  // a server-side change: tell every open screen to read again
  const changed = async (promise) => {
    const result = await promise;
    storage.forget();
    api.changed();
    return result;
  };

  return Object.assign(api, {
    onAuthProblem(listener) {
      authListeners.add(listener);
      return () => authListeners.delete(listener);
    },

    async getMe() {
      try {
        return toSession(await client.get('/me'));
      } catch (error) {
        if (error.status === 401) return null;
        throw error;
      }
    },
    signIn: async (email, password) => toSession(await client.post('/auth/login', { email, password })),
    signOut: async () => {
      storage.forget();
      await client.post('/auth/logout');
    },
    changePassword: async (currentPassword, newPassword) =>
      toSession(await client.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword })),

    listUsers: async () => (await client.get('/users')).map(toUser),
    addEngineer: ({ name, email }) =>
      changed(client.post('/users', { full_name: name, email }).then((r) => ({ user: toUser(r.user), password: r.temporary_password }))),
    resetPassword: (userId) =>
      changed(client.post(`/users/${userId}/reset-password`).then((r) => ({ user: toUser(r.user), password: r.temporary_password }))),
    getLoginDetails: async (userId) => {
      const r = await client.get(`/users/${userId}/login-details`);
      return { email: r.email, password: r.password };
    },
    setUserActive: (userId, active) => changed(client.post(`/users/${userId}/${active ? 'activate' : 'deactivate'}`).then(toUser)),

    listAssignments: async () => (await client.get('/assignments')).map(toAssignment),
    setProjectEngineers: (projectId, engineerIds) =>
      changed(client.put(`/projects/${projectId}/assignments`, { engineer_ids: engineerIds }).then((rows) => rows.map(toAssignment))),
    removeProjectEngineer: (projectId, engineerId) => changed(client.delete(`/projects/${projectId}/assignments/${engineerId}`)),

    async listNotifications({ background = false } = {}) {
      const { unread_count: unread, items } = await client.get('/notifications', { background });
      return { unread, items: items.map(toNotification) };
    },
    markNotificationRead: (id) => changed(client.post(`/notifications/${id}/read`).then(toNotification)),
    markAllNotificationsRead: () => changed(client.post('/notifications/read-all')),

    /* An engineer's side of the work: their projects, and inside one the order lines and checklist, nothing else */
    listMyProjects: async () =>
      (await client.get('/my/projects')).map((p) => ({
        id: p.id,
        number: p.number,
        customerName: p.customer_name,
        assignedAt: Date.parse(p.assigned_at),
        stepCount: p.step_count,
        stepsDone: p.steps_done,
      })),
    getWork: async (projectId) => {
      const w = await client.get(`/projects/${projectId}/work`);
      return {
        project: { id: w.project.id, number: w.project.number, customerName: w.project.customer_name },
        lines: w.lines,
        ...toChecklist(w),
      };
    },

    getChecklist: async (projectId) => toChecklist(await client.get(`/projects/${projectId}/checklist`)),
    completeStep: (projectId, stepId) => changed(client.post(`/projects/${projectId}/checklist/steps/${stepId}/complete`)),
    untickStep: (projectId, stepId) => changed(client.post(`/projects/${projectId}/checklist/steps/${stepId}/untick`)),
    addEvidence: async (projectId, stepId, file) =>
      changed(
        client.post(`/projects/${projectId}/checklist/steps/${stepId}/evidence`, { name: file.name, content: await fileToBase64(file) }),
      ),
    removeEvidence: (projectId, stepId, evidenceId) =>
      changed(client.delete(`/projects/${projectId}/checklist/steps/${stepId}/evidence/${evidenceId}`)),
    addStepComment: (projectId, stepId, body) =>
      changed(client.post(`/projects/${projectId}/checklist/steps/${stepId}/comments`, { body })),
    getEvidenceBlob: async (projectId, evidenceId) =>
      (await client.raw(`/projects/${projectId}/checklist/evidence/${evidenceId}/content`)).blob(),
  });
}
