(() => {
  const root = document.documentElement;
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const topbar = document.querySelector('[data-topbar]');

  function normalizePath(path) {
    if (!path) {
      return '/';
    }
    let clean = path.split('?')[0].split('#')[0];
    clean = clean.replace(/\/index\.html$/, '/');
    clean = clean.replace(/\.html$/, '');
    clean = clean.replace(/\/+$/, '') || '/';
    return clean === '/index' ? '/' : clean;
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
  }

  function initTheme() {
    setTheme('dark');
  }

  function initNav() {
    if (!nav) {
      return;
    }
    const current = normalizePath(window.location.pathname);
    const currentHash = window.location.hash;
    nav.querySelectorAll('.nav-link').forEach((link) => {
      const rawHref = link.getAttribute('href') || '';
      if (rawHref.startsWith('#')) {
        if ((!currentHash && rawHref === '#inicio') || currentHash === rawHref) {
          link.classList.add('active');
        }
        link.addEventListener('click', () => {
          nav.querySelectorAll('.nav-link').forEach((navLink) => navLink.classList.remove('active'));
          link.classList.add('active');
        });
        return;
      }
      const href = normalizePath(rawHref);
      if (href === current) {
        link.classList.add('active');
      }
    });
  }

  function initMenu() {
    if (!menuToggle || !nav) {
      return;
    }
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('is-open');
    });
    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) {
        return;
      }
      const target = event.target;
      if (nav.contains(target) || menuToggle.contains(target)) {
        return;
      }
      nav.classList.remove('is-open');
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
      });
    });
  }

  function initTopbar() {
    if (!topbar) {
      return;
    }
    const handleScroll = () => {
      topbar.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  function initReveal() {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!nodes.length) {
      return;
    }
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    nodes.forEach((node) => observer.observe(node));
  }

  function initModules() {
    const tabs = document.querySelectorAll('[data-module-tabs]');
    if (!tabs.length) {
      return;
    }
    tabs.forEach((tabGroup) => {
      const buttons = Array.from(tabGroup.querySelectorAll('[data-module-target]'));
      const container = tabGroup.closest('.card') || document;
      const panels = Array.from(container.querySelectorAll('[data-module-panel]'));
      if (!buttons.length || !panels.length) {
        return;
      }
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const target = button.dataset.moduleTarget;
          buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
          panels.forEach((panel) => {
            panel.classList.toggle('hidden', panel.dataset.modulePanel !== target);
          });
        });
      });
    });
  }

  function initSupportForm() {
    const form = document.querySelector('[data-support-form]');
    if (!form) {
      return;
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.reset();
      let status = form.querySelector('.form-status');
      if (!status) {
        status = document.createElement('div');
        status.className = 'form-status';
        form.appendChild(status);
      }
      status.textContent = 'Mensagem enviada. Vamos retornar em breve.';
    });
  }

  function initSubscriptionForm() {
    const form = document.querySelector('[data-subscription-form]');
    if (!form) {
      return;
    }
    const status = form.querySelector('[data-subscription-status]');
    const submit = form.querySelector('button[type="submit"]');
    const originalText = submit ? submit.textContent : '';
    const pixOutput = document.querySelector('[data-pix-output]');
    const pixQr = document.querySelector('[data-pix-qr]');
    const pixCode = document.querySelector('[data-pix-code]');
    const pixCopy = document.querySelector('[data-pix-copy]');
    const pixContinue = document.querySelector('[data-pix-continue]');
    const pixTicket = document.querySelector('[data-pix-ticket]');
    const pixStatus = document.querySelector('[data-pix-status]');
    let pollTimer = null;
    let pollAttempts = 0;

    function setPixVisible(visible) {
      if (!pixOutput) {
        return;
      }
      pixOutput.classList.toggle('hidden', !visible);
    }

    function setContinueEnabled(enabled) {
      if (!pixContinue) {
        return;
      }
      pixContinue.classList.toggle('is-disabled', !enabled);
      pixContinue.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      if (!enabled) {
        pixContinue.addEventListener(
          'click',
          (event) => {
            if (pixContinue.getAttribute('aria-disabled') === 'true') {
              event.preventDefault();
            }
          },
          { once: true }
        );
      }
    }

    function updatePixPayload(payload, sessionId) {
      if (!payload) {
        return;
      }
      if (pixQr && payload.qrCodeBase64) {
        pixQr.src = `data:image/png;base64,${payload.qrCodeBase64}`;
      }
      if (pixCode && payload.qrCode) {
        pixCode.value = payload.qrCode;
      }
      if (pixTicket && payload.ticketUrl) {
        pixTicket.href = payload.ticketUrl;
        pixTicket.classList.remove('hidden');
      }
      if (pixContinue) {
        pixContinue.href = `/console?tab=register`;
      }
    }

    async function pollStatus(sessionId) {
      if (!sessionId) {
        return;
      }
      pollAttempts += 1;
      try {
        const response = await fetch(
          `/api/subscriptions/status?session=${encodeURIComponent(sessionId)}`
        );
        const data = await response.json().catch(() => ({}));
        if (data.pix) {
          updatePixPayload(
            {
              qrCode: data.pix.qr_code,
              qrCodeBase64: data.pix.qr_code_base64,
              ticketUrl: data.pix.ticket_url
            },
            sessionId
          );
        }
        if (data.approved) {
          if (pixStatus) {
            pixStatus.textContent = 'Pagamento aprovado. Redirecionando...';
          }
          setContinueEnabled(true);
          setTimeout(() => {
            window.location.href = `/console?tab=register`;
          }, 900);
          return;
        }
        if (data.status === 'cancelled' && pixStatus) {
          pixStatus.textContent = 'Pagamento cancelado. Gere um novo Pix.';
          setContinueEnabled(false);
          return;
        }
        if (pixStatus) {
          pixStatus.textContent = 'Aguardando confirma\u00E7\u00E3o do pagamento.';
        }
      } catch (err) {
        if (pixStatus) {
          pixStatus.textContent = 'N\u00E3o foi poss\u00EDvel confirmar o pagamento agora.';
        }
      }

      if (pollAttempts < 120) {
        pollTimer = setTimeout(() => pollStatus(sessionId), 5000);
      }
    }

    if (pixCopy) {
      pixCopy.addEventListener('click', async () => {
        if (!pixCode || !pixCode.value) {
          return;
        }
        try {
          await navigator.clipboard.writeText(pixCode.value);
          if (pixStatus) {
            pixStatus.textContent = 'C\u00F3digo Pix copiado.';
          }
        } catch (err) {
          if (pixStatus) {
            pixStatus.textContent = 'N\u00E3o foi poss\u00EDvel copiar o c\u00F3digo Pix.';
          }
        }
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Gerando Pix...';
      }
      if (status) {
        status.textContent = '';
      }
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      pollAttempts = 0;
      setContinueEnabled(false);

      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch('/api/subscriptions/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.qrCode) {
          throw new Error(data.error || 'N\u00E3o foi poss\u00EDvel iniciar o acesso.');
        }

        updatePixPayload(
          {
            qrCode: data.qrCode,
            qrCodeBase64: data.qrCodeBase64,
            ticketUrl: data.ticketUrl
          },
          data.sessionId
        );
        setPixVisible(true);
        if (data.approved) {
          if (pixStatus) {
            pixStatus.textContent = 'Pagamento aprovado. Redirecionando...';
          }
          setContinueEnabled(true);
          setTimeout(() => {
            window.location.href = `/console?tab=register`;
          }, 900);
          return;
        }
        if (pixStatus) {
          pixStatus.textContent = 'Aguardando confirma\u00E7\u00E3o do pagamento.';
        }
        pollStatus(data.sessionId);
      } catch (err) {
        if (status) {
          status.textContent = err.message || 'Falha ao iniciar o acesso.';
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalText || 'Gerar Pix';
        }
      }
    });

    const searchParams = new URLSearchParams(window.location.search);
    const sessionParam = searchParams.get('session');
    if (sessionParam) {
      setPixVisible(true);
      setContinueEnabled(false);
      pollStatus(sessionParam);
    }
  }

  function initPixPaymentLink() {
    const container = document.querySelector('[data-pix-link]');
    if (!container) {
      return;
    }

    const statusEl = container.querySelector('[data-pix-link-status]');
    const amountEl = container.querySelector('[data-pix-link-amount]');
    const descEl = container.querySelector('[data-pix-link-description]');
    const codeEl = container.querySelector('[data-pix-link-code]');
    const copyBtn = container.querySelector('[data-pix-link-copy]');
    const copyUrlBtn = container.querySelector('[data-pix-link-copy-url]');
    const expiresEl = container.querySelector('[data-pix-link-expires]');
    const messageEl = container.querySelector('[data-pix-link-message]');

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const chargeId = pathParts[pathParts.length - 1];
    const shareUrl = window.location.href;

    const statusLabels = {
      pending: 'Pendente',
      paid: 'Pago',
      cancelled: 'Cancelado'
    };

    const formatCurrency = (cents) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format((Number(cents) || 0) / 100);

    const formatDate = (value) =>
      value ? new Date(value).toLocaleString('pt-BR') : '';

    async function copyText(text, successMessage) {
      if (!text) {
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        if (messageEl) {
          messageEl.textContent = successMessage;
        }
      } catch (err) {
        if (messageEl) {
          messageEl.textContent = 'N\u00E3o foi poss\u00EDvel copiar agora.';
        }
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyText(codeEl ? codeEl.value : '', 'C\u00F3digo Pix copiado.');
      });
    }
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        copyText(shareUrl, 'Link copiado.');
      });
    }

    if (!chargeId) {
      if (messageEl) {
        messageEl.textContent = 'Link inv\u00E1lido.';
      }
      return;
    }

    fetch(`/api/public/pix/charges/${encodeURIComponent(chargeId)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.charge) {
          throw new Error((data && data.error) || 'Link n\u00E3o encontrado.');
        }
        const charge = data.charge;
        if (statusEl) {
          statusEl.textContent = statusLabels[charge.status] || charge.status;
        }
        if (amountEl) {
          amountEl.textContent = formatCurrency(charge.amountCents);
        }
        if (descEl) {
          descEl.textContent = charge.description || 'Sem descri\u00E7\u00E3o.';
        }
        if (codeEl) {
          codeEl.value = charge.qrPayload || '';
        }
        if (expiresEl && charge.expiresAt) {
          expiresEl.textContent = `Expira em ${formatDate(charge.expiresAt)}`;
        }
        if (messageEl && charge.status === 'paid') {
          messageEl.textContent = 'Pagamento confirmado.';
        }
      })
      .catch((err) => {
        if (messageEl) {
          messageEl.textContent = err.message || 'N\u00E3o foi poss\u00EDvel carregar o link.';
        }
      });
  }

  function initPublicChargePayment() {
    const form = document.querySelector('[data-charge-form]');
    if (!form) {
      return;
    }
    const amountEl = document.querySelector('[data-charge-amount]');
    const descEl = document.querySelector('[data-charge-description]');
    const statusTag = document.querySelector('[data-charge-status]');
    const statusText = document.querySelector('[data-charge-status-text]');
    const output = document.querySelector('[data-charge-pix-output]');
    const qrImg = document.querySelector('[data-charge-qr]');
    const codeEl = document.querySelector('[data-charge-code]');
    const copyBtn = document.querySelector('[data-charge-copy]');
    const ticketLink = document.querySelector('[data-charge-ticket]');
    const progressEl = document.querySelector('[data-charge-progress]');
    const submit = form.querySelector('button[type="submit"]');
    const originalSubmitText = submit ? submit.textContent : '';

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const chargeId = pathParts[pathParts.length - 1];
    let pollTimer = null;
    let pollAttempts = 0;

    const formatCurrency = (cents) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format((Number(cents) || 0) / 100);

    function setOutputVisible(visible) {
      if (!output) {
        return;
      }
      output.classList.toggle('hidden', !visible);
    }

    function updateChargeView(charge) {
      if (amountEl) {
        amountEl.textContent = formatCurrency(charge.amountCents);
      }
      if (descEl) {
        descEl.textContent = charge.description || 'Pagamento Pix';
      }
      if (statusTag) {
        statusTag.textContent = charge.status || '--';
      }
      if (submit && charge.status === 'paid') {
        submit.disabled = true;
        submit.textContent = 'Pagamento confirmado';
      }
      if (progressEl && charge.status === 'paid') {
        progressEl.textContent = 'Pagamento confirmado.';
      }
      if (charge.brCode || charge.qrCodeBase64) {
        updatePixPayload({
          qrCode: charge.brCode,
          qrCodeBase64: charge.qrCodeBase64,
          ticketUrl: charge.ticketUrl
        });
        setOutputVisible(true);
      }
    }

    function updatePixPayload(payload) {
      if (qrImg && payload.qrCodeBase64) {
        qrImg.src = `data:image/png;base64,${payload.qrCodeBase64}`;
      }
      if (codeEl && payload.qrCode) {
        codeEl.value = payload.qrCode;
      }
      if (ticketLink && payload.ticketUrl) {
        ticketLink.href = payload.ticketUrl;
        ticketLink.classList.remove('hidden');
      }
    }

    async function copyPixCode() {
      if (!codeEl || !codeEl.value) {
        return;
      }
      try {
        await navigator.clipboard.writeText(codeEl.value);
        if (progressEl) {
          progressEl.textContent = 'Codigo Pix copiado.';
        }
      } catch (err) {
        if (progressEl) {
          progressEl.textContent = 'Nao foi possivel copiar o codigo.';
        }
      }
    }

    async function pollStatus() {
      if (!chargeId) {
        return;
      }
      pollAttempts += 1;
      try {
        const response = await fetch(`/api/public/charges/${encodeURIComponent(chargeId)}`);
        const data = await response.json().catch(() => ({}));
        if (data.charge) {
          updateChargeView(data.charge);
          if (data.charge.status === 'paid') {
            if (progressEl) {
              progressEl.textContent = 'Pagamento confirmado.';
            }
            return;
          }
        }
      } catch (err) {
        if (progressEl) {
          progressEl.textContent = 'Nao foi possivel atualizar o status.';
        }
      }
      if (pollAttempts < 120) {
        pollTimer = setTimeout(pollStatus, 5000);
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', copyPixCode);
    }

    if (!chargeId) {
      if (statusText) {
        statusText.textContent = 'Cobranca nao encontrada.';
      }
      return;
    }

    fetch(`/api/public/charges/${encodeURIComponent(chargeId)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.charge) {
          throw new Error(data.error || 'Cobranca nao encontrada.');
        }
        updateChargeView(data.charge);
      })
      .catch((err) => {
        if (statusText) {
          statusText.textContent = err.message || 'Falha ao carregar cobranca.';
        }
      });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Gerando Pix...';
      }
      if (statusText) {
        statusText.textContent = '';
      }
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      pollAttempts = 0;

      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch(
          `/api/public/charges/${encodeURIComponent(chargeId)}/create_payment`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Nao foi possivel gerar o Pix.');
        }
        updatePixPayload({
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          ticketUrl: data.ticketUrl
        });
        setOutputVisible(true);
        if (progressEl) {
          progressEl.textContent = 'Aguardando confirmacao do pagamento.';
        }
        pollStatus();
      } catch (err) {
        if (statusText) {
          statusText.textContent = err.message || 'Falha ao iniciar pagamento.';
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalSubmitText || 'Gerar Pix';
        }
      }
    });
  }

  initTheme();
  initNav();
  initMenu();
  initTopbar();
  initReveal();
  initModules();
  initSupportForm();
  initSubscriptionForm();
  initPixPaymentLink();
  initPublicChargePayment();

})();
