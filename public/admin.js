(() => {
  const panel = document.querySelector('[data-admin-panel]');
  if (!panel) {
    return;
  }

  const state = {
    token: localStorage.getItem('ghostpay_admin_token') || ''
  };

  const elements = {
    tokenForm: document.getElementById('adminTokenForm'),
    tokenInput: document.getElementById('adminTokenInput'),
    tokenStatus: document.getElementById('adminTokenStatus'),
    statusFilter: document.getElementById('adminStatusFilter'),
    refreshBtn: document.getElementById('adminRefreshWithdrawals'),
    withdrawalsList: document.getElementById('adminWithdrawalsList'),
    toast: document.getElementById('toast')
  };

  const statusLabels = {
    requested: 'solicitado',
    processing: 'em an\u00e1lise',
    paid: 'pago',
    failed: 'falhou',
    canceled: 'cancelado'
  };

  function showToast(message, mode = 'info') {
    if (!elements.toast) {
      return;
    }
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    elements.toast.classList.toggle('error', mode === 'error');
    setTimeout(() => elements.toast.classList.remove('show'), 2600);
  }

  function setToken(token) {
    state.token = token || '';
    if (state.token) {
      localStorage.setItem('ghostpay_admin_token', state.token);
    } else {
      localStorage.removeItem('ghostpay_admin_token');
    }
    if (elements.tokenStatus) {
      elements.tokenStatus.textContent = state.token ? 'Chave admin salva.' : 'Nenhuma chave salva.';
    }
  }

  function formatCents(cents, currency = 'BRL') {
    const value = Number(cents || 0) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString('pt-BR') : '--';
  }

  async function adminRequest(path, options = {}) {
    if (!state.token) {
      throw new Error('Chave admin n\u00e3o informada.');
    }
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Token': state.token,
      ...(options.headers || {})
    };
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || 'Falha na solicita\u00e7\u00e3o';
      throw new Error(message);
    }
    return data;
  }

  function renderWithdrawals(withdrawals) {
    if (!elements.withdrawalsList) {
      return;
    }
    if (!withdrawals.length) {
      elements.withdrawalsList.innerHTML = '<div class="list-item">Nenhuma solicita\u00e7\u00e3o encontrada.</div>';
      return;
    }
    elements.withdrawalsList.innerHTML = withdrawals
      .map((item) => {
        const statusLabel = statusLabels[item.status] || item.status;
        const statusClass =
          item.status === 'requested' || item.status === 'processing'
            ? 'pending'
            : item.status === 'paid'
            ? 'paid'
            : 'failed';
        return `
          <div class="list-item" data-withdrawal-id="${item.id}">
            <div class="list-row">
              <strong>${formatCents(item.amountCents || item.amount_cents, 'BRL')}</strong>
              <span class="status-pill ${statusClass}">${statusLabel}</span>
            </div>
            <div class="list-meta">
              <span>ID: ${item.id}</span>
              <span>${formatDate(item.requestedAt || item.requested_at)}</span>
            </div>
            <div class="list-meta">
              <span>${item.merchantName || 'Merchant'}</span>
              <span>${item.merchantEmail || ''}</span>
            </div>
            <div class="list-meta">
              <span>${item.pixKeyType || item.pix_key_type}: ${item.pixKey || item.pix_key}</span>
            </div>
            <label>
              Nota (opcional)
              <input type="text" data-note placeholder="Observa\u00e7\u00e3o para o cliente" />
            </label>
            <label>
              Comprovante (URL opcional)
              <input type="url" data-proof placeholder="https://..." />
            </label>
            <div class="card-actions card-actions--always">
              <button class="btn btn-ghost" type="button" data-action="mark-paid">Marcar pago</button>
              <button class="btn btn-ghost btn-danger" type="button" data-action="mark-failed">Marcar falhado</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  async function loadWithdrawals() {
    if (!elements.withdrawalsList) {
      return;
    }
    try {
      const status = elements.statusFilter ? elements.statusFilter.value : '';
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await adminRequest(`/admin/withdrawals${query}`);
      renderWithdrawals(data.withdrawals || []);
    } catch (err) {
      elements.withdrawalsList.innerHTML = '<div class="list-item">Falha ao carregar solicita\u00e7\u00f5es.</div>';
      showToast(err.message, 'error');
    }
  }

  async function handleWithdrawalAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const row = button.closest('[data-withdrawal-id]');
    if (!row) {
      return;
    }
    const withdrawalId = row.dataset.withdrawalId;
    const noteInput = row.querySelector('[data-note]');
    const proofInput = row.querySelector('[data-proof]');
    const payload = {
      note: noteInput ? noteInput.value.trim() : '',
      proof_url: proofInput ? proofInput.value.trim() : ''
    };
    if (!payload.note) {
      delete payload.note;
    }
    if (!payload.proof_url) {
      delete payload.proof_url;
    }

    const action = button.dataset.action;
    const confirmMessage =
      action === 'mark-paid'
        ? 'Confirmar saque como pago?'
        : 'Marcar o saque como falhado e devolver saldo?';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const endpoint =
        action === 'mark-paid'
          ? `/admin/withdrawals/${encodeURIComponent(withdrawalId)}/mark_paid`
          : `/admin/withdrawals/${encodeURIComponent(withdrawalId)}/mark_failed`;
      await adminRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(action === 'mark-paid' ? 'Saque marcado como pago.' : 'Saque marcado como falhado.');
      await loadWithdrawals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function init() {
    if (elements.tokenInput) {
      elements.tokenInput.value = state.token;
    }
    setToken(state.token);

    if (elements.tokenForm) {
      elements.tokenForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = elements.tokenInput ? elements.tokenInput.value.trim() : '';
        setToken(value);
        if (value) {
          loadWithdrawals();
        }
      });
    }
    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener('click', loadWithdrawals);
    }
    if (elements.statusFilter) {
      elements.statusFilter.addEventListener('change', loadWithdrawals);
    }
    if (elements.withdrawalsList) {
      elements.withdrawalsList.addEventListener('click', handleWithdrawalAction);
    }

    if (state.token) {
      loadWithdrawals();
    }
  }

  init();
})();
