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
    withdrawals: [],
    cards: [],
    activeCard: null,
    cardNumberVisible: false
  };

  let pixChargePollTimer = null;
  let pixChargePollAttempts = 0;
  let activePixChargeId = null;

  const elements = {
    consoleHero: document.getElementById('consoleHero'),
    authPanel: document.getElementById('authPanel'),
    dashboardPanel: document.getElementById('dashboardPanel'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    planField: document.getElementById('planField'),
    planSummary: document.getElementById('planSummary'),
    planSummaryLabel: document.getElementById('planSummaryLabel'),
    subscriptionSession: document.getElementById('subscriptionSession'),
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
    metricSales: document.getElementById('metricSales'),
    metricSalesDelta: document.getElementById('metricSalesDelta'),
    metricTicket: document.getElementById('metricTicket'),
    metricPixPaid: document.getElementById('metricPixPaid'),
    metricSalesToday: document.getElementById('metricSalesToday'),
    metricHealth: document.getElementById('metricHealth'),
    metricHealthBar: document.getElementById('metricHealthBar'),
    metricHealthPct: document.getElementById('metricHealthPct'),
    metricRevenue: document.getElementById('metricRevenue'),
    metricRevenueMax: document.getElementById('metricRevenueMax'),
    metricRevenueMin: document.getElementById('metricRevenueMin'),
    metricRevenueAvg: document.getElementById('metricRevenueAvg'),
    metricTicketMax: document.getElementById('metricTicketMax'),
    metricTicketMin: document.getElementById('metricTicketMin'),
    metricConversion: document.getElementById('metricConversion'),
    metricChargeTotal: document.getElementById('metricChargeTotal'),
    metricChargePaid: document.getElementById('metricChargePaid'),
    metricChargePending: document.getElementById('metricChargePending'),
    metricChargePendingValue: document.getElementById('metricChargePendingValue'),
    metricChargeFailed: document.getElementById('metricChargeFailed'),
    metricChargeRevenue: document.getElementById('metricChargeRevenue'),
    salesChartLine: document.getElementById('salesChartLine'),
    salesChartFill: document.getElementById('salesChartFill'),
    conversionDonut: document.getElementById('conversionDonut'),
    overviewRange: document.getElementById('overviewRange'),
    transactionsRange: document.getElementById('transactionsRange'),
    balanceAvailable: document.getElementById('balanceAvailable'),
    balanceReserve: document.getElementById('balanceReserve'),
    balancePending: document.getElementById('balancePending'),
    balanceBlocked: document.getElementById('balanceBlocked'),
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
    pixChargeOutput: document.getElementById('pixChargeOutput'),
    pixChargeQr: document.getElementById('pixChargeQr'),
    pixChargeCode: document.getElementById('pixChargeCode'),
    pixChargeCopy: document.getElementById('pixChargeCopy'),
    pixChargeLink: document.getElementById('pixChargeLink'),
    pixChargeLinkCopy: document.getElementById('pixChargeLinkCopy'),
    pixChargeTicket: document.getElementById('pixChargeTicket'),
    pixChargeStatus: document.getElementById('pixChargeStatus'),
    linkModal: document.getElementById('linkModal'),
    openLinkModal: document.getElementById('openLinkModal'),
    editLinkModal: document.getElementById('editLinkModal'),
    editLinkForm: document.getElementById('editLinkForm'),
    editLinkName: document.getElementById('editLinkName'),
    editLinkAmount: document.getElementById('editLinkAmount'),
    editLinkIdField: document.getElementById('editLinkIdField'),
    editLinkId: document.getElementById('editLinkId'),
    editLinkStatus: document.getElementById('editLinkStatus'),
    editLinkSales: document.getElementById('editLinkSales'),
    editLinkPrice: document.getElementById('editLinkPrice'),
    editLinkCreated: document.getElementById('editLinkCreated'),
    editLinkUrl: document.getElementById('editLinkUrl'),
    editLinkCopy: document.getElementById('editLinkCopy'),
    withdrawalForm: document.getElementById('withdrawalForm'),
    withdrawalsList: document.getElementById('withdrawalsList'),
    cardsList: document.getElementById('cardsList'),
    cardForm: document.getElementById('cardForm'),
    cardTxnForm: document.getElementById('cardTxnForm'),
    cardTransactionsList: document.getElementById('cardTransactionsList'),
    cardDetailPanel: document.getElementById('cardDetailPanel'),
    cardDetailTitle: document.getElementById('cardDetailTitle'),
    cardDetailSubtitle: document.getElementById('cardDetailSubtitle'),
    cardVisual: document.getElementById('cardVisual'),
    cardVisualNumber: document.getElementById('cardVisualNumber'),
    toggleCardNumber: document.getElementById('toggleCardNumber'),
    cardNumberLabel: document.getElementById('cardNumberLabel'),
    cardNumberIcon: document.getElementById('cardNumberIcon'),
    cardVisualHolder: document.getElementById('cardVisualHolder'),
    cardVisualExpiry: document.getElementById('cardVisualExpiry'),
    cardStatusPill: document.getElementById('cardStatusPill'),
    cardTypeTag: document.getElementById('cardTypeTag'),
    cardDetailActions: document.getElementById('cardDetailActions'),
    cardDetailNotice: document.getElementById('cardDetailNotice'),
    cardInfoStatus: document.getElementById('cardInfoStatus'),
    cardInfoType: document.getElementById('cardInfoType'),
    cardInfoBrand: document.getElementById('cardInfoBrand'),
    cardInfoLast4: document.getElementById('cardInfoLast4'),
    cardInfoLimit: document.getElementById('cardInfoLimit'),
    cardInfoAvailable: document.getElementById('cardInfoAvailable'),
    cardInfoAccount: document.getElementById('cardInfoAccount'),
    cardInfoCreated: document.getElementById('cardInfoCreated'),
    cardDetailTransactionsList: document.getElementById('cardDetailTransactionsList'),
    profileName: document.getElementById('profileName'),
    profileInitials: document.getElementById('profileInitials'),
    profileAccountId: document.getElementById('profileAccountId'),
    profileCreatedAt: document.getElementById('profileCreatedAt'),
    profileFullName: document.getElementById('profileFullName'),
    profileEmail: document.getElementById('profileEmail'),
    profileCpf: document.getElementById('profileCpf'),
    profilePhone: document.getElementById('profilePhone'),
    profilePixKey: document.getElementById('profilePixKey'),
    refreshAccounts: document.getElementById('refreshAccounts'),
    refreshOverview: document.getElementById('refreshOverview'),
    refreshTransactions: document.getElementById('refreshTransactions'),
    refreshPix: document.getElementById('refreshPix'),
    refreshCharges: document.getElementById('refreshCharges'),
    refreshWithdrawals: document.getElementById('refreshWithdrawals'),
    refreshCards: document.getElementById('refreshCards'),
    refreshCardTx: document.getElementById('refreshCardTx'),
    refreshCardDetail: document.getElementById('refreshCardDetail')
  };

  const confirmModal = {
    overlay: null,
    titleEl: null,
    messageEl: null,
    confirmBtn: null,
    cancelBtn: null,
    resolve: null,
    isOpen: false
  };

  const cancelModal = {
    overlay: null,
    titleEl: null,
    messageEl: null,
    confirmBtn: null,
    cancelBtn: null,
    checkbox: null,
    resolve: null,
    isOpen: false
  };

  const labels = {
    deposit: 'Dep\u00F3sito',
    withdrawal: 'Saque',
    transfer: 'Transfer\u00EAncia',
    payment: 'Pagamento'
  };

  const planLabels = {
    infinity: 'Infinity - R$ 59,90'
  };

  const trashIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none">
      <path d="M4.5 6.5h15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      <path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      <path d="M7.5 6.5l.75 12a1.8 1.8 0 0 0 1.8 1.6h3.9a1.8 1.8 0 0 0 1.8-1.6l.75-12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M10.4 10.2v6.2M13.6 10.2v6.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `;

  const lockIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none">
      <rect x="5.5" y="10" width="13" height="10" rx="2" stroke="currentColor" stroke-width="1.3" />
      <path d="M8 10V7.6a4 4 0 0 1 8 0V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `;

  const unlockIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none">
      <rect x="5.5" y="10" width="13" height="10" rx="2" stroke="currentColor" stroke-width="1.3" />
      <path d="M14 6.8a3.6 3.6 0 0 0-7.2 0V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `;

  const contractIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none">
      <path d="M7 4.5h7l3 3V19.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M14 4.5v3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M8.5 12.5h7M8.5 15.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `;

  const pixStatusLabels = {
    created: 'criada',
    waiting_payment: 'aguardando',
    paid: 'paga',
    expired: 'expirada',
    canceled: 'cancelada'
  };

  const withdrawalStatusLabels = {
    requested: 'solicitado',
    processing: 'em an\u00e1lise',
    paid: 'pago',
    failed: 'falhou',
    canceled: 'cancelado'
  };

  const cardStatusLabels = {
    active: 'ativo',
    inactive: 'inativo',
    blocked: 'bloqueado',
    canceled: 'cancelado',
    cancel_pending: 'cancelamento em análise'
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

  async function copyToClipboard(value) {
    if (!value) {
      return false;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (err) {
        // fallback below
      }
    }
    try {
      const temp = document.createElement('textarea');
      temp.value = value;
      temp.setAttribute('readonly', '');
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(temp);
      return ok;
    } catch (err) {
      return false;
    }
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

  function formatShortDate(value) {
    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatPercent(value, digits = 0) {
    if (!Number.isFinite(value)) {
      return '0%';
    }
    return `${value.toFixed(digits)}%`;
  }

  function getInitials(name) {
    if (!name) {
      return '--';
    }
    const parts = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) {
      return '--';
    }
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
    return `${first}${last}`.toUpperCase();
  }

  function renderProfile() {
    if (!elements.profileName && !elements.profileAccountId) {
      return;
    }
    const user = state.user || {};
    const name = user.name || 'Conta GhostPay';
    const email = user.email || '--';
    const account = state.accounts[0];
    const accountId = (account && (account.accountNumber || account.id)) || user.id || '--';
    const createdAt = account && account.createdAt ? formatDate(account.createdAt) : '--';
    const cpfKey = state.pixKeys.find((key) => key.type === 'cpf') || state.pixKeys[0];
    const pixKeyValue = cpfKey ? cpfKey.value : '--';

    if (elements.profileName) {
      elements.profileName.textContent = name;
    }
    if (elements.profileInitials) {
      elements.profileInitials.textContent = getInitials(name);
    }
    if (elements.profileAccountId) {
      elements.profileAccountId.textContent = accountId;
    }
    if (elements.profileCreatedAt) {
      elements.profileCreatedAt.textContent = createdAt;
    }
    if (elements.profileFullName) {
      elements.profileFullName.textContent = name;
    }
    if (elements.profileEmail) {
      elements.profileEmail.textContent = email;
    }
    if (elements.profileCpf) {
      elements.profileCpf.textContent = user.cpf || '--';
    }
    if (elements.profilePhone) {
      elements.profilePhone.textContent = user.phone || '--';
    }
    if (elements.profilePixKey) {
      elements.profilePixKey.textContent = pixKeyValue || '--';
    }
  }

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function isSameDay(a, b) {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
  }

  function buildLinePath(values) {
    if (!values.length) {
      return '';
    }
    const maxValue = Math.max(...values, 1);
    const step = values.length > 1 ? 100 / (values.length - 1) : 100;
    return values
      .map((value, index) => {
        const x = step * index;
        const y = 100 - (value / maxValue) * 100;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  function updateLineChart(values) {
    if (!elements.salesChartLine || !elements.salesChartFill) {
      return;
    }
    const path = buildLinePath(values);
    if (!path) {
      elements.salesChartLine.setAttribute('d', '');
      elements.salesChartFill.setAttribute('d', '');
      return;
    }
    elements.salesChartLine.setAttribute('d', path);
    elements.salesChartFill.setAttribute('d', `${path} L 100 100 L 0 100 Z`);
  }

  function setPlanSelection(plan) {
    if (!elements.planField) {
      return;
    }
    const normalized = plan ? plan.toLowerCase() : '';
    const label = planLabels[normalized] || '';
    elements.planField.value = label ? normalized : '';
    if (elements.planSummaryLabel) {
      elements.planSummaryLabel.textContent = label || 'Selecione um plano';
    }
    if (elements.planSummary) {
      elements.planSummary.classList.toggle('is-empty', !label);
    }
    if (!label && elements.subscriptionSession) {
      elements.subscriptionSession.value = '';
    }
  }

  function setRegisterAllowed(allowed, message) {
    if (!elements.registerForm) {
      return;
    }
    const submit = elements.registerForm.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = !allowed;
    }
    if (message) {
      setError(message);
    } else if (allowed) {
      setError('');
    }
  }

  async function checkSubscriptionSession(sessionId) {
    try {
      const response = await apiRequest(`/api/subscriptions/status?session=${encodeURIComponent(sessionId)}`);
      if (response.approved) {
        if (elements.subscriptionSession) {
          elements.subscriptionSession.value = sessionId;
        }
        setPlanSelection('infinity');
        setRegisterAllowed(true);
        showToast('Assinatura aprovada. Finalize seu cadastro.');
        return;
      }
      setRegisterAllowed(false, 'Pagamento pendente. Conclua a assinatura para continuar.');
    } catch (err) {
      setRegisterAllowed(false, 'Assinatura não encontrada. Inicie pelo plano Infinity.');
    }
  }

  function getAccountLabel(accountId, fallback = 'Conta não vinculada') {
    if (!accountId) {
      return fallback;
    }
    const account = state.accounts.find((item) => item.id === accountId);
    if (!account) {
      return 'Conta não encontrada';
    }
    const numberLabel = account.accountNumber ? ` - ${account.accountNumber}` : '';
    return `${account.name} (${account.currency})${numberLabel}`;
  }

  function formatCardType(type) {
    return type === 'physical' ? 'Físico' : 'Virtual';
  }

  function formatCardStatus(status) {
    return cardStatusLabels[status] || status;
  }

  function formatPixKeyType(type) {
    if (type === 'cpf') {
      return 'CPF';
    }
    if (type === 'phone') {
      return 'Celular';
    }
    if (type === 'email') {
      return 'E-mail';
    }
    return 'Chave aleat\u00f3ria';
  }

  function statusClassFor(status) {
    if (status === 'active') {
      return 'active';
    }
    if (status === 'cancel_pending') {
      return 'pending';
    }
    return 'disabled';
  }

  function getCardExpiry(createdAt) {
    if (!createdAt) {
      return '--/--';
    }
    const date = new Date(createdAt);
    const expiry = new Date(date);
    expiry.setFullYear(expiry.getFullYear() + 4);
    const month = String(expiry.getMonth() + 1).padStart(2, '0');
    const year = String(expiry.getFullYear()).slice(-2);
    return `${month}/${year}`;
  }

  function getCardIdFromUrl() {
    const url = new URL(window.location.href);
    const idParam = url.searchParams.get('id');
    if (idParam) {
      return idParam;
    }
    const match = window.location.pathname.match(/\/console\/cartoes\/([^/]+)/);
    return match ? match[1] : null;
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

  function initConfirmModal() {
    if (confirmModal.overlay) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
        <h3 class="modal-title" id="confirmTitle">Confirmar</h3>
        <p class="muted" id="confirmMessage">Tem certeza?</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-modal-cancel>Cancelar</button>
          <button class="btn btn-ghost btn-danger" type="button" data-modal-confirm>Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    confirmModal.overlay = overlay;
    confirmModal.titleEl = overlay.querySelector('#confirmTitle');
    confirmModal.messageEl = overlay.querySelector('#confirmMessage');
    confirmModal.confirmBtn = overlay.querySelector('[data-modal-confirm]');
    confirmModal.cancelBtn = overlay.querySelector('[data-modal-cancel]');

    confirmModal.confirmBtn.addEventListener('click', () => closeConfirmModal(true));
    confirmModal.cancelBtn.addEventListener('click', () => closeConfirmModal(false));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeConfirmModal(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (confirmModal.isOpen && event.key === 'Escape') {
        closeConfirmModal(false);
      }
    });
  }

  function openConfirmModal(options = {}) {
    initConfirmModal();
    const {
      title = 'Confirmar ação',
      message = 'Tem certeza?',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar'
    } = options;

    confirmModal.titleEl.textContent = title;
    confirmModal.messageEl.textContent = message;
    confirmModal.confirmBtn.textContent = confirmText;
    confirmModal.cancelBtn.textContent = cancelText;

    confirmModal.overlay.classList.add('is-visible');
    document.body.classList.add('modal-open');
    confirmModal.isOpen = true;
    confirmModal.confirmBtn.focus();

    return new Promise((resolve) => {
      confirmModal.resolve = resolve;
    });
  }

  function closeConfirmModal(result) {
    if (!confirmModal.overlay) {
      return;
    }
    confirmModal.overlay.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    confirmModal.isOpen = false;
    if (confirmModal.resolve) {
      confirmModal.resolve(result);
      confirmModal.resolve = null;
    }
  }

  function initCancelModal() {
    if (cancelModal.overlay) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cancelTitle" aria-describedby="cancelMessage">
        <h3 class="modal-title" id="cancelTitle">Solicitar cancelamento</h3>
        <p class="muted" id="cancelMessage">Sua solicitação passará pelas etapas abaixo:</p>
        <ul class="modal-list">
          <li>Validação de identidade e titularidade</li>
          <li>Revisão de contratos e termos aplicáveis</li>
          <li>Prazo estimado de análise: 24-72h úteis</li>
        </ul>
        <label class="modal-check">
          <input type="checkbox" />
          Li e concordo com os termos de cancelamento.
        </label>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-cancel-close>Voltar</button>
          <button class="btn btn-ghost btn-danger" type="button" data-cancel-confirm disabled>Solicitar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    cancelModal.overlay = overlay;
    cancelModal.titleEl = overlay.querySelector('#cancelTitle');
    cancelModal.messageEl = overlay.querySelector('#cancelMessage');
    cancelModal.confirmBtn = overlay.querySelector('[data-cancel-confirm]');
    cancelModal.cancelBtn = overlay.querySelector('[data-cancel-close]');
    cancelModal.checkbox = overlay.querySelector('input[type="checkbox"]');

    cancelModal.checkbox.addEventListener('change', (event) => {
      cancelModal.confirmBtn.disabled = !event.target.checked;
    });
    cancelModal.confirmBtn.addEventListener('click', () => closeCancelModal(true));
    cancelModal.cancelBtn.addEventListener('click', () => closeCancelModal(false));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeCancelModal(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (cancelModal.isOpen && event.key === 'Escape') {
        closeCancelModal(false);
      }
    });
  }

  function openCancelModal({ cardLabel }) {
    initCancelModal();
    cancelModal.messageEl.textContent = `Sua solicitação para ${cardLabel} passará pelas etapas abaixo:`;
    cancelModal.checkbox.checked = false;
    cancelModal.confirmBtn.disabled = true;

    cancelModal.overlay.classList.add('is-visible');
    document.body.classList.add('modal-open');
    cancelModal.isOpen = true;
    cancelModal.cancelBtn.focus();

    return new Promise((resolve) => {
      cancelModal.resolve = resolve;
    });
  }

  function closeCancelModal(result) {
    if (!cancelModal.overlay) {
      return;
    }
    cancelModal.overlay.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    cancelModal.isOpen = false;
    if (cancelModal.resolve) {
      cancelModal.resolve(result);
      cancelModal.resolve = null;
    }
  }

  function openLinkModal() {
    if (!elements.linkModal) {
      return;
    }
    if (elements.pixChargeOutput) {
      elements.pixChargeOutput.classList.add('hidden');
    }
    if (elements.pixChargeStatus) {
      elements.pixChargeStatus.textContent = '';
    }
    elements.linkModal.classList.add('is-visible');
    document.body.classList.add('modal-open');
  }

  function closeLinkModal() {
    if (!elements.linkModal) {
      return;
    }
    elements.linkModal.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
  }

  function closeActionMenus() {
    document.querySelectorAll('.actions-menu.is-open').forEach((menu) => {
      menu.classList.remove('is-open');
    });
  }

  function toggleActionMenu(button) {
    const menu = button.closest('.actions-menu');
    if (!menu) {
      return;
    }
    const isOpen = menu.classList.contains('is-open');
    closeActionMenus();
    if (!isOpen) {
      menu.classList.add('is-open');
    }
  }

  function openEditLinkModal(charge) {
    if (!elements.editLinkModal || !elements.editLinkForm) {
      return;
    }
    if (elements.editLinkIdField) {
      elements.editLinkIdField.value = charge.id;
    }
    if (elements.editLinkName) {
      elements.editLinkName.value = charge.description || '';
    }
    if (elements.editLinkAmount) {
      elements.editLinkAmount.value = (Number(charge.amountCents || 0) / 100).toFixed(2);
    }
    if (elements.editLinkId) {
      elements.editLinkId.textContent = charge.id || '--';
    }
    if (elements.editLinkStatus) {
      const label = pixStatusLabels[charge.status] || charge.status || '--';
      elements.editLinkStatus.textContent = label;
    }
    if (elements.editLinkSales) {
      elements.editLinkSales.textContent = charge.status === 'paid' ? '1' : '0';
    }
    if (elements.editLinkPrice) {
      elements.editLinkPrice.textContent = formatCents(charge.amountCents || 0, 'BRL');
    }
    if (elements.editLinkCreated) {
      elements.editLinkCreated.textContent = charge.createdAt ? formatShortDate(charge.createdAt) : '--';
    }
    if (elements.editLinkUrl) {
      elements.editLinkUrl.value = charge.payUrl || '';
    }
    elements.editLinkModal.classList.add('is-visible');
    document.body.classList.add('modal-open');
  }

  function closeEditLinkModal() {
    if (!elements.editLinkModal) {
      return;
    }
    elements.editLinkModal.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
  }

  function initModuleTabs() {
    document.querySelectorAll('[data-module-scope]').forEach((scope) => {
      const tabs = scope.querySelectorAll('[data-module-tabs] .tab-pill');
      const panels = scope.querySelectorAll('[data-panel]');
      if (!tabs.length || !panels.length) {
        return;
      }
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.panelTarget;
          tabs.forEach((item) => item.classList.toggle('active', item === tab));
          panels.forEach((panel) => {
            panel.classList.toggle('is-active', panel.dataset.panel === target);
          });
        });
      });
    });
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
      const error = new Error(data.error || 'Falha na solicitação');
      error.status = response.status;
      throw error;
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
    document.documentElement.classList.toggle('auth-has-token', isAuthed);
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
    if (!isAuthed) {
      setError('');
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
    const currentValue = select.value;
    select.innerHTML = placeholder || '';
    state.accounts.forEach((account) => {
      const option = document.createElement('option');
      option.value = account.id;
      const numberLabel = account.accountNumber ? ` - ${account.accountNumber}` : '';
      option.textContent = `${account.name} (${account.currency})${numberLabel}`;
      select.appendChild(option);
    });
    if (currentValue) {
      const hasValue = Array.from(select.options).some((option) => option.value === currentValue);
      if (hasValue) {
        select.value = currentValue;
      }
    }
  }

  function updateAccountSelects() {
    if (elements.transactionForm) {
      fillAccountSelect(elements.transactionForm.elements.fromAccountId, '<option value="">Selecionar conta</option>');
      fillAccountSelect(elements.transactionForm.elements.toAccountId, '<option value="">Selecionar conta</option>');
    }
    if (elements.pixKeyForm) {
      fillAccountSelect(elements.pixKeyForm.elements.accountId, '<option value="">Selecionar conta</option>');
    }
    if (elements.pixTransferForm) {
      fillAccountSelect(elements.pixTransferForm.elements.accountId, '<option value="">Selecionar conta</option>');
    }
      if (elements.pixChargeForm && elements.pixChargeForm.elements.accountId) {
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

  function renderGatewayMetrics(charges) {
    if (!charges || (!elements.metricSales && !elements.metricTicket && !elements.metricPixPaid)) {
      return;
    }

    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 30);
    const startPrev = new Date(now);
    startPrev.setDate(startPrev.getDate() - 60);
    const start7 = new Date(now);
    start7.setDate(start7.getDate() - 6);
    start7.setHours(0, 0, 0, 0);

    const totalCharges = charges.length;
    const paidCharges = charges.filter((charge) => charge.status === 'paid');
    const pendingCharges = charges.filter((charge) =>
      ['created', 'waiting_payment'].includes(charge.status)
    );
    const failedCharges = charges.filter((charge) => ['canceled', 'expired'].includes(charge.status));

    const getChargeDate = (charge) => new Date(charge.paidAt || charge.createdAt || now);

    const paidCharges30 = paidCharges.filter((charge) => getChargeDate(charge) >= start30);
    const paidAmount30 = paidCharges30.reduce((sum, charge) => sum + Number(charge.amountCents || 0), 0);
    const prevAmount30 = paidCharges.reduce((sum, charge) => {
      const paidAt = getChargeDate(charge);
      return paidAt >= startPrev && paidAt < start30 ? sum + Number(charge.amountCents || 0) : sum;
    }, 0);

    const totalPaidAmount = paidCharges.reduce((sum, charge) => sum + Number(charge.amountCents || 0), 0);
    const ticketAverage = paidCharges.length ? totalPaidAmount / paidCharges.length : 0;
    const ticketMax = paidCharges30.length
      ? Math.max(...paidCharges30.map((charge) => Number(charge.amountCents || 0)))
      : 0;
    const ticketMin = paidCharges30.length
      ? Math.min(...paidCharges30.map((charge) => Number(charge.amountCents || 0)))
      : 0;

    const salesToday = paidCharges.reduce((sum, charge) => {
      const paidAt = getChargeDate(charge);
      return isSameDay(paidAt, now) ? sum + Number(charge.amountCents || 0) : sum;
    }, 0);

    const conversionPct = totalCharges ? (paidCharges.length / totalCharges) * 100 : 0;
    const healthPct = Math.round(conversionPct);
    const healthLabel =
      healthPct >= 80 ? 'Excelente' : healthPct >= 60 ? 'Bom' : healthPct >= 40 ? 'Atenção' : 'Crítico';

    const series = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(start7);
      day.setDate(start7.getDate() + index);
      return paidCharges.reduce((sum, charge) => {
        const paidAt = getChargeDate(charge);
        return isSameDay(paidAt, day) ? sum + Number(charge.amountCents || 0) : sum;
      }, 0);
    });
    const revenue7d = series.reduce((sum, value) => sum + value, 0);
    const revenueMax = series.length ? Math.max(...series) : 0;
    const revenueMin = series.length ? Math.min(...series) : 0;
    const revenueAvg = series.length ? revenue7d / series.length : 0;
    const pendingAmount = pendingCharges.reduce((sum, charge) => sum + Number(charge.amountCents || 0), 0);

    if (elements.metricSales) {
      elements.metricSales.textContent = formatCents(paidAmount30, 'BRL');
    }
    if (elements.metricSalesDelta) {
      const delta =
        prevAmount30 > 0 ? ((paidAmount30 - prevAmount30) / prevAmount30) * 100 : paidAmount30 > 0 ? 100 : 0;
      const formatted = `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs mês anterior`;
      elements.metricSalesDelta.textContent = formatted;
    }
    if (elements.metricTicket) {
      elements.metricTicket.textContent = formatCents(ticketAverage, 'BRL');
    }
    if (elements.metricPixPaid) {
      elements.metricPixPaid.textContent = paidCharges.length;
    }
    if (elements.metricSalesToday) {
      elements.metricSalesToday.textContent = formatCents(salesToday, 'BRL');
    }
    if (elements.metricHealth) {
      elements.metricHealth.textContent = healthLabel;
    }
    if (elements.metricHealthBar) {
      elements.metricHealthBar.style.width = `${Math.min(100, Math.max(0, healthPct))}%`;
    }
    if (elements.metricHealthPct) {
      elements.metricHealthPct.textContent = `${formatPercent(healthPct)} de pagamentos confirmados`;
    }
    if (elements.metricRevenue) {
      elements.metricRevenue.textContent = formatCents(revenue7d, 'BRL');
    }
    if (elements.metricRevenueMax) {
      elements.metricRevenueMax.textContent = formatCents(revenueMax, 'BRL');
    }
    if (elements.metricRevenueMin) {
      elements.metricRevenueMin.textContent = formatCents(revenueMin, 'BRL');
    }
    if (elements.metricRevenueAvg) {
      elements.metricRevenueAvg.textContent = formatCents(revenueAvg, 'BRL');
    }
    if (elements.metricTicketMax) {
      elements.metricTicketMax.textContent = formatCents(ticketMax, 'BRL');
    }
    if (elements.metricTicketMin) {
      elements.metricTicketMin.textContent = formatCents(ticketMin, 'BRL');
    }
    if (elements.metricConversion) {
      elements.metricConversion.textContent = formatPercent(healthPct);
    }
    if (elements.metricChargeTotal) {
      elements.metricChargeTotal.textContent = totalCharges;
    }
    if (elements.metricChargePaid) {
      elements.metricChargePaid.textContent = paidCharges.length;
    }
    if (elements.metricChargePending) {
      elements.metricChargePending.textContent = pendingCharges.length;
    }
    if (elements.metricChargePendingValue) {
      elements.metricChargePendingValue.textContent = formatCents(pendingAmount, 'BRL');
    }
    if (elements.metricChargeFailed) {
      elements.metricChargeFailed.textContent = failedCharges.length;
    }
    if (elements.metricChargeRevenue) {
      elements.metricChargeRevenue.textContent = formatCents(paidAmount30, 'BRL');
    }
    if (elements.conversionDonut) {
      const donutPct = Math.min(100, Math.max(0, Math.round(conversionPct)));
      elements.conversionDonut.setAttribute('stroke-dasharray', `${donutPct} ${100 - donutPct}`);
    }

    updateLineChart(series);

    if (elements.overviewRange) {
      elements.overviewRange.textContent = `${formatShortDate(start30)} - ${formatShortDate(now)}`;
    }
    if (elements.transactionsRange) {
      elements.transactionsRange.textContent = `${formatShortDate(start30)} - ${formatShortDate(now)}`;
    }
  }

  function renderBalanceSummary(balance, withdrawals) {
    if (!balance || (!elements.balanceAvailable && !elements.balanceReserve)) {
      return;
    }
    const totalCents = Number(balance.total_cents ? 0);
    const availableCents =
      balance.available_cents != null ? Number(balance.available_cents) : totalCents - Number(balance.hold_cents || 0);
    const holdCents = Number(balance.hold_cents || 0);
    const pendingInCents = Number(balance.pending_in_cents || 0);
    const pendingOutCents =
      Array.isArray(withdrawals) && withdrawals.length
        ? withdrawals.reduce((sum, item) => {
            if (item.status === 'requested' || item.status === 'processing') {
              return sum + Number(item.amount_cents || 0);
            }
            return sum;
          }, 0)
        : holdCents;
    const reserveCents = Math.max(0, holdCents - pendingOutCents);

    if (elements.balanceAvailable) {
      elements.balanceAvailable.textContent = formatCents(availableCents, 'BRL');
    }
    if (elements.balanceReserve) {
      elements.balanceReserve.textContent = formatCents(reserveCents, 'BRL');
    }
    if (elements.balancePending) {
      elements.balancePending.textContent = formatCents(pendingOutCents, 'BRL');
    }
    if (elements.balanceBlocked) {
      elements.balanceBlocked.textContent = formatCents(pendingInCents, 'BRL');
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
        .map((account) => {
          return `
            <div class="list-item">
              <strong>${account.name}</strong>
              <div class="list-meta">
                <span>${account.currency} - ${account.accountNumber}</span>
                <strong>${formatCents(account.balanceCents, account.currency)}</strong>
              </div>
            </div>
          `;
        })
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
      elements.transactionsList.innerHTML = '<div class="list-item">Nenhuma transação encontrada.</div>';
      return;
    }

    const fullView = elements.transactionsList.dataset.full === 'true';
    const header = fullView
      ? `
        <div class="table-row table-header">
          <span>Cliente</span>
          <span>Pagamento</span>
          <span>External ID / E2E</span>
          <span>Gerada/Paga</span>
          <span>Status</span>
        </div>
      `
      : `
        <div class="table-row table-header">
          <span>Transação</span>
          <span>Tipo</span>
          <span>Valor</span>
          <span>Data/Hora</span>
          <span>Status</span>
        </div>
      `;

    const rows = transactions
      .map((transaction) => {
        const label = labels[transaction.type] || transaction.type;
        const amount = formatCents(transaction.amountCents, 'BRL');
        const status = String(transaction.status || 'completed');
        const normalized = status.toLowerCase();
        const statusClass =
          normalized === 'completed' || normalized === 'paid'
            ? 'paid'
            : normalized === 'pending' || normalized === 'processing'
            ? 'pending'
            : 'failed';
        const statusLabel =
          normalized === 'completed' || normalized === 'paid'
            ? 'Pago'
            : normalized === 'pending' || normalized === 'processing'
            ? 'Pendente'
            : status;

        if (fullView) {
          const clientLabel = transaction.counterparty || 'Não informado';
          const externalId =
            (transaction.metadata && transaction.metadata.externalIdentifier) ||
            (transaction.metadata && transaction.metadata.externalDocument) ||
            transaction.id;
          return `
            <div class="table-row">
              <span data-label="Cliente">
                <strong>${clientLabel}</strong>
                ${transaction.note ? `<span class="muted">${transaction.note}</span>` : ''}
              </span>
              <span data-label="Pagamento">
                <strong>${amount}</strong>
                <span class="muted">${label}</span>
              </span>
              <span data-label="External ID / E2E">
                <strong>${externalId}</strong>
                <span class="muted">Ref ${transaction.id}</span>
              </span>
              <span data-label="Gerada/Paga">${formatDate(transaction.createdAt)}</span>
              <span data-label="Status"><span class="status-pill ${statusClass}">${statusLabel}</span></span>
            </div>
          `;
        }

        const detailParts = [];
        if (transaction.counterparty) {
          detailParts.push(transaction.counterparty);
        }
        if (transaction.note) {
          detailParts.push(transaction.note);
        }
        const detailsLine = detailParts.join(' | ');
        const title = transaction.counterparty || label;

        return `
          <div class="table-row">
            <span data-label="Transação">
              <strong>${title}</strong>
              ${detailsLine ? `<span class="muted">${detailsLine}</span>` : ''}
            </span>
            <span data-label="Tipo">${label}</span>
            <span data-label="Valor">${amount}</span>
            <span data-label="Data/Hora">${formatDate(transaction.createdAt)}</span>
            <span data-label="Status"><span class="status-pill ${statusClass}">${statusLabel}</span></span>
          </div>
        `;
      })
      .join('');

    elements.transactionsList.innerHTML = header + rows;
  }

function renderPixKeys(keys) {
    if (elements.pixKeysList) {
      if (!keys.length) {
        elements.pixKeysList.innerHTML = '<span class="pill">Sem chaves Pix</span>';
      } else {
        elements.pixKeysList.innerHTML = keys
          .map((key) => {
            const accountLabel = getAccountLabel(key.accountId);
            const label = `${key.type.toUpperCase()}: ${key.value}`;
            return `
              <div class="pix-key">
                <div class="pix-key-text">
                  <span class="pix-key-title">${key.type.toUpperCase()}: ${key.value}</span>
                  <span class="pix-key-meta">Conta: ${accountLabel}</span>
                </div>
                <div class="pix-key-actions">
                  <button class="btn btn-ghost btn-xs btn-icon-only" type="button" data-action="copy-key" data-value="${key.value}" aria-label="Copiar chave Pix">
                    <span class="sr-only">Copiar</span>
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <use href="/assets/icons.svg#icon-copy"></use>
                      </svg>
                    </span>
                  </button>
                  <button class="btn btn-ghost btn-xs btn-danger btn-icon-only" type="button" data-action="delete-key" data-id="${key.id}" data-label="${label}" aria-label="Remover chave Pix">
                    <span class="sr-only">Remover</span>
                    <span class="btn-icon" aria-hidden="true">${trashIcon}</span>
                  </button>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }
    updatePixChargeKeyOptions();
  }


  function updatePixChargeKeyOptions() {
    if (!elements.pixChargeForm) {
      return;
    }

    const keySelect = elements.pixChargeForm.elements.keyId;
    const accountSelect = elements.pixChargeForm.elements.accountId;
    if (!keySelect || !accountSelect) {
      return;
    }
    const accountId = accountSelect ? accountSelect.value : '';
    const keysForAccount = accountId
      ? state.pixKeys.filter((key) => !key.accountId || key.accountId === accountId)
      : [];

    keySelect.innerHTML = '';

    if (!accountId) {
      keySelect.disabled = true;
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Selecione uma conta';
      keySelect.appendChild(option);
      return;
    }

    if (!keysForAccount.length) {
      keySelect.disabled = true;
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Sem chaves para esta conta';
      keySelect.appendChild(option);
      return;
    }

    keySelect.disabled = false;
    keysForAccount.forEach((key) => {
      const option = document.createElement('option');
      option.value = key.id;
      const accountLabel = getAccountLabel(key.accountId);
      option.textContent = `${key.type.toUpperCase()} - ${key.value} (${accountLabel})`;
      keySelect.appendChild(option);
    });
  }

  function normalizePixCharge(raw) {
    if (!raw) {
      return null;
    }
    return {
      id: raw.charge_id || raw.id,
      amountCents: raw.amount_cents != null ? raw.amount_cents : raw.amountCents,
      description: raw.description || '',
      status: raw.status,
      createdAt: raw.created_at || raw.createdAt,
      paidAt: raw.paid_at || raw.paidAt || null,
      txid: raw.txid || null,
      payUrl: raw.pay_url || raw.payUrl || null
    };
  }

  function renderPixCharges(charges) {
    if (!elements.pixChargesList) {
      return;
    }
    if (!charges.length) {
      elements.pixChargesList.innerHTML = '<div class="list-item">Nenhum link de pagamento criado.</div>';
      return;
    }

    const header = `
      <div class="table-row table-header">
        <span>Nome do link</span>
        <span>Pre&ccedil;o</span>
        <span>Vendas</span>
        <span>Status</span>
        <span></span>
      </div>
    `;

    const rows = charges
      .map((charge) => {
        const statusLabel = pixStatusLabels[charge.status] || charge.status;
        const statusClass =
          charge.status === 'created' || charge.status === 'waiting_payment'
            ? 'pending'
            : charge.status === 'paid'
            ? 'paid'
            : 'failed';
        const name = charge.description ? charge.description : 'Link sem nome';
        const salesCount = charge.status === 'paid' ? 1 : 0;
        const payUrl = charge.payUrl || '';
        const actionMarkup = payUrl
          ? `
            <div class="actions-menu" data-menu>
              <button class="btn btn-ghost btn-icon-only" type="button" data-action="toggle-menu" data-id="${charge.id}" aria-label="Ações">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <use href="/assets/icons.svg#icon-more"></use>
                </svg>
              </button>
              <div class="actions-menu__dropdown" role="menu">
                <button class="actions-menu__item" type="button" data-action="edit-link" data-id="${charge.id}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use href="/assets/icons.svg#icon-pencil"></use>
                  </svg>
                  Editar
                </button>
                <button class="actions-menu__item danger" type="button" data-action="delete-link" data-id="${charge.id}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use href="/assets/icons.svg#icon-trash"></use>
                  </svg>
                  Deletar
                </button>
                <button class="actions-menu__item" type="button" data-action="inactivate-link" data-id="${charge.id}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use href="/assets/icons.svg#icon-ban"></use>
                  </svg>
                  Inativar
                </button>
                <button class="actions-menu__item" type="button" data-action="open-link" data-link="${payUrl}" data-id="${charge.id}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use href="/assets/icons.svg#icon-folder"></use>
                  </svg>
                  Link
                </button>
              </div>
            </div>`
          : '<span class="muted">--</span>';

        return `
          <div class="table-row">
            <span data-label="Nome do link">
              <span class="link-name">
                <span class="link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use href="/assets/icons.svg#icon-link"></use>
                  </svg>
                </span>
                <span>${name}</span>
              </span>
            </span>
            <span data-label="Pre&ccedil;o">${formatCents(charge.amountCents, 'BRL')}</span>
            <span data-label="Vendas">${salesCount}</span>
            <span data-label="Status"><span class="status-pill ${statusClass}">${statusLabel}</span></span>
            <span data-label="A&ccedil;&otilde;es">${actionMarkup}</span>
          </div>
        `;
      })
      .join('');

    elements.pixChargesList.innerHTML = header + rows;
  }

  function renderWithdrawals(withdrawals) {
      if (!elements.withdrawalsList) {
        return;
      }
      if (!withdrawals.length) {
        elements.withdrawalsList.innerHTML = '<div class="list-item">Nenhum saque solicitado.</div>';
        return;
      }

      const header = `
        <div class="table-row table-header">
          <span>Valor</span>
          <span>Chave Pix</span>
          <span>Solicitado em</span>
          <span>Status</span>
        </div>
      `;

      const rows = withdrawals
        .map((withdrawal) => {
          const statusLabel = withdrawalStatusLabels[withdrawal.status] || withdrawal.status;
          const statusClass =
            withdrawal.status === 'requested' || withdrawal.status === 'processing'
              ? 'pending'
              : withdrawal.status === 'paid'
              ? 'paid'
              : 'failed';
          const keyTypeLabel = formatPixKeyType(withdrawal.pix_key_type);
          const requestedAt = withdrawal.requested_at ? formatDate(withdrawal.requested_at) : '--';
          const note = withdrawal.admin_note ? `<span class="muted">Obs: ${withdrawal.admin_note}</span>` : '';
          const proof = withdrawal.proof_url
            ? `<a class="muted" href="${withdrawal.proof_url}" target="_blank" rel="noreferrer">Comprovante</a>`
            : '';

          return `
            <div class="table-row">
              <span data-label="Valor">
                <strong>${formatCents(withdrawal.amount_cents, 'BRL')}</strong>
                <span class="muted">ID ${withdrawal.id}</span>
              </span>
              <span data-label="Chave Pix">
                <strong>${keyTypeLabel}</strong>
                <span class="muted">${withdrawal.pix_key}</span>
              </span>
              <span data-label="Solicitado em">${requestedAt}</span>
              <span data-label="Status">
                <span class="status-pill ${statusClass}">${statusLabel}</span>
                ${note}
                ${proof}
              </span>
            </div>
          `;
        })
        .join('');

      elements.withdrawalsList.innerHTML = header + rows;
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
          const statusLabel = formatCardStatus(card.status);
          const statusClass = statusClassFor(card.status);

    state.activeCard = card;
          const label = `${card.brand} **** ${card.last4}`;
          return `
            <div class="list-item">
              <div class="list-row">
                <strong>${label}</strong>
                <a class="btn btn-ghost btn-xs" href="/console/cartoes/${card.id}">Ver cartão</a>
              </div>
              <div class="list-meta">
                <span>${formatCardType(card.type)} - ${statusLabel}</span>
                <span>${formatCents(card.availableCents, 'BRL')} disponível</span>
              </div>
              <div class="list-meta">
                <span class="status-pill ${statusClass}">${statusLabel}</span>
              </div>
            </div>
          `;
        })
        .join('');
    }

    if (elements.cardTxnForm) {
      const cardSelect = elements.cardTxnForm.elements.cardId;
      cardSelect.innerHTML = '';
      const activeCards = cards.filter((card) => card.status === 'active');
      if (!activeCards.length) {
        cardSelect.disabled = true;
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nenhum cartão ativo';
        cardSelect.appendChild(option);
        return;
      }
      cardSelect.disabled = false;
      activeCards.forEach((card) => {
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = `${card.brand} **** ${card.last4}`;
        cardSelect.appendChild(option);
      });
    }
  }

  function renderCardTransactions(transactions) {
    renderCardTransactionsList(elements.cardTransactionsList, transactions);
  }

  function renderCardTransactionsList(container, transactions) {
    if (!container) {
      return;
    }
    if (!transactions.length) {
      container.innerHTML = '<div class="list-item">Sem compras registradas.</div>';
      return;
    }

    container.innerHTML = transactions
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

  async function loadWithdrawals() {
    if (!elements.withdrawalsList && !elements.withdrawalForm) {
      return;
    }
    if (elements.withdrawalsList) {
      renderSkeleton(elements.withdrawalsList, 2);
    }
    try {
      const data = await apiRequest('/v1/withdrawals');
      state.withdrawals = data.withdrawals || [];
      renderWithdrawals(state.withdrawals);
    } catch (err) {
      if (err && err.status === 401) {
        return;
      }
      if (elements.withdrawalsList) {
        elements.withdrawalsList.innerHTML = '<div class="list-item">Falha ao carregar saques.</div>';
      }
      showToast(err.message, 'error');
    }
  }


  async function loadOverview() {
    if (elements.accountsList) {
      renderSkeleton(elements.accountsList, 2);
    }
    if (elements.transactionsList) {
      renderSkeleton(elements.transactionsList, 3);
    }

    const needsBalanceSummary = Boolean(
      elements.balanceAvailable ||
        elements.balanceReserve ||
        elements.balancePending ||
        elements.balanceBlocked
    );
    const needsChargeMetrics = Boolean(
      elements.metricSales ||
        elements.metricTicket ||
        elements.metricPixPaid ||
        elements.metricRevenue ||
        elements.metricConversion ||
        elements.metricChargeTotal ||
        elements.metricChargePaid ||
        elements.metricChargePending ||
        elements.salesChartLine
    );
    const needsFullTransactions = Boolean(
      elements.transactionsList && elements.transactionsList.dataset.full === 'true'
    );

    try {
      const overviewPromise = apiRequest('/api/overview');
      const balancePromise = needsBalanceSummary
        ? apiRequest('/v1/balance').catch(() => null)
        : Promise.resolve(null);
      const chargesPromise = needsChargeMetrics
        ? apiRequest('/v1/charges?limit=50').catch(() => null)
        : Promise.resolve(null);
      const transactionsPromise = needsFullTransactions
        ? apiRequest('/api/transactions?limit=50').catch(() => null)
        : Promise.resolve(null);

      const [data, balanceData, chargesData, transactionsData] = await Promise.all([
        overviewPromise,
        balancePromise,
        chargesPromise,
        transactionsPromise
      ]);

      state.accounts = data.accounts || [];
      state.transactions = needsFullTransactions && transactionsData
        ? transactionsData.transactions || []
        : data.recentTransactions || [];

      updateAccountSelects();
      renderAccounts(state.accounts);
      renderTransactions(state.transactions);
      renderMetrics(data.metrics || {});
      renderProfile();

      if (chargesData && chargesData.charges) {
        const normalized = chargesData.charges.map(normalizePixCharge).filter(Boolean);
        renderGatewayMetrics(normalized);
      }

      if (balanceData && balanceData.balance) {
        renderBalanceSummary(balanceData.balance, state.withdrawals);
      }

      if (elements.pixKeysList && state.pixKeys.length) {
        renderPixKeys(state.pixKeys);
      } else {
        updatePixChargeKeyOptions();
      }
      renderProfile();
      if (state.user) {
        elements.welcomeTitle.textContent = `Bem-vindo, ${state.user.name}`;
        if (elements.sidebarName) {
          elements.sidebarName.textContent = state.user.name;
        }
      }
      setError('');
    } catch (err) {
      if (err && err.status === 401) {
        setError('');
        return;
      }
      setError(err.message);
      throw err;
    }
  }

async function loadPix() {
      if (
        !elements.pixKeysList &&
        !elements.pixChargesList &&
        !elements.pixKeyForm &&
        !elements.pixTransferForm &&
        !elements.pixChargeForm &&
        !elements.withdrawalForm &&
        !elements.withdrawalsList
      ) {
        return;
      }
      if (elements.pixChargesList) {
        renderSkeleton(elements.pixChargesList, 2);
      }
      try {
        const tasks = [];
        if (elements.pixKeysList || elements.pixKeyForm) {
          tasks.push(apiRequest('/api/pix/keys'));
        } else {
          tasks.push(Promise.resolve({ keys: [] }));
        }
        tasks.push(apiRequest('/v1/charges?limit=50'));

        const [keys, charges] = await Promise.all(tasks);
        state.pixKeys = keys.keys || [];
        state.pixCharges = (charges.charges || [])
          .map(normalizePixCharge)
          .filter(Boolean);
        if (elements.pixKeysList) {
          renderPixKeys(state.pixKeys);
        }
        renderPixCharges(state.pixCharges);
        if (elements.withdrawalForm || elements.withdrawalsList) {
          await loadWithdrawals();
        }
        renderProfile();
      } catch (err) {
        if (err && err.status === 401) {
          return;
        }
        if (elements.pixKeysList) {
          elements.pixKeysList.innerHTML = '<span class="pill">Falha ao carregar Pix</span>';
        }
        if (elements.pixChargesList) {
          elements.pixChargesList.innerHTML = '<div class="list-item">Falha ao carregar links Pix.</div>';
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
      if (err && err.status === 401) {
        return;
      }
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

  async function loadCardDetail() {
    if (!elements.cardDetailPanel) {
      return;
    }
    const cardId = getCardIdFromUrl();
    if (!cardId) {
      setError('Cartão não encontrado.');
      return;
    }
    if (elements.cardDetailTransactionsList) {
      renderSkeleton(elements.cardDetailTransactionsList, 2);
    }
    try {
      const data = await apiRequest('/api/cards');
      state.cards = data.cards || [];
      const card = state.cards.find((item) => item.id === cardId);
      if (!card) {
        setError('Cartão não encontrado.');
        return;
      }
      renderCardDetail(card);
      const txData = await apiRequest(`/api/cards/${cardId}/transactions`);
      renderCardTransactionsList(elements.cardDetailTransactionsList, txData.transactions || []);
      setError('');
    } catch (err) {
      if (err && err.status === 401) {
        setError('');
        return;
      }
      setError(err.message);
      showToast(err.message, 'error');
    }
  }

  function maskCardNumber(last4) {
    const mask = '\u2022\u2022\u2022\u2022';
    const safeLast4 = String(last4 || '0000').padStart(4, '0');
    return `${mask} ${mask} ${mask} ${safeLast4}`;
  }

  function buildCardNumber(card) {
    const seed = `${card.id || ''}${card.last4 || ''}` || 'ghostpay';
    let digits = '';
    for (let i = 0; i < 12; i += 1) {
      const code = seed.charCodeAt(i % seed.length) || 7;
      digits += String(code % 10);
    }
    const last4 = String(card.last4 || '').padStart(4, '0');
    const number = `${digits}${last4}`;
    return number.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function setIconHref(el, href) {
    if (!el) {
      return;
    }
    el.setAttribute('href', href);
    el.setAttribute('xlink:href', href);
  }

  function updateCardNumberDisplay(card) {
    if (!card || !elements.cardVisualNumber) {
      return;
    }
    const fullNumber = buildCardNumber(card);
    const masked = maskCardNumber(card.last4);
    const show = state.cardNumberVisible;
    elements.cardVisualNumber.textContent = show ? fullNumber : masked;
    if (elements.cardNumberLabel) {
      elements.cardNumberLabel.textContent = show ? 'Ocultar n\u00FAmero' : 'Mostrar n\u00FAmero';
    }
    if (elements.cardNumberIcon) {
      setIconHref(elements.cardNumberIcon, show ? '/assets/icons.svg#icon-eye-off' : '/assets/icons.svg#icon-eye');
    }
    if (elements.toggleCardNumber) {
      elements.toggleCardNumber.setAttribute('aria-pressed', show ? 'true' : 'false');
    }
  }

  function renderCardDetail(card) {
    const label = `${card.brand} **** ${card.last4}`;
    const statusLabel = formatCardStatus(card.status);
    const statusClass = statusClassFor(card.status);

    if (elements.cardDetailTitle) {
      elements.cardDetailTitle.textContent = label;
    }
    if (elements.cardDetailSubtitle) {
      elements.cardDetailSubtitle.textContent = `${formatCardType(card.type)} · ${statusLabel}`;
    }
    updateCardNumberDisplay(card);
    if (elements.cardVisualHolder) {
      elements.cardVisualHolder.textContent = state.user && state.user.name ? state.user.name : 'Titular GhostPay';
    }
    if (elements.cardVisualExpiry) {
      elements.cardVisualExpiry.textContent = getCardExpiry(card.createdAt);
    }
    if (elements.cardStatusPill) {
      elements.cardStatusPill.className = `status-pill ${statusClass}`;
      elements.cardStatusPill.textContent = statusLabel;
    }
    if (elements.cardTypeTag) {
      elements.cardTypeTag.textContent = formatCardType(card.type);
    }
    if (elements.cardVisual) {
      elements.cardVisual.classList.toggle('card-visual--virtual', card.type === 'virtual');
      elements.cardVisual.classList.toggle('card-visual--physical', card.type === 'physical');
    }

    if (elements.cardDetailActions) {
      const actions = [];
      if (card.status === 'active') {
        actions.push(`
          <button class="btn btn-ghost btn-xs btn-warning btn-icon-only" type="button" data-action="block-card" data-id="${card.id}" data-label="${label}" aria-label="Bloquear cartão">
            <span class="sr-only">Bloquear</span>
            <span class="btn-icon" aria-hidden="true">${lockIcon}</span>
          </button>
        `);
        actions.push(`
          <button class="btn btn-ghost btn-xs btn-danger btn-icon-only" type="button" data-action="cancel-card" data-id="${card.id}" data-label="${label}" aria-label="Solicitar cancelamento">
            <span class="sr-only">Solicitar cancelamento</span>
            <span class="btn-icon" aria-hidden="true">${contractIcon}</span>
          </button>
        `);
      }
      if (card.status === 'blocked') {
        actions.push(`
          <button class="btn btn-ghost btn-xs btn-warning btn-icon-only" type="button" data-action="unblock-card" data-id="${card.id}" data-label="${label}" aria-label="Desbloquear cartão">
            <span class="sr-only">Desbloquear</span>
            <span class="btn-icon" aria-hidden="true">${unlockIcon}</span>
          </button>
        `);
        actions.push(`
          <button class="btn btn-ghost btn-xs btn-danger btn-icon-only" type="button" data-action="cancel-card" data-id="${card.id}" data-label="${label}" aria-label="Solicitar cancelamento">
            <span class="sr-only">Solicitar cancelamento</span>
            <span class="btn-icon" aria-hidden="true">${contractIcon}</span>
          </button>
        `);
      }
      elements.cardDetailActions.innerHTML = actions.join('');
    }

    if (elements.cardDetailNotice) {
      if (card.status === 'cancel_pending') {
        elements.cardDetailNotice.textContent =
          'Solicitacao em analise. Um especialista revisa sua documentacao e contratos.';
      } else if (card.status === 'canceled') {
        elements.cardDetailNotice.textContent =
          'Cartao cancelado. Para emitir um novo, solicite outra via.';
      } else if (card.status === 'blocked') {
        elements.cardDetailNotice.textContent =
          'Cartao bloqueado temporariamente. Compras ficam indisponiveis ate o desbloqueio.';
      } else {
        elements.cardDetailNotice.textContent =
          'Alguns dados sensiveis permanecem ocultos por seguranca.';
      }
    }

    if (elements.cardInfoStatus) {
      elements.cardInfoStatus.textContent = statusLabel;
    }
    if (elements.cardInfoType) {
      elements.cardInfoType.textContent = formatCardType(card.type);
    }
    if (elements.cardInfoBrand) {
      elements.cardInfoBrand.textContent = card.brand;
    }
    if (elements.cardInfoLast4) {
      elements.cardInfoLast4.textContent = card.last4;
    }
    if (elements.cardInfoLimit) {
      elements.cardInfoLimit.textContent = formatCents(card.limitCents, 'BRL');
    }
    if (elements.cardInfoAvailable) {
      elements.cardInfoAvailable.textContent = formatCents(card.availableCents, 'BRL');
    }
    if (elements.cardInfoAccount) {
      elements.cardInfoAccount.textContent = getAccountLabel(card.billingAccountId, 'Conta principal');
    }
    if (elements.cardInfoCreated) {
      elements.cardInfoCreated.textContent = formatDate(card.createdAt);
    }
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
        elements.metricSales ||
        elements.metricTicket ||
        elements.metricPixPaid ||
        elements.metricSalesToday ||
        elements.metricHealth ||
        elements.metricRevenue ||
        elements.metricRevenueMax ||
        elements.metricRevenueMin ||
        elements.metricRevenueAvg ||
        elements.metricTicketMax ||
        elements.metricTicketMin ||
        elements.metricConversion ||
        elements.metricChargeTotal ||
        elements.metricChargePaid ||
        elements.metricChargePending ||
        elements.metricChargePendingValue ||
        elements.metricChargeFailed ||
        elements.metricChargeRevenue ||
        elements.overviewRange ||
        elements.transactionsRange ||
        elements.balanceAvailable ||
        elements.balanceReserve ||
        elements.balancePending ||
        elements.balanceBlocked ||
        elements.pixTransferForm ||
        elements.pixChargeForm ||
        elements.cardForm ||
        elements.profileName ||
        elements.profileAccountId ||
        elements.profileFullName
    );
  }

  function needsPixData() {
    return Boolean(
      elements.pixKeysList ||
      elements.pixChargesList ||
      elements.pixKeyForm ||
      elements.pixTransferForm ||
      elements.pixChargeForm ||
      elements.withdrawalForm ||
      elements.withdrawalsList ||
      elements.profilePixKey
    );
  }

  function needsCardsData() {
    return Boolean(elements.cardsList || elements.cardTransactionsList || elements.cardForm || elements.cardTxnForm);
  }

  function needsCardDetail() {
    return Boolean(elements.cardDetailPanel);
  }

  async function loadPageData() {
    if (needsCardDetail()) {
      if (needsOverviewData()) {
        await loadOverview();
      }
      await loadCardDetail();
      if (needsPixData()) {
        await loadPix();
      }
      return;
    }

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
    if (target === 'login') {
      setError('');
    }
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

    const needsFrom = type === 'transfer' || type === 'payment' || type === 'withdrawal';
    const needsTo = type === 'transfer' || type === 'deposit';
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
    if (!needsFrom) {
      elements.transactionForm.elements.fromAccountId.value = '';
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

    if (!payload.plan) {
      setPlanSelection('');
      showToast('Selecione o plano Infinity para continuar.', 'error');
      return;
    }
    if (!payload.subscriptionSession) {
      showToast('Finalize a assinatura Infinity antes de criar a conta.', 'error');
      return;
    }

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
      const messages = {
        subscription_required: 'Finalize a assinatura Infinity antes de criar a conta.',
        subscription_not_approved: 'Pagamento ainda não aprovado. Aguarde a confirmação.',
        subscription_plan_mismatch: 'Plano inválido para esta assinatura.',
        subscription_already_used: 'Assinatura já utilizada.'
      };
      showToast(messages[err.message] || err.message, 'error');
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
      const messages = {
        'Account already exists': 'Sua conta principal j\u00E1 foi criada.',
        'Primary account is required': 'A conta principal \u00E9 obrigat\u00F3ria.'
      };
      showToast(messages[err.message] || err.message, 'error');
    }
  }

  async function handleTransaction(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.transactionForm).entries());

    if (payload.type === 'deposit' && !payload.toAccountId) {
      showToast('Selecione a conta de cr\u00E9dito.', 'error');
      return;
    }
    if (payload.type === 'withdrawal' && !payload.fromAccountId) {
      showToast('Selecione a conta de d\u00E9bito.', 'error');
      return;
    }
    if (payload.type === 'transfer' && (!payload.fromAccountId || !payload.toAccountId)) {
      showToast('Selecione as contas de d\u00E9bito e cr\u00E9dito.', 'error');
      return;
    }

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
    if (!payload.accountId) {
      showToast('Selecione uma conta para a chave Pix.', 'error');
      return;
    }
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

    async function handlePixKeyAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === 'copy-key') {
      const value = button.dataset.value || '';
      const ok = await copyToClipboard(value);
      showToast(ok ? 'Chave Pix copiada' : 'Não foi possível copiar a chave', ok ? 'info' : 'error');
      return;
    }
    if (action !== 'delete-key') {
      return;
    }
    const keyId = button.dataset.id;
    if (!keyId) {
      return;
    }
    const label = button.dataset.label || 'esta chave';
    const confirmed = await openConfirmModal({
      title: 'Remover chave Pix',
      message: `Remover a chave ${label}? Esta ação não pode ser desfeita.`,
      confirmText: 'Remover',
      cancelText: 'Cancelar'
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/api/pix/keys/${keyId}`, { method: 'DELETE' });
      await loadPix();
      showToast('Chave Pix removida');
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

  function setPixChargeOutputVisible(visible) {
    if (!elements.pixChargeOutput) {
      return;
    }
    elements.pixChargeOutput.classList.toggle('hidden', !visible);
  }

  function updatePixChargeOutput(payload) {
    if (!payload) {
      return;
    }
    if (elements.pixChargeQr && payload.qrCodeBase64) {
      elements.pixChargeQr.src = `data:image/png;base64,${payload.qrCodeBase64}`;
    }
    if (elements.pixChargeCode && payload.qrCode) {
      elements.pixChargeCode.value = payload.qrCode;
    }
    if (elements.pixChargeLink) {
      const payUrl = payload.payUrl || '';
      elements.pixChargeLink.value = payUrl;
      if (elements.pixChargeLinkCopy) {
        elements.pixChargeLinkCopy.disabled = !payUrl;
      }
    }
    if (elements.pixChargeTicket) {
      if (payload.ticketUrl) {
        elements.pixChargeTicket.href = payload.ticketUrl;
        elements.pixChargeTicket.classList.remove('hidden');
      } else {
        elements.pixChargeTicket.classList.add('hidden');
      }
    }
  }

  async function pollPixChargeStatus(chargeId) {
    if (!chargeId) {
      return;
    }
    pixChargePollAttempts += 1;
    try {
      const data = await apiRequest(`/api/public/charges/${encodeURIComponent(chargeId)}`);
      if (data.charge) {
        const status = data.charge.status;
        if (elements.pixChargeStatus) {
          if (status === 'paid') {
            elements.pixChargeStatus.textContent = 'Pagamento confirmado.';
          } else if (status === 'canceled' || status === 'expired') {
            elements.pixChargeStatus.textContent = 'Cobran\u00E7a expirada ou cancelada.';
          } else {
            elements.pixChargeStatus.textContent = 'Aguardando confirma\u00E7\u00E3o do pagamento.';
          }
        }
        updatePixChargeOutput({
          qrCode: data.charge.brCode,
          qrCodeBase64: data.charge.qrCodeBase64,
          ticketUrl: data.charge.ticketUrl
        });
        if (status === 'paid') {
          return;
        }
      }
    } catch (err) {
      if (elements.pixChargeStatus) {
        elements.pixChargeStatus.textContent = 'N\u00E3o foi poss\u00EDvel atualizar o status.';
      }
    }

    if (pixChargePollAttempts < 120 && activePixChargeId === chargeId) {
      pixChargePollTimer = setTimeout(() => pollPixChargeStatus(chargeId), 5000);
    }
  }

  async function handlePixChargeCreate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.pixChargeForm).entries());
    if (!payload.description) {
      delete payload.description;
    }
    if (!payload.amount) {
      showToast('Informe o valor do link.', 'error');
      return;
    }
    if (!payload.name || !payload.email || !payload.cpf) {
      showToast('Preencha os dados do pagador.', 'error');
      return;
    }
    const cpfDigits = String(payload.cpf || '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      showToast('Informe um CPF v\u00E1lido.', 'error');
      return;
    }

    const submit = elements.pixChargeForm.querySelector('button[type="submit"]');
    const originalLabel = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Gerando Pix...';
    }
    if (elements.pixChargeStatus) {
      elements.pixChargeStatus.textContent = '';
    }
    if (pixChargePollTimer) {
      clearTimeout(pixChargePollTimer);
    }
    pixChargePollAttempts = 0;

    const chargePayload = {
      amount: payload.amount,
      description: payload.description
    };
    const payerPayload = {
      name: payload.name,
      email: payload.email,
      cpf: cpfDigits,
      phone: payload.phone
    };

    try {
      const charge = await apiRequest('/v1/charges', {
        method: 'POST',
        body: JSON.stringify(chargePayload)
      });
      const chargeId = charge.charge_id;
      const payUrl = charge.pay_url || charge.payUrl || `${window.location.origin}/pay/${chargeId}`;
      const payment = await apiRequest(
        `/api/public/charges/${encodeURIComponent(chargeId)}/create_payment`,
        {
          method: 'POST',
          body: JSON.stringify(payerPayload)
        }
      );

      activePixChargeId = chargeId;
      updatePixChargeOutput({
        qrCode: payment.qrCode,
        qrCodeBase64: payment.qrCodeBase64,
        ticketUrl: payment.ticketUrl,
        payUrl
      });
      setPixChargeOutputVisible(true);
      if (elements.pixChargeStatus) {
        elements.pixChargeStatus.textContent = 'Aguardando confirma\u00E7\u00E3o do pagamento.';
      }
      pollPixChargeStatus(chargeId);
      await loadPix();
      showToast('Link Pix gerado');
    } catch (err) {
      const messages = {
        mp_not_configured: 'Mercado Pago n\u00E3o configurado. Verifique o token.',
        charge_payment_failed: 'N\u00E3o foi poss\u00EDvel gerar o Pix agora.',
        charge_unavailable: 'Cobran\u00E7a expirada ou cancelada.',
        Unauthorized: 'Sess\u00E3o expirada. Fa\u00E7a login novamente.'
      };
      const message = messages[err.message] || err.message;
      if (elements.pixChargeStatus) {
        elements.pixChargeStatus.textContent = message;
      }
      showToast(message, 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel || 'Gerar link Pix';
      }
    }
  }

  async function handlePixChargeAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === 'toggle-menu') {
      event.stopPropagation();
      toggleActionMenu(button);
      return;
    }

    const chargeId = button.dataset.id;
    const charge = state.pixCharges.find((item) => item.id === chargeId);
    if (!charge) {
      showToast('Link não encontrado', 'error');
      return;
    }

    if (action === 'open-link') {
      const link = button.dataset.link || charge.payUrl || '';
      if (!link) {
        showToast('Link indisponível', 'error');
        return;
      }
      const ok = await copyToClipboard(link);
      window.open(link, '_blank', 'noopener');
      showToast(ok ? 'Link copiado' : 'Não foi possível copiar o link', ok ? 'info' : 'error');
      closeActionMenus();
      return;
    }

    if (action === 'edit-link') {
      openEditLinkModal(charge);
      closeActionMenus();
      return;
    }

    if (action === 'inactivate-link') {
      const confirmed = await openConfirmModal({
        title: 'Inativar link',
        message: 'Deseja inativar este link de pagamento? O QR Code não poderá mais ser usado.',
        confirmText: 'Inativar',
        cancelText: 'Cancelar'
      });
      if (!confirmed) {
        return;
      }
      try {
        await apiRequest(`/v1/charges/${chargeId}/inactivate`, { method: 'POST' });
        await loadPix();
        showToast('Link inativado');
      } catch (err) {
        showToast(err.message, 'error');
      }
      closeActionMenus();
      return;
    }

    if (action === 'delete-link') {
      const confirmed = await openConfirmModal({
        title: 'Deletar link',
        message: 'Deseja remover este link do painel? Essa ação não pode ser desfeita.',
        confirmText: 'Deletar',
        cancelText: 'Cancelar'
      });
      if (!confirmed) {
        return;
      }
      try {
        await apiRequest(`/v1/charges/${chargeId}`, { method: 'DELETE' });
        await loadPix();
        showToast('Link removido');
      } catch (err) {
        showToast(err.message, 'error');
      }
      closeActionMenus();
    }
  }

  async function handleEditLinkSubmit(event) {
    event.preventDefault();
    if (!elements.editLinkForm) {
      return;
    }
    const payload = Object.fromEntries(new FormData(elements.editLinkForm).entries());
    const chargeId = payload.id;
    if (!chargeId) {
      showToast('Link n\u00e3o identificado.', 'error');
      return;
    }
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Informe um valor v\u00e1lido.', 'error');
      return;
    }

    const submit = elements.editLinkForm.querySelector('button[type="submit"]');
    const originalLabel = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Salvando...';
    }

    try {
      await apiRequest(`/v1/charges/${encodeURIComponent(chargeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount,
          description: payload.description ? String(payload.description).trim() : ''
        })
      });
      await loadPix();
      closeEditLinkModal();
      showToast('Link atualizado');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel || 'Salvar altera\u00e7\u00f5es';
      }
    }
  }

  async function handleWithdrawalCreate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.withdrawalForm).entries());
    if (!payload.amount) {
      showToast('Informe o valor do saque.', 'error');
      return;
    }
    if (!payload.pix_key) {
      showToast('Informe a chave Pix.', 'error');
      return;
    }

    const pixKeyType = payload.pix_key_type;
    let pixKey = String(payload.pix_key || '').trim();
    if (pixKeyType === 'cpf' || pixKeyType === 'phone') {
      pixKey = pixKey.replace(/\D/g, '');
    }
    if (!pixKey) {
      showToast('Informe uma chave Pix v\u00e1lida.', 'error');
      return;
    }

    const submit = elements.withdrawalForm.querySelector('button[type=\"submit\"]');
    const originalLabel = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Enviando...';
    }

    try {
      await apiRequest('/v1/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amount: payload.amount,
          pix_key_type: pixKeyType,
          pix_key: pixKey
        })
      });
      elements.withdrawalForm.reset();
      await loadWithdrawals();
      await loadOverview();
      showToast('Solicita\u00e7\u00e3o de saque enviada');
    } catch (err) {
      const messages = {
        'Insufficient funds': 'Saldo insuficiente para saque.',
        'Invalid amount': 'Valor inv\u00e1lido.',
        'Invalid Pix key': 'Chave Pix inv\u00e1lida.'
      };
      showToast(messages[err.message] || err.message, 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel || 'Solicitar saque';
      }
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

  async function handleCardAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const cardId = button.dataset.id;
    if (!cardId) {
      return;
    }
    const label = button.dataset.label || 'este cartão';
    const action = button.dataset.action;

    if (action === 'block-card') {
      const confirmed = await openConfirmModal({
        title: 'Bloquear cartão',
        message: `Bloquear ${label} temporariamente?`,
        confirmText: 'Bloquear',
        cancelText: 'Manter ativo'
      });
      if (!confirmed) {
        return;
      }
      try {
        await apiRequest(`/api/cards/${cardId}/block`, { method: 'POST' });
        await loadCards();
        showToast('Cartão bloqueado');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    if (action === 'unblock-card') {
      const confirmed = await openConfirmModal({
        title: 'Desbloquear cartão',
        message: `Desbloquear ${label}?`,
        confirmText: 'Desbloquear',
        cancelText: 'Manter bloqueado'
      });
      if (!confirmed) {
        return;
      }
      try {
        await apiRequest(`/api/cards/${cardId}/unblock`, { method: 'POST' });
        await loadCards();
        showToast('Cartão desbloqueado');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    if (action === 'cancel-card') {
      const confirmed = await openCancelModal({ cardLabel: label });
      if (!confirmed) {
        return;
      }
      try {
        await apiRequest(`/api/cards/${cardId}/cancel-request`, { method: 'POST' });
        await loadCards();
        showToast('Solicitação enviada');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  }

  async function initialize() {
    initModuleTabs();
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
    if (elements.pixKeysList) {
      elements.pixKeysList.addEventListener('click', handlePixKeyAction);
    }
    if (elements.pixTransferForm) {
      elements.pixTransferForm.addEventListener('submit', handlePixTransfer);
    }
    if (elements.pixChargeForm) {
      elements.pixChargeForm.addEventListener('submit', handlePixChargeCreate);
      if (elements.pixChargeForm.elements.accountId) {
        elements.pixChargeForm.elements.accountId.addEventListener('change', updatePixChargeKeyOptions);
      }
    }
    if (elements.pixChargeCopy) {
      elements.pixChargeCopy.addEventListener('click', async () => {
        const ok = await copyToClipboard(elements.pixChargeCode ? elements.pixChargeCode.value : '');
        showToast(ok ? 'C\u00F3digo Pix copiado' : 'N\u00E3o foi poss\u00EDvel copiar o c\u00F3digo', ok ? 'info' : 'error');
      });
    }
    if (elements.pixChargeLinkCopy) {
      elements.pixChargeLinkCopy.addEventListener('click', async () => {
        const ok = await copyToClipboard(elements.pixChargeLink ? elements.pixChargeLink.value : '');
        showToast(ok ? 'Link copiado' : 'N\u00E3o foi poss\u00EDvel copiar o link', ok ? 'info' : 'error');
      });
    }
    if (elements.pixChargesList) {
      elements.pixChargesList.addEventListener('click', handlePixChargeAction);
    }
    if (elements.openLinkModal) {
      elements.openLinkModal.addEventListener('click', openLinkModal);
    }
    if (elements.editLinkForm) {
      elements.editLinkForm.addEventListener('submit', handleEditLinkSubmit);
    }
    if (elements.editLinkCopy) {
      elements.editLinkCopy.addEventListener('click', async () => {
        const ok = await copyToClipboard(elements.editLinkUrl ? elements.editLinkUrl.value : '');
        showToast(ok ? 'Link copiado' : 'N\u00e3o foi poss\u00edvel copiar o link', ok ? 'info' : 'error');
      });
    }
    if (elements.editLinkModal) {
      elements.editLinkModal.addEventListener('click', (event) => {
        if (event.target === elements.editLinkModal) {
          closeEditLinkModal();
        }
      });
      elements.editLinkModal.querySelectorAll('[data-edit-modal-close]').forEach((button) => {
        button.addEventListener('click', closeEditLinkModal);
      });
    }
    if (elements.linkModal) {
      elements.linkModal.addEventListener('click', (event) => {
        if (event.target === elements.linkModal) {
          closeLinkModal();
        }
      });
      elements.linkModal.querySelectorAll('[data-link-modal-close]').forEach((button) => {
        button.addEventListener('click', closeLinkModal);
      });
    }
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.actions-menu')) {
        closeActionMenus();
      }
    });
    if (elements.withdrawalForm) {
      elements.withdrawalForm.addEventListener('submit', handleWithdrawalCreate);
    }
    if (elements.cardForm) {
      elements.cardForm.addEventListener('submit', handleCardCreate);
    }
    if (elements.cardsList) {
      elements.cardsList.addEventListener('click', handleCardAction);
    }
    if (elements.cardDetailActions) {
      elements.cardDetailActions.addEventListener('click', handleCardAction);
    }

    if (elements.toggleCardNumber) {
      elements.toggleCardNumber.addEventListener('click', () => {
        if (!state.activeCard) {
          return;
        }
        state.cardNumberVisible = !state.cardNumberVisible;
        updateCardNumberDisplay(state.activeCard);
      });
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
    if (elements.refreshWithdrawals) {
      elements.refreshWithdrawals.addEventListener('click', loadWithdrawals);
    }
    if (elements.refreshCards) {
      elements.refreshCards.addEventListener('click', loadCards);
    }
    if (elements.refreshCardTx) {
      elements.refreshCardTx.addEventListener('click', loadCards);
    }
    if (elements.refreshCardDetail) {
      elements.refreshCardDetail.addEventListener('click', loadCardDetail);
    }
    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener('click', async () => {
        const confirmed = await openConfirmModal({
          title: 'Sair da conta',
          message: 'Deseja realmente encerrar a sessão?',
          confirmText: 'Sair',
          cancelText: 'Cancelar'
        });
        if (!confirmed) {
          return;
        }
        setToken(null);
        state.user = null;
        setAuthUI(false);
        showToast('Sessão encerrada');
      });
    }

    const searchParams = new URLSearchParams(window.location.search);
    const preferredTab = (() => {
      const param = searchParams.get('tab');
      return param === 'register' ? 'register' : param === 'login' ? 'login' : null;
    })();
    const planParam = searchParams.get('plan');
    const sessionParam = searchParams.get('session');
    if (elements.registerForm) {
      setRegisterAllowed(false);
    }
    if (planParam && elements.registerForm) {
      setPlanSelection(planParam);
      if (elements.tabs.length) {
        setActiveTab('register');
      }
      if (sessionParam) {
        await checkSubscriptionSession(sessionParam);
      } else {
        setRegisterAllowed(false, 'Finalize a assinatura Infinity antes de criar a conta.');
      }
    } else {
      setPlanSelection(elements.planField ? elements.planField.value : '');
      if (preferredTab && elements.tabs.length) {
        setActiveTab(preferredTab);
      }
    }

    updateTransactionFields();
    updatePixKeyField();
    if (window.location.hash === '#linkForm') {
      openLinkModal();
    }

    if (state.token) {
      const decoded = decodeToken(state.token);
      const isExpired = decoded && decoded.exp ? decoded.exp * 1000 < Date.now() : false;
      if (!decoded || isExpired) {
        setToken(null);
        setAuthUI(false);
        return;
      }
      if (decoded.name || decoded.email) {
        state.user = {
          name: decoded.name || 'Conta GhostPay',
          email: decoded.email || ''
        };
      }
      try {
        await loadPageData();
        if (!state.token) {
          setAuthUI(false);
          return;
        }
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
