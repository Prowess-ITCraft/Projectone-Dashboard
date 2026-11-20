/*
  The account, assignment, alert and checklist calls of the Project One API, in memory, added to a local api for
  component tests. The real rules (who may see what, who is notified) are enforced and tested on the server; this
  fake only answers the way the server does so the screens can be exercised.
*/
let seq = 0;
const id = (prefix) => `${prefix}-${++seq}`;

export function withServer(api, { users = [], me = null, notifications = [], steps = {}, lines = {}, passwords = {} } = {}) {
  const state = {
    users: users.map((u) => ({ active: true, mustChangePassword: false, lastLoginAt: null, createdAt: 0, ...u })),
    assignments: [],
    notifications: notifications.map((n) => ({ read: false, createdAt: 0, ...n })),
    steps,
    lines,
    passwords: { ...passwords },
    me,
    calls: [],
  };
  const authListeners = new Set();
  const changed = (value) => {
    api.changed();
    return value;
  };
  const fail = (message, code = 'invalid_request', status = 400) => {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    throw error;
  };
  const session = (u) =>
    u && { id: u.id, email: u.email, name: u.name, role: u.role, actions: [], mustChangePassword: u.mustChangePassword };
  const find = (projectId, stepId) => (state.steps[projectId] ?? []).find((x) => x.id === stepId);
  const LIMITS = {
    maxBytes: 10 * 1024 * 1024,
    maxFiles: 5,
    accepted: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf'],
    acceptedText: 'JPG, PNG, HEIC or PDF',
  };
  const checklistOf = (projectId) => {
    const order = [...(state.steps[projectId] ?? [])].sort(
      (a, b) =>
        ['installation', 'configuration'].indexOf(a.phase) - ['installation', 'configuration'].indexOf(b.phase) || a.position - b.position,
    );
    return {
      limits: LIMITS,
      steps: order.map((s, i) => {
        const locked = i > 0 && order[i - 1].state !== 'complete';
        return { ...s, done: s.state === 'complete', locked, lockedReason: locked ? `Complete step ${i} first` : null };
      }),
    };
  };
  const nameOf = (userId) => state.users.find((u) => u.id === userId)?.name ?? '';

  Object.assign(api, {
    server: state,
    onAuthProblem(listener) {
      authListeners.add(listener);
      return () => authListeners.delete(listener);
    },
    endSession: (code = 'session_expired') => authListeners.forEach((l) => l({ code })),
    getMe: async () => session(state.me),
    async signIn(email, password) {
      state.calls.push(['signIn', email]);
      const user = state.users.find((u) => u.email === email.toLowerCase());
      if (!user || !user.active || state.passwords[user.email] !== password) {
        fail('That email and password do not match.', 'invalid_credentials', 401);
      }
      state.me = user;
      return session(user);
    },
    signOut: async () => {
      state.me = null;
    },
    async changePassword(current, next) {
      if (state.passwords[state.me.email] !== current) fail('The current password is not right.', 'wrong_password');
      state.passwords[state.me.email] = next;
      state.me.mustChangePassword = false;
      return session(state.me);
    },

    listUsers: async () => state.users.map((u) => ({ ...u })),
    addEngineer: async ({ name, email }) => {
      if (state.users.some((u) => u.email === email.toLowerCase())) fail('An account with this email already exists.', 'email_taken', 409);
      const user = {
        id: id('u'),
        name,
        email: email.toLowerCase(),
        role: 'engineer',
        active: true,
        mustChangePassword: true,
        passwordIsDefault: true,
      };
      state.users.push(user);
      return changed({ user: { ...user }, password: 'Starter-Password-1' });
    },
    resetPassword: async (userId) => {
      const user = state.users.find((u) => u.id === userId);
      user.mustChangePassword = true;
      user.passwordIsDefault = true;
      return changed({ user: { ...user }, password: 'Starter-Password-1' });
    },
    getLoginDetails: async (userId) => {
      const user = state.users.find((u) => u.id === userId);
      state.calls.push(['getLoginDetails', userId]);
      if (!user.passwordIsDefault) fail('This engineer has chosen their own password.', 'no_default_password', 409);
      return { email: user.email, password: 'Starter-Password-1' };
    },
    setUserActive: async (userId, active) => {
      const user = state.users.find((u) => u.id === userId);
      user.active = active;
      return changed({ ...user });
    },

    listAssignments: async () =>
      state.assignments.filter((a) => !state.me || state.me.role === 'admin' || a.engineerId === state.me.id).map((a) => ({ ...a })),
    async setProjectEngineers(projectId, engineerIds) {
      state.calls.push(['setProjectEngineers', projectId, [...engineerIds]]);
      const before = state.assignments.filter((a) => a.projectId === projectId).map((a) => a.engineerId);
      state.assignments = state.assignments.filter((a) => a.projectId !== projectId || engineerIds.includes(a.engineerId));
      engineerIds
        .filter((e) => !before.includes(e))
        .forEach((engineerId) =>
          state.assignments.push({ projectId, engineerId, name: nameOf(engineerId), email: '', assignedAt: Date.now() }),
        );
      return changed(state.assignments.filter((a) => a.projectId === projectId));
    },
    async removeProjectEngineer(projectId, engineerId) {
      state.calls.push(['removeProjectEngineer', projectId, engineerId]);
      state.assignments = state.assignments.filter((a) => !(a.projectId === projectId && a.engineerId === engineerId));
      return changed(null);
    },
    assign(projectId, engineerId, assignedAt = Date.now()) {
      state.assignments.push({ projectId, engineerId, name: nameOf(engineerId), email: '', assignedAt });
    },

    async listNotifications() {
      const mine = state.notifications.filter((n) => !state.me || !n.userId || n.userId === state.me.id);
      return { unread: mine.filter((n) => !n.read).length, items: [...mine].sort((a, b) => b.createdAt - a.createdAt) };
    },
    async markNotificationRead(notificationId) {
      const n = state.notifications.find((x) => x.id === notificationId);
      n.read = true;
      return changed({ ...n });
    },
    async markAllNotificationsRead() {
      state.notifications.forEach((n) => {
        n.read = true;
      });
      return changed(null);
    },

    /* An engineer's view and the checklist, answering as the server does (its rules are tested on the server) */
    async listMyProjects() {
      const mine = state.assignments.filter((a) => state.me && a.engineerId === state.me.id).sort((a, b) => b.assignedAt - a.assignedAt);
      return Promise.all(
        mine.map(async (a) => {
          const { project, customer } = await api.getProject(a.projectId);
          const steps = state.steps[a.projectId] ?? [];
          return {
            id: project.id,
            number: project.number,
            customerName: customer?.name ?? '',
            assignedAt: a.assignedAt,
            stepCount: steps.length,
            stepsDone: steps.filter((x) => x.state === 'complete').length,
          };
        }),
      );
    },
    async getWork(projectId) {
      state.calls.push(['getWork', projectId]);
      const { project, customer } = await api.getProject(projectId);
      return {
        project: { id: project.id, number: project.number, customerName: customer?.name ?? '' },
        lines: state.lines[projectId] ?? [],
        ...checklistOf(projectId),
      };
    },
    getChecklist: async (projectId) => checklistOf(projectId),
    addStep(projectId, step) {
      const list = (state.steps[projectId] ??= []);
      list.push({
        id: id('s'),
        phase: 'installation',
        position: list.length + 1,
        title: `Step ${list.length + 1}`,
        state: 'pending',
        progress: 0,
        startDate: null,
        endDate: null,
        evidence: [],
        comments: [],
        ...step,
      });
      return list.at(-1);
    },
    async completeStep(projectId, stepId) {
      state.calls.push(['completeStep', projectId, stepId]);
      const step = find(projectId, stepId);
      if (checklistOf(projectId).steps.find((x) => x.id === stepId).locked) fail('This step is locked.', 'step_locked', 409);
      if (step.state === 'pending') step.state = 'awaiting_evidence';
      else if (step.state === 'awaiting_evidence') {
        if (!step.evidence.length) fail('Upload at least one evidence file to complete this step.', 'evidence_required', 409);
        step.state = 'complete';
        step.progress = 100;
      }
      return changed(null);
    },
    async untickStep(projectId, stepId) {
      state.calls.push(['untickStep', projectId, stepId]);
      const step = find(projectId, stepId);
      if (step.state === 'complete') fail('A complete step cannot be undone.', 'forbidden', 403);
      step.state = 'pending';
      step.evidence = [];
      return changed(null);
    },
    async addEvidence(projectId, stepId, file) {
      state.calls.push(['addEvidence', projectId, stepId, file.name]);
      const step = find(projectId, stepId);
      step.evidence.push({
        id: id('ev'),
        name: file.name,
        mediaType: file.type || 'image/png',
        size: file.size,
        uploadedByName: state.me?.name ?? '',
        uploadedAt: Date.now(),
        canRemove: true,
      });
      return changed(null);
    },
    async removeEvidence(projectId, stepId, evidenceId) {
      state.calls.push(['removeEvidence', projectId, stepId, evidenceId]);
      const step = find(projectId, stepId);
      step.evidence = step.evidence.filter((e) => e.id !== evidenceId);
      return changed(null);
    },
    async addStepComment(projectId, stepId, body) {
      state.calls.push(['addStepComment', projectId, stepId, body]);
      find(projectId, stepId).comments.push({ id: id('c'), body, authorName: state.me?.name ?? '', createdAt: Date.now() });
      return changed(null);
    },
    getEvidenceBlob: async () => new Blob(['x'], { type: 'image/png' }),
  });
  return api;
}
