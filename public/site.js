(() => {
  const themeKey = 'ghostpay_theme';
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
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
    localStorage.setItem(themeKey, theme);
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(themeKey);
    if (saved) {
      setTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  function initNav() {
    if (!nav) {
      return;
    }
    const current = normalizePath(window.location.pathname);
    nav.querySelectorAll('.nav-link').forEach((link) => {
      const href = normalizePath(link.getAttribute('href'));
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

  initTheme();
  initNav();
  initMenu();
  initTopbar();
  initReveal();
  initModules();
  initSupportForm();

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = root.dataset.theme || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
})();
