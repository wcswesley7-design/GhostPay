(() => {
  const shell = document.getElementById('consoleShell');
  if (!shell) {
    return;
  }

  const state = {
    token: localStorage.getItem('ghostpay_token'),
    user: null,
    accounts: [],
    transactions: [],
    pixKeys: [],
    pixCharges: [],
    cards: []
  };

  const elements = {
    consoleHero: document.getElementById('consoleHero'),
    authPanel: document.getElementById('authPanel'),
    dashboardPanel: document.getElementById('dashboardPanel'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    tabs: document.querySelectorAll('.tab'),
    logoutBtn: document.getElementById('logoutBtn'),
    toast: document.getElementById('toast'),
    errorBanner: document.getElementById('errorBanner'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    metricBalance: document.getElementById('metricBalance'),
    metricIncome: document.getElementById('metricIncome'),
    metricSpend: document.getElementById('metricSpend'),
    metricBalanceFull: document.getElementById('metricBalanceFull'),
    metricIncomeFull: document.getElementById('metricIncomeFull'),
    metricSpendFull: document.getElementById('metricSpendFull'),
    metricCount: document.getElementById('metricCount'),
    sidebarName: document.getElementById('sidebarName'),
    accountChips: document.getElementById('accountChips'),
    accountsList: document.getElementById('accountsList'),
    accountForm: document.getElementById('accountForm'),
    transactionForm: document.getElementById('transactionForm'),
    transactionsList: document.getElementById('transactionsList'),
    pixKeysList: document.getElementById('pixKeysList'),
    pixChargesList: document.getElementById('pixChargesList'),
    pixKeyForm: document.getElementById('pixKeyForm'),
    pixTransferForm: document.getElementById('pixTransferForm'),
    pixChargeForm: document.getElementById('pixChargeForm'),
    cardsList: document.getElementById('cardsList'),
    cardForm: document.getElementById('cardForm'),
    cardTxnForm: document.getElementById('cardTxnForm'),
    cardTransactionsList: document.getElementById('cardTransactionsList'),
    refreshAccounts: document.getElementById('refreshAccounts'),
    refreshOverview: document.getElementById('refreshOverview'),
    refreshTransactions: document.getElementById('refreshTransactions'),
    refreshPix: document.getElementById('refreshPix'),
    refreshCharges: document.getElementById('refreshCharges'),
    refreshCards: document.getElementById('refreshCards'),
    refreshCardTx: document.getElementById('refreshCardTx')
  };

  const labels = {
    deposit: 'Depósito',
    withdrawal: 'Saque',
    transfer: 'Transferência',
    payment: 'Pagamento'
  };

  const pixStatusLabels = {
    pending: 'pendente',
    paid: 'pago',
    failed: 'falhou'
  };

  const cardStatusLabels = {
    active: 'ativo',
    inactive: 'inativo',
    blocked: 'bloqueado'
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

  function setError(message) {
    if (!elements.errorBanner) {
      return;
    }
    if (!message) {
      elements.errorBanner.textContent = '';
      elements.errorBanner.classList.add('hidden');
      return;
    }
    elements.errorBanner.textContent = message;
    elements.errorBanner.classList.remove('hidden');
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
    return new Date(value).toLocaleString('pt-BR');
  }

  function decodeToken(token) {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized));
    } catch (err) {
      return null;
    }
  }

  async function apiRequest(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, { ...options, headers });
    if (response.status === 401) {
      setToken(null);
      state.user = null;
      setAuthUI(false);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Falha na solicitacao');
    }
    return data;
  }

  function setToken(token) {
    state.token = token;
    if (token) {
      localStorage.setItem('ghostpay_token', token);
    } else {
      localStorage.removeItem('ghostpay_token');
    }
  }

  function setAuthUI(isAuthed) {
    elements.authPanel.classList.toggle('hidden', isAuthed);
    elements.dashboardPanel.classList.toggle('hidden', !isAuthed);
    if (elements.consoleHero) {
      elements.consoleHero.classList.toggle('hidden', isAuthed);
    }
    if (elements.logoutBtn) {
      elements.logoutBtn.classList.toggle('hidden', !isAuthed);
    }
    if (!isAuthed && elements.sidebarName) {
      elements.sidebarName.textContent = '--';
    }
    if (!isAuthed && elements.welcomeTitle) {
      elements.welcomeTitle.textContent = 'Sua conta digital em um painel simples.';
    }
  }

  function renderSkeleton(container, count) {
    if (!container) {
      return;
    }
    container.innerHTML = Array.from({ length: count })
      .map(() => '<div class="skeleton skeleton-card"></div>')
      .join('');
  }

  function renderEmpty(container, message) {
    if (!container) {
      return;
    }
    container.innerHTML = `<div class="list-item">${message}</div>`;
  }

  function fillAccountSelect(select, placeholder) {
    if (!select) {
      return;
    }
    select.innerHTML = placeholder || '';
    state.accounts.forEach((account) => {
      const option = document.createElement('option');
      option.value = account.id;
      const numberLabel = account.accountNumber ? ` - ${account.accountNumber}` : '';
      option.textContent = `${account.name} (${account.currency})${numberLabel}`;
      select.appendChild(option);
    });
  }

  function updateAccountSelects() {
    if (elements.transactionForm) {
      fillAccountSelect(elements.transactionForm.elements.fromAccountId, '<option value="">Selecionar conta</option>');
      fillAccountSelect(elements.transactionForm.elements.toAccountId, '<option value="">Selecionar conta</option>');
    }
    if (elements.pixTransferForm) {
      fillAccountSelect(elements.pixTransferForm.elements.accountId, '<option value="">Selecionar conta</option>');
    }
    if (elements.pixChargeForm) {
      fillAccountSelect(elements.pixChargeForm.elements.accountId, '<option value="">Selecionar conta</option>');
    }
    if (elements.cardForm) {
      fillAccountSelect(elements.cardForm.elements.accountId, '<option value="">Selecionar conta</option>');
    }
  }

  function renderMetrics(metrics) {
    const balance = formatCents(metrics.totalBalanceCents, 'BRL');
    const income = formatCents(metrics.incomeCents, 'BRL');
    const spend = formatCents(metrics.spendCents, 'BRL');
    if (elements.metricBalance) {
      elements.metricBalance.textContent = balance;
    }
    if (elements.metricIncome) {
      elements.metricIncome.textContent = income;
    }
    if (elements.metricSpend) {
      elements.metricSpend.textContent = spend;
    }
    if (elements.metricBalanceFull) {
      elements.metricBalanceFull.textContent = balance;
    }
    if (elements.metricIncomeFull) {
      elements.metricIncomeFull.textContent = income;
    }
    if (elements.metricSpendFull) {
      elements.metricSpendFull.textContent = spend;
    }
    if (elements.metricCount) {
      elements.metricCount.textContent = metrics.transactionCount || 0;
    }
  }

  function renderAccounts(accounts) {
    if (!elements.accountsList && !elements.accountChips) {
      return;
    }
    if (!accounts.length) {
      if (elements.accountsList) {
        elements.accountsList.innerHTML = '<div class="list-item">Nenhuma conta criada ainda.</div>';
      }
      if (elements.accountChips) {
        elements.accountChips.innerHTML = '';
      }
      return;
    }

    if (elements.accountsList) {
      elements.accountsList.innerHTML = accounts
        .map(
          (account) => `
            <div class="list-item">
              <strong>${account.name}</strong>
              <div class="list-meta">
                <span>${account.currency} - ${account.accountNumber}</span>
                <strong>${formatCents(account.balanceCents, account.currency)}</strong>
              </div>
            </div>
          `
        )
        .join('');
    }

    if (elements.accountChips) {
      elements.accountChips.innerHTML = accounts
        .map((account) => `<span class="chip">${account.name}: ${formatCents(account.balanceCents, account.currency)}</span>`)
        .join('');
    }
  }

  function renderTransactions(transactions) {
    if (!elements.transactionsList) {
      return;
    }
    if (!transactions.length) {
      elements.transactionsList.innerHTML = '<div class="list-item">Nenhuma movimentação recente.</div>';
      return;
    }

    elements.transactionsList.innerHTML = transactions
      .map((transaction) => {
        const label = labels[transaction.type] || transaction.type;
        const amount = formatCents(transaction.amountCents, 'BRL');
        const detailParts = [];
        if (transaction.counterparty) {
          detailParts.push(`Contraparte: ${transaction.counterparty}`);
        }
        if (transaction.note) {
          detailParts.push(`Nota: ${transaction.note}`);
        }
        const detailsLine = detailParts.join(' · ');

        const metadata = transaction.metadata || {};
        const metadataParts = [];
        if (metadata.externalInstitution) {
          metadataParts.push(`Banco: ${metadata.externalInstitution}`);
        }
        if (metadata.externalDocument) {
          metadataParts.push(`Documento: ${metadata.externalDocument}`);
        }
        if (metadata.externalIdentifier) {
          metadataParts.push(`Identificador: ${metadata.externalIdentifier}`);
        }
        const metadataLine = metadataParts.join(' · ');

        return `
          <div class="list-item">
            <strong>${label}</strong>
            <div class="list-meta">
              <span>${formatDate(transaction.createdAt)}</span>
              <span>${amount}</span>
            </div>
            <div class="list-meta">
              <span>Status: ${transaction.status}</span>
            </div>
            ${detailsLine ? `<div class="list-meta"><span>${detailsLine}</span></div>` : ''}
            ${metadataLine ? `<div class="list-meta"><span>${metadataLine}</span></div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  function renderPixKeys(keys) {
    if (elements.pixKeysList) {
      if (!keys.length) {
        elements.pixKeysList.innerHTML = '<span class="pill">Sem chaves Pix</span>';
      } else {
        elements.pixKeysList.innerHTML = keys
          .map((key) => `<span class="pill">${key.type.toUpperCase()}: ${key.value}</span>`)
          .join('');
      }
    }

    if (!elements.pixChargeForm) {
      return;
    }

    const keySelect = elements.pixChargeForm.elements.keyId;
    keySelect.innerHTML = '';
    if (!keys.length) {
      keySelect.disabled = true;
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Crie uma chave Pix primeiro';
      keySelect.appendChild(option);
    } else {
      keySelect.disabled = false;
      keys.forEach((key) => {
        const option = document.createElement('option');
        option.value = key.id;
        option.textContent = `${key.type.toUpperCase()} - ${key.value}`;
        keySelect.appendChild(option);
      });
    }
  }

  function renderPixCharges(charges) {
    if (!elements.pixChargesList) {
      return;
    }
    if (!charges.length) {
      elements.pixChargesList.innerHTML = '<div class="list-item">Nenhuma cobrança Pix criada.</div>';
      return;
    }

    elements.pixChargesList.innerHTML = charges
      .map((charge) => {
        const statusLabel = pixStatusLabels[charge.status] || charge.status;
        const statusClass = charge.status === 'pending' ? 'pending' : charge.status;
        const action =
          charge.status === 'pending'
            ? `<button class="btn btn-ghost" data-action="pay" data-id="${charge.id}" type="button">Pagar cobrança</button>`
            : '';
        return `
          <div class="list-item">
            <strong>${formatCents(charge.amountCents, 'BRL')}</strong>
            <div class="list-meta">
              <span>${charge.txid}</span>
              <span>${formatDate(charge.createdAt)}</span>
            </div>
            <div class="list-meta">
              <span class="status-pill ${statusClass}">${statusLabel}</span>
              ${action}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderCards(cards) {
    if (!elements.cardsList && !elements.cardTxnForm) {
      return;
    }
    if (!cards.length) {
      if (elements.cardsList) {
        elements.cardsList.innerHTML = '<div class="list-item">Nenhum cartão emitido.</div>';
      }
      if (elements.cardTxnForm) {
        elements.cardTxnForm.elements.cardId.innerHTML = '';
        elements.cardTxnForm.elements.cardId.disabled = true;
      }
      return;
    }

    if (elements.cardsList) {
      elements.cardsList.innerHTML = cards
        .map((card) => {
          const statusLabel = cardStatusLabels[card.status] || card.status;
          return `
            <div class="list-item">
              <strong>${card.brand} **** ${card.last4}</strong>
              <div class="list-meta">
                <span>${card.type} - ${statusLabel}</span>
                <span>${formatCents(card.availableCents, 'BRL')} disponível</span>
              </div>
            </div>
          `;
        })
        .join('');
    }

    if (elements.cardTxnForm) {
      const cardSelect = elements.cardTxnForm.elements.cardId;
      cardSelect.disabled = false;
      cardSelect.innerHTML = '';
      cards.forEach((card) => {
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = `${card.brand} **** ${card.last4}`;
        cardSelect.appendChild(option);
      });
    }
  }

  function renderCardTransactions(transactions) {
    if (!elements.cardTransactionsList) {
      return;
    }
    if (!transactions.length) {
      elements.cardTransactionsList.innerHTML = '<div class="list-item">Sem compras registradas.</div>';
      return;
    }

    elements.cardTransactionsList.innerHTML = transactions
      .map(
        (txn) => `
          <div class="list-item">
            <strong>${txn.merchant}</strong>
            <div class="list-meta">
              <span>${formatDate(txn.createdAt)}</span>
              <span>${formatCents(txn.amountCents, 'BRL')}</span>
            </div>
          </div>
        `
      )
      .join('');
  }


  async function loadOverview() {
    if (elements.accountsList) {
      renderSkeleton(elements.accountsList, 2);
    }
    if (elements.transactionsList) {
      renderSkeleton(elements.transactionsList, 3);
    }
    try {
      const data = await apiRequest('/api/overview');
      state.accounts = data.accounts || [];
      state.transactions = data.recentTransactions || [];
      updateAccountSelects();
      renderAccounts(state.accounts);
      renderTransactions(state.transactions);
      renderMetrics(data.metrics || {});
      if (state.user) {
        elements.welcomeTitle.textContent = `Bem-vindo, ${state.user.name}`;
        if (elements.sidebarName) {
          elements.sidebarName.textContent = state.user.name;
        }
      }
      setError('');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function loadPix() {
    if (!elements.pixKeysList && !elements.pixChargesList && !elements.pixKeyForm && !elements.pixTransferForm && !elements.pixChargeForm) {
      return;
    }
    if (elements.pixChargesList) {
      renderSkeleton(elements.pixChargesList, 2);
    }
    try {
      const [keys, charges] = await Promise.all([
        apiRequest('/api/pix/keys'),
        apiRequest('/api/pix/charges')
      ]);
      state.pixKeys = keys.keys || [];
      state.pixCharges = charges.charges || [];
      renderPixKeys(state.pixKeys);
      renderPixCharges(state.pixCharges.slice(0, 5));
    } catch (err) {
      if (elements.pixKeysList) {
        elements.pixKeysList.innerHTML = '<span class="pill">Falha ao carregar Pix</span>';
      }
      if (elements.pixChargesList) {
        elements.pixChargesList.innerHTML = '<div class="list-item">Falha ao carregar cobranças Pix.</div>';
      }
      showToast(err.message, 'error');
    }
  }

  async function loadCards() {
    if (!elements.cardsList && !elements.cardTransactionsList && !elements.cardForm && !elements.cardTxnForm) {
      return;
    }
    if (elements.cardsList) {
      renderSkeleton(elements.cardsList, 2);
    }
    if (elements.cardTransactionsList) {
      renderSkeleton(elements.cardTransactionsList, 2);
    }
    try {
      const data = await apiRequest('/api/cards');
      state.cards = data.cards || [];
      renderCards(state.cards);
      if (elements.cardTxnForm) {
        const selected = elements.cardTxnForm.elements.cardId.value || (state.cards[0] && state.cards[0].id);
        if (selected) {
          elements.cardTxnForm.elements.cardId.value = selected;
          await loadCardTransactions(selected);
        } else {
          renderCardTransactions([]);
        }
      }
    } catch (err) {
      if (elements.cardsList) {
        elements.cardsList.innerHTML = '<div class="list-item">Falha ao carregar cartões.</div>';
      }
      if (elements.cardTransactionsList) {
        elements.cardTransactionsList.innerHTML = '<div class="list-item">Falha ao carregar transações.</div>';
      }
      showToast(err.message, 'error');
    }
  }

  async function loadCardTransactions(cardId) {
    if (!cardId || !elements.cardTransactionsList) {
      renderCardTransactions([]);
      return;
    }
    const data = await apiRequest(`/api/cards/${cardId}/transactions`);
    renderCardTransactions(data.transactions || []);
  }

  function needsOverviewData() {
    return Boolean(
      elements.accountsList ||
        elements.accountChips ||
        elements.accountForm ||
        elements.transactionForm ||
        elements.transactionsList ||
        elements.metricBalance ||
        elements.metricIncome ||
        elements.metricSpend ||
        elements.metricBalanceFull ||
        elements.metricIncomeFull ||
        elements.metricSpendFull ||
        elements.metricCount ||
        elements.pixTransferForm ||
        elements.pixChargeForm ||
        elements.cardForm
    );
  }

  function needsPixData() {
    return Boolean(elements.pixKeysList || elements.pixChargesList || elements.pixKeyForm || elements.pixTransferForm || elements.pixChargeForm);
  }

  function needsCardsData() {
    return Boolean(elements.cardsList || elements.cardTransactionsList || elements.cardForm || elements.cardTxnForm);
  }

  async function loadPageData() {
    const tasks = [];
    if (needsOverviewData()) {
      tasks.push(loadOverview());
    }
    if (needsPixData()) {
      tasks.push(loadPix());
    }
    if (needsCardsData()) {
      tasks.push(loadCards());
    }
    if (tasks.length) {
      await Promise.allSettled(tasks);
    }
  }

  function setActiveTab(target) {
    elements.tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === target);
    });
    elements.loginForm.classList.toggle('hidden', target !== 'login');
    elements.registerForm.classList.toggle('hidden', target !== 'register');
  }

  function updateTransactionFields() {
    if (!elements.transactionForm) {
      return;
    }
    const type = elements.transactionForm.elements.type.value;
    const fromLabel = elements.transactionForm.elements.fromAccountId.closest('label');
    const toLabel = elements.transactionForm.elements.toAccountId.closest('label');
    const counterpartyField = elements.transactionForm.elements.counterparty;
    const identifierField = elements.transactionForm.elements.externalIdentifier;
    const counterpartyLabel = counterpartyField ? counterpartyField.closest('label') : null;
    const identifierLabel = identifierField ? identifierField.closest('label') : null;

    const needsFrom = type === 'transfer' || type === 'payment';
    const needsTo = type === 'transfer';
    const needsExternal = type === 'payment';

    elements.transactionForm.elements.fromAccountId.disabled = !needsFrom;
    elements.transactionForm.elements.toAccountId.disabled = !needsTo;
    if (counterpartyField) {
      counterpartyField.disabled = !needsExternal;
      counterpartyField.required = needsExternal;
    }
    if (identifierField) {
      identifierField.disabled = !needsExternal;
      identifierField.required = needsExternal;
    }

    fromLabel.classList.toggle('is-disabled', !needsFrom);
    toLabel.classList.toggle('is-disabled', !needsTo);
    toLabel.classList.toggle('hidden', !needsTo);
    if (counterpartyLabel) {
      counterpartyLabel.classList.toggle('hidden', !needsExternal);
    }
    if (identifierLabel) {
      identifierLabel.classList.toggle('hidden', !needsExternal);
    }

    if (!needsExternal) {
      if (counterpartyField) {
        counterpartyField.value = '';
      }
      if (identifierField) {
        identifierField.value = '';
      }
    }
    if (!needsTo) {
      elements.transactionForm.elements.toAccountId.value = '';
    }
  }

  function updatePixKeyField() {
    if (!elements.pixKeyForm) {
      return;
    }
    const type = elements.pixKeyForm.elements.type.value;
    const valueInput = elements.pixKeyForm.elements.value;
    const isRandom = type === 'random';
    valueInput.disabled = isRandom;
    valueInput.placeholder = isRandom ? 'Gerada automaticamente' : 'Somente email/telefone/cpf';
    if (isRandom) {
      valueInput.value = '';
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.loginForm).entries());

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setToken(data.token);
      state.user = data.user;
      setAuthUI(true);
      await loadPageData();
      showToast('Login realizado');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.registerForm).entries());

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setToken(data.token);
      state.user = data.user;
      setAuthUI(true);
      await loadPageData();
      showToast('Conta criada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleAccountCreate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.accountForm).entries());
    if (!payload.currency) {
      delete payload.currency;
    }

    try {
      await apiRequest('/api/accounts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.accountForm.reset();
      await loadOverview();
      showToast('Conta adicionada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleTransaction(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.transactionForm).entries());

    const needsExternal = payload.type === 'payment';
    if (needsExternal && !payload.counterparty) {
      showToast('Informe o beneficiário.', 'error');
      return;
    }
    if (needsExternal && !payload.externalIdentifier) {
      showToast('Informe o identificador do pagamento.', 'error');
      return;
    }

    const metadata = {};
    if (payload.externalIdentifier) {
      metadata.externalIdentifier = payload.externalIdentifier;
    }
    if (Object.keys(metadata).length) {
      payload.metadata = metadata;
    }

    if (!payload.fromAccountId) {
      delete payload.fromAccountId;
    }
    if (!payload.toAccountId) {
      delete payload.toAccountId;
    }
    if (!payload.counterparty) {
      delete payload.counterparty;
    }
    if (!payload.note) {
      delete payload.note;
    }
    delete payload.externalIdentifier;

    try {
      await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.transactionForm.reset();
      updateTransactionFields();
      await loadOverview();
      showToast('Movimentação registrada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handlePixKeyCreate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.pixKeyForm).entries());
    if (!payload.value) {
      delete payload.value;
    }

    try {
      await apiRequest('/api/pix/keys', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.pixKeyForm.reset();
      updatePixKeyField();
      await loadPix();
      showToast('Chave Pix criada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handlePixTransfer(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.pixTransferForm).entries());
    if (!payload.description) {
      delete payload.description;
    }

    try {
      await apiRequest('/api/pix/transfers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.pixTransferForm.reset();
      await loadOverview();
      await loadPix();
      showToast('Pix enviado');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handlePixChargeCreate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.pixChargeForm).entries());
    if (!payload.description) {
      delete payload.description;
    }
    if (!payload.keyId) {
      showToast('Crie uma chave Pix antes.', 'error');
      return;
    }

    try {
      await apiRequest('/api/pix/charges', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.pixChargeForm.reset();
      await loadPix();
      showToast('Cobrança Pix criada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handlePixChargeAction(event) {
    const button = event.target.closest('button');
    if (!button || button.dataset.action !== 'pay') {
      return;
    }
    const chargeId = button.dataset.id;
    if (!chargeId) {
      return;
    }

    try {
      await apiRequest(`/api/pix/charges/${chargeId}/simulate-pay`, {
        method: 'POST'
      });
      await loadOverview();
      await loadPix();
      showToast('Pagamento registrado');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCardCreate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.cardForm).entries());
    if (!payload.limit) {
      delete payload.limit;
    }

    try {
      await apiRequest('/api/cards', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.cardForm.reset();
      await loadCards();
      showToast('Cartão emitido');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCardTransaction(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.cardTxnForm).entries());
    const cardId = payload.cardId;
    delete payload.cardId;
    if (!cardId) {
      showToast('Selecione um cartão.', 'error');
      return;
    }

    try {
      await apiRequest(`/api/cards/${cardId}/transactions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      elements.cardTxnForm.reset();
      await loadOverview();
      await loadCards();
      await loadCardTransactions(cardId);
      showToast('Compra registrada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function initialize() {
    if (elements.tabs.length) {
      elements.tabs.forEach((tab) => {
        tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
      });
    }

    if (elements.loginForm) {
      elements.loginForm.addEventListener('submit', handleLogin);
    }
    if (elements.registerForm) {
      elements.registerForm.addEventListener('submit', handleRegister);
    }
    if (elements.accountForm) {
      elements.accountForm.addEventListener('submit', handleAccountCreate);
    }
    if (elements.transactionForm) {
      elements.transactionForm.addEventListener('submit', handleTransaction);
      elements.transactionForm.elements.type.addEventListener('change', updateTransactionFields);
    }
    if (elements.pixKeyForm) {
      elements.pixKeyForm.addEventListener('submit', handlePixKeyCreate);
      elements.pixKeyForm.elements.type.addEventListener('change', updatePixKeyField);
    }
    if (elements.pixTransferForm) {
      elements.pixTransferForm.addEventListener('submit', handlePixTransfer);
    }
    if (elements.pixChargeForm) {
      elements.pixChargeForm.addEventListener('submit', handlePixChargeCreate);
    }
    if (elements.pixChargesList) {
      elements.pixChargesList.addEventListener('click', handlePixChargeAction);
    }
    if (elements.cardForm) {
      elements.cardForm.addEventListener('submit', handleCardCreate);
    }
    if (elements.cardTxnForm) {
      elements.cardTxnForm.addEventListener('submit', handleCardTransaction);
      elements.cardTxnForm.elements.cardId.addEventListener('change', async (event) => {
        await loadCardTransactions(event.target.value);
      });
    }

    if (elements.refreshAccounts) {
      elements.refreshAccounts.addEventListener('click', loadOverview);
    }
    if (elements.refreshOverview) {
      elements.refreshOverview.addEventListener('click', loadOverview);
    }
    if (elements.refreshTransactions) {
      elements.refreshTransactions.addEventListener('click', loadOverview);
    }
    if (elements.refreshPix) {
      elements.refreshPix.addEventListener('click', loadPix);
    }
    if (elements.refreshCharges) {
      elements.refreshCharges.addEventListener('click', loadPix);
    }
    if (elements.refreshCards) {
      elements.refreshCards.addEventListener('click', loadCards);
    }
    if (elements.refreshCardTx) {
      elements.refreshCardTx.addEventListener('click', loadCards);
    }
    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener('click', () => {
        setToken(null);
        state.user = null;
        setAuthUI(false);
        showToast('Sessão encerrada');
      });
    }

    updateTransactionFields();
    updatePixKeyField();

    if (state.token) {
      const decoded = decodeToken(state.token);
      if (decoded && decoded.name) {
        state.user = { name: decoded.name };
      }
      try {
        await loadPageData();
        setAuthUI(true);
      } catch (err) {
        setToken(null);
        setAuthUI(false);
      }
    } else {
      setAuthUI(false);
    }
  }

  initialize();
})();
