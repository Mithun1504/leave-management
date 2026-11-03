(() => {
  'use strict';

  const TOKEN_KEY = 'leaveDesk.accessToken';
  const app = document.getElementById('app');
  const LOGIN_MARKUP = `
    <section class="login-layout">
      <div class="login-copy">
        <p class="eyebrow">LEAVE MANAGEMENT</p>
        <h1>Make room for time away.</h1>
        <p class="muted">Sign in to manage leave requests, decisions, and balances.</p>
        <div class="login-decoration" aria-hidden="true">
          <div class="calendar-card"><span class="calendar-day">MON</span><strong>12</strong><span class="calendar-line"></span><span class="calendar-line short"></span></div>
          <span class="decoration-dot dot-one"></span><span class="decoration-dot dot-two"></span>
        </div>
      </div>
      <section class="panel login-panel" aria-labelledby="login-title">
        <div class="panel-heading"><p class="eyebrow">WELCOME BACK</p><h2 id="login-title">Sign in</h2><p class="muted">Use your work account to continue.</p></div>
        <form id="login-form" class="form-stack">
          <label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="username" required>
          <label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required>
          <p class="feedback" data-feedback role="alert" hidden></p>
          <button class="button button-primary" type="submit"><span>Sign in</span><span aria-hidden="true">→</span></button>
          <p class="loading-note" data-loading role="status" aria-live="polite" hidden>Signing you in…</p>
        </form>
      </section>
    </section>`;

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, options = {}) {
    const headers = { Accept: 'application/json' };
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem(TOKEN_KEY);
      throw new ApiError(
        data?.error?.message || `Request failed (${response.status})`,
        response.status,
        data?.error?.code
      );
    }
    return data;
  }

  async function resolveRole() {
    try {
      return { role: 'employee', initialData: await api('/api/leave/balances') };
    } catch (error) {
      if (error.status !== 403) throw error;
    }

    try {
      return { role: 'manager', initialData: await api('/api/leave/requests') };
    } catch (error) {
      if (error.status !== 403) throw error;
    }

    try {
      await api('/api/users', { method: 'POST', body: {} });
    } catch (error) {
      if (error.status === 400) return { role: 'admin', initialData: null };
      throw error;
    }
    throw new Error('Unable to determine this account’s role.');
  }

  function setLoading(loading) {
    document.querySelectorAll('[data-loading]').forEach((element) => { element.hidden = !loading; });
    document.querySelectorAll('[data-loading-bar]').forEach((element) => { element.hidden = !loading; });
    document.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = loading; });
  }

  function showFeedback(message, success = false) {
    const feedback = document.querySelector('[data-feedback]');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.hidden = !message;
    feedback.classList.toggle('success-message', success);
  }

  async function runAction(action) {
    setLoading(true);
    showFeedback('');
    try {
      await action();
    } catch (error) {
      if (error.status === 401 && !document.getElementById('login-form')) {
        renderLogin(error.message);
      } else {
        showFeedback(error.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function renderLogin(message = '') {
    sessionStorage.removeItem(TOKEN_KEY);
    app.innerHTML = LOGIN_MARKUP;
    bindLogin(message);
  }

  function bindLogin(message = '') {
    const form = document.getElementById('login-form');
    if (message) showFeedback(message);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const email = String(formData.get('email') || '');
      const password = String(formData.get('password') || '');
      sessionStorage.removeItem(TOKEN_KEY);
      void runAction(async () => {
        const result = await api('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        sessionStorage.setItem(TOKEN_KEY, result.accessToken);
        const resolved = await resolveRole();
        renderWorkspace(resolved.role, resolved.initialData);
      });
    });
  }

  function navigationFor(role) {
    if (role === 'admin') return [{ id: 'create-user', label: 'Create user', icon: '+' }];
    if (role === 'manager') return [{ id: 'team-requests', label: 'Team requests', icon: '▤' }];
    return [
      { id: 'balance', label: 'My balance', icon: '◷' },
      { id: 'apply', label: 'Apply for leave', icon: '+' },
      { id: 'my-requests', label: 'My requests', icon: '▤' }
    ];
  }

  function renderWorkspace(role, initialData = null) {
    app.innerHTML = `
      <section class="workspace">
        <header class="workspace-head">
          <div><p class="eyebrow">YOUR WORKSPACE</p><h1>${role === 'admin' ? 'Account administration' : role === 'manager' ? 'Team leave' : 'My leave'}</h1></div>
          <div class="head-actions"><span class="role-pill">${role}</span><button class="button button-quiet" id="logout-button" type="button">Log out <span aria-hidden="true">↗</span></button></div>
        </header>
        <div class="workspace-grid">
          <nav class="side-nav" id="side-nav" aria-label="Workspace navigation"></nav>
          <section class="panel content-panel" id="screen" aria-live="polite"></section>
        </div>
      </section>`;

    document.getElementById('logout-button').addEventListener('click', () => renderLogin());
    const nav = document.getElementById('side-nav');
    navigationFor(role).forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-button';
      button.dataset.screen = item.id;
      button.innerHTML = `<span class="nav-icon" aria-hidden="true"></span><span></span>`;
      button.querySelector('.nav-icon').textContent = item.icon;
      button.lastElementChild.textContent = item.label;
      button.addEventListener('click', () => openScreen(role, item.id));
      nav.append(button);
    });

    const defaultScreen = role === 'admin' ? 'create-user' : role === 'manager' ? 'team-requests' : 'balance';
    openScreen(role, defaultScreen, initialData);
  }

  function screenFrame(title, description = '') {
    const screen = document.getElementById('screen');
    screen.innerHTML = `
      <div class="content-head"><div><h2></h2><p></p></div></div>
      <div class="loading-bar" data-loading-bar hidden></div>
      <p class="feedback" data-feedback role="alert" hidden></p>
      <div class="screen-body"></div>`;
    screen.querySelector('h2').textContent = title;
    screen.querySelector('.content-head p').textContent = description;
    return screen.querySelector('.screen-body');
  }

  function openScreen(role, screenId, initialData = null) {
    document.querySelectorAll('.nav-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.screen === screenId);
    });

    if (screenId === 'create-user') {
      renderCreateUser();
    } else if (screenId === 'apply') {
      renderApplyForm();
    } else if (screenId === 'balance') {
      screenFrame('My balance', 'Remaining days for the current calendar year.');
      void runAction(async () => renderBalances(initialData || await api('/api/leave/balances')));
    } else if (screenId === 'my-requests') {
      screenFrame('My requests', 'Your submitted leave requests and their current status.');
      void runAction(async () => renderRequests((await api('/api/leave/requests')).requests, false));
    } else if (screenId === 'team-requests') {
      screenFrame('Team requests', 'Requests from employees currently assigned to you.');
      void runAction(async () => renderRequests((initialData || await api('/api/leave/requests')).requests, true));
    }
  }

  function renderBalances(data) {
    const body = document.querySelector('.screen-body');
    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'balance-grid';
    data.balances.forEach((balance) => {
      const card = document.createElement('article');
      card.className = 'balance-card';
      const heading = document.createElement('h3');
      heading.textContent = balance.leaveType;
      const number = document.createElement('div');
      number.className = 'balance-number';
      number.append(document.createTextNode(String(balance.remainingDays)));
      const unit = document.createElement('small');
      unit.textContent = ' days left';
      number.append(unit);
      const meta = document.createElement('div');
      meta.className = 'balance-meta';
      const allocated = document.createElement('span');
      allocated.textContent = `${balance.allocatedDays} allocated`;
      const used = document.createElement('span');
      used.textContent = `${balance.usedDays} used`;
      meta.append(allocated, used);
      const track = document.createElement('div');
      track.className = 'balance-track';
      const fill = document.createElement('div');
      fill.className = 'balance-fill';
      fill.style.width = `${balance.allocatedDays ? Math.max(0, Math.min(100, balance.remainingDays / balance.allocatedDays * 100)) : 0}%`;
      track.append(fill);
      card.append(heading, number, meta, track);
      grid.append(card);
    });
    body.append(grid);
    const year = document.createElement('p');
    year.className = 'form-help';
    year.style.marginTop = '17px';
    year.textContent = `Calendar year ${data.year} · balances refresh after a manager decision.`;
    body.append(year);
  }

  function renderRequests(requests, allowDecisions) {
    const body = document.querySelector('.screen-body');
    body.innerHTML = '';
    if (!requests.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const icon = document.createElement('span');
      icon.className = 'empty-icon';
      icon.textContent = '◌';
      const text = document.createElement('span');
      text.textContent = allowDecisions ? 'There are no requests waiting for your team.' : 'Your requests will appear here once submitted.';
      empty.append(icon, text);
      body.append(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'request-list';
    requests.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'request-card';
      const details = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'request-title';
      const leaveType = document.createElement('strong');
      leaveType.textContent = item.leaveType;
      const status = document.createElement('span');
      status.className = `status-pill ${item.status.toLowerCase()}`;
      status.textContent = item.status;
      title.append(leaveType, status);
      const meta = document.createElement('div');
      meta.className = 'request-meta';
      meta.textContent = `${item.startDate} to ${item.endDate}${allowDecisions ? ` · Employee #${item.employeeId}` : ''}`;
      const reason = document.createElement('div');
      reason.className = 'request-reason';
      reason.textContent = item.reason;
      details.append(title, meta, reason);
      card.append(details);

      if (allowDecisions && item.status === 'Pending') {
        const actions = document.createElement('div');
        actions.className = 'request-actions';
        actions.append(
          decisionButton(item, 'Approved', 'button button-secondary', 'Approve'),
          decisionButton(item, 'Rejected', 'button button-danger', 'Reject')
        );
        card.append(actions);
      }
      list.append(card);
    });
    body.append(list);
  }

  function decisionButton(item, decision, className, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', () => {
      void runAction(async () => {
        await api(`/api/leave/requests/${item.id}/decision`, { method: 'POST', body: { decision } });
        const result = await api('/api/leave/requests');
        renderRequests(result.requests, true);
        showFeedback(`Request ${decision.toLowerCase()}.`, true);
      });
    });
    return button;
  }

  function renderApplyForm() {
    const body = screenFrame('Apply for leave', 'Choose a leave type and the dates you need.');
    body.innerHTML = `
      <form id="leave-form" class="content-form">
        <div class="form-stack">
          <label for="leave-type">Leave type</label>
          <select id="leave-type" name="leaveType" required><option value="Casual">Casual</option><option value="Sick">Sick</option><option value="Earned">Earned</option></select>
          <div class="form-grid">
            <div class="form-stack"><label for="start-date">Start date</label><input id="start-date" name="startDate" type="date" required></div>
            <div class="form-stack"><label for="end-date">End date</label><input id="end-date" name="endDate" type="date" required></div>
          </div>
          <label for="leave-reason">Reason</label><textarea id="leave-reason" name="reason" required></textarea>
          <p class="form-help">Weekdays count toward your balance. Weekends are excluded.</p>
          <div class="form-actions"><button class="button button-primary" type="submit">Submit request <span aria-hidden="true">→</span></button></div>
          <p class="feedback" data-feedback role="alert" hidden></p>
          <p class="loading-note" data-loading role="status" aria-live="polite" hidden>Submitting your request…</p>
        </div>
      </form>`;
    const form = document.getElementById('leave-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const body = {
        leaveType: String(formData.get('leaveType')),
        startDate: String(formData.get('startDate')),
        endDate: String(formData.get('endDate')),
        reason: String(formData.get('reason'))
      };
      void runAction(async () => {
        const created = await api('/api/leave/requests', { method: 'POST', body });
        showFeedback(`Request submitted with ${created.status} status.`, true);
        form.reset();
      });
    });
  }

  function renderCreateUser() {
    const body = screenFrame('Create user', 'Add an account and assign its role.');
    body.innerHTML = `
      <form id="user-form" class="content-form">
        <div class="form-stack">
          <label for="user-name">Name</label><input id="user-name" name="name" required>
          <label for="user-email">Email</label><input id="user-email" name="email" type="email" required>
          <label for="user-password">Password</label><input id="user-password" name="password" type="password" required>
          <label for="user-role">Role</label>
          <select id="user-role" name="role" required><option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
          <div id="manager-field" class="form-stack">
            <label for="manager-id">Assigned manager user ID</label><input id="manager-id" name="managerId" type="number" min="1" step="1" required>
            <p class="form-help">Use the existing manager’s user ID.</p>
          </div>
          <div class="form-actions"><button class="button button-primary" type="submit">Create account <span aria-hidden="true">→</span></button></div>
          <p class="feedback" data-feedback role="alert" hidden></p>
          <p class="loading-note" data-loading role="status" aria-live="polite" hidden>Creating account…</p>
        </div>
      </form>`;
    const form = document.getElementById('user-form');
    const role = document.getElementById('user-role');
    const managerField = document.getElementById('manager-field');
    const managerInput = document.getElementById('manager-id');
    const updateManagerField = () => {
      const needsManager = role.value === 'employee';
      managerField.classList.toggle('hidden', !needsManager);
      managerInput.required = needsManager;
    };
    role.addEventListener('change', updateManagerField);
    updateManagerField();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const body = {
        name: String(formData.get('name')),
        email: String(formData.get('email')),
        password: String(formData.get('password')),
        role: String(formData.get('role'))
      };
      if (body.role === 'employee') body.managerId = Number(formData.get('managerId'));
      void runAction(async () => {
        const created = await api('/api/users', { method: 'POST', body });
        showFeedback(`Created ${created.name}.`, true);
        form.reset();
        updateManagerField();
      });
    });
  }

  async function start() {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      bindLogin();
      return;
    }
    await runAction(async () => {
      const resolved = await resolveRole();
      renderWorkspace(resolved.role, resolved.initialData);
    });
  }

  bindLogin();
  if (sessionStorage.getItem(TOKEN_KEY)) void start();
})();
