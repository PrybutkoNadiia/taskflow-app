document.addEventListener('DOMContentLoaded', () => {
  const todoList = document.querySelector('#col-todo .task-list');
  const inProgressList = document.querySelector('#col-in-progress .task-list');
  const doneList = document.querySelector('#col-done .task-list');

  const taskForm = document.getElementById('task-form');
  const taskInput = document.getElementById('task-title-input');
  const prioritySelect = document.getElementById('task-priority-input');
  const deadlineInput = document.getElementById('task-deadline-input');

  const authForm = document.getElementById('auth-form');
  const authModal = document.getElementById('auth-modal');
  const authModeToggle = document.getElementById('auth-mode-toggle');
  const authError = document.getElementById('auth-error');
  const landingCtas = document.querySelectorAll('#landing-cta, .landing-secondary-cta');
  const homeLogo = document.getElementById('home-logo');

  const openTaskModalBtn = document.getElementById('add-task-btn');
  const closeTaskModalBtn = document.getElementById('close-modal-btn');
  const taskModal = document.getElementById('task-modal');
  const sortSelect = document.getElementById('sort-tasks-select');

  const customModal = document.getElementById('custom-modal');
  const customModalTitle = document.getElementById('custom-modal-title');
  const customModalText = document.getElementById('custom-modal-text');
  const customModalInput = document.getElementById('custom-modal-input');
  const customModalCancel = document.getElementById('custom-modal-cancel');
  const customModalSubmit = document.getElementById('custom-modal-submit');

  let globalTasks = [];
  let currentDate = new Date();
  let currentSort = 'default';
  let editingTaskId = null;
  let currentUser = null;
  let authMode = 'register';
  let boards = [];
  let tasksByBoard = {};
  let activeBoardIndex = 0;
  let profileError = document.getElementById('profile-error');

  async function apiRequest(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    if (response.status === 204) return null;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function showNotice(element, message = '') {
    if (element) element.textContent = message;
  }

  const translations = {
    uk: {
      'app-title': 'TaskFlow — Канбан Дошка',
      'auth-welcome': 'Ласкаво просимо!',
      'auth-sub': 'Будь ласка, зареєструйтеся, щоб розпочати роботу.',
      'btn-create-profile': 'Створити профіль',
      'auth-login-title': 'З поверненням!',
      'auth-login-sub': 'Увійдіть, щоб продовжити роботу з дошками.',
      'auth-login-button': 'Увійти',
      'auth-show-login': 'Уже маєте акаунт? Увійти',
      'auth-show-register': 'Ще не маєте акаунта? Зареєструватися',
      'settings-current-password-label': 'Поточний пароль',
      'settings-new-password-label': 'Новий пароль (необов’язково)',
      'account-delete-confirm': 'Видалити акаунт і всі його дошки та завдання без можливості відновлення?',
      'landing-eyebrow': 'ПЛАНУЙ. ДІЙ. ДОСЯГАЙ.',
      'landing-title': 'Керуй завданнями без хаосу та стресу',
      'landing-subtitle': 'TaskFlow допомагає організувати робочі та особисті справи в одному зручному місці.',
      'landing-cta': 'Спробувати безкоштовно',
      'landing-open-app': 'Перейти до дошки',
      'landing-preview-task-one': 'Розробити дизайн-шапки сайту',
      'landing-preview-task-two': 'Закінчити роботу над проєктом',
      'landing-preview-label': 'Приклад списку завдань',
      'landing-features-title': 'Чому саме TaskFlow?',
      'landing-feature-planning-title': 'Розумне планування',
      'landing-feature-planning-text': 'Додавайте пріоритети та визначайте, за що взятися насамперед.',
      'landing-feature-boards-title': 'Зручні дошки',
      'landing-feature-boards-text': 'Організовуйте завдання за етапами та керуйте кількома проєктами.',
      'landing-feature-focus-title': 'Маскот-помічник',
      'landing-feature-focus-text': 'Пухнастий помічник створює затишний настрій і підтримує фокус.',
      'landing-how-title': 'Почати просто',
      'landing-step-one-title': 'Створи акаунт',
      'landing-step-one-text': 'Зареєструйся, щоб твої дошки й завдання були збережені.',
      'landing-step-two-title': 'Додай завдання',
      'landing-step-two-text': 'Розклади справи по дошках і визнач, що важливо зробити спочатку.',
      'landing-step-three-title': 'Рухайся вперед',
      'landing-step-three-text': 'Стеж за прогресом, дедлайнами та зосереджуйся у фокус-режимі.',
      'landing-bottom-title': 'Твої плани. Твій темп. Твій TaskFlow.',
      'landing-bottom-text': 'Зроби перший крок до спокійного та організованого дня.',
      'landing-footer': 'Менше хаосу — більше зробленого.',
      'menu-title': 'Меню',
      'nav-boards': '📋 Дошки',
      'nav-calendar': '📅 Календар',
      'nav-analytics': '📊 Аналітика',
      'nav-settings': '⚙️ Налаштування',
      'focus-mode': 'Фокус-режим',
      'focus-heading': '🎯 Фокус-режим (Pomodoro)',
      'focus-start': 'Старт ▶',
      'focus-pause': 'Пауза ⏸',
      'focus-reset': 'Скидання 🔄',
      'focus-close': 'Закрити',
      'focus-finished': '🎉 Час вийшов! Чудова робота! Зроби перерву! 🐾',
      'focus-quote-1': 'Фокусуйся на задачі! Котик вірить у тебе 🐾',
      'focus-quote-2': 'Один маленький крок кожного дня приводить до великого успіху! ✨',
      'focus-quote-3': 'Не відволікайся, твій котик пильно стежить за прогресом! 🐈‍⬛',
      'focus-quote-4': 'Глибока концентрація — секрет справжніх майстрів! 🚀',
      'focus-quote-5': 'Зроби це зараз, щоб відпочити з чистим сумлінням! ☕',
      'sort-label': '🔀 Сортувати:',
      'sort-default': 'За замовчуванням',
      'sort-title': 'За назвою (A-Z)',
      'sort-deadline': 'За дедлайном',
      'sort-priority': 'За пріоритетом',
      'sort-today': '📅 Дедлайн сьогодні',
      'btn-new-task': '+ Нова задача',
      'col-todo': 'До виконання',
      'col-in-progress': 'У процесі',
      'col-done': 'Виконано',
      'cal-title': 'Календар завдань',
      'cal-prev': '← Попередній',
      'cal-next': 'Наступний →',
      'day-mo': 'Пн', 'day-tu': 'Вт', 'day-we': 'Ср', 'day-th': 'Чт', 'day-fr': 'Пт', 'day-sa': 'Сб', 'day-su': 'Нд',
      'analytics-title': 'Аналітика продуктивності',
      'stat-total-label': 'Усього завдань',
      'stat-done-label': 'Виконано',
      'stat-active-label': 'У процесі',
      'mascot-title': 'Котик-аналітик каже:',
      'mascot-text': 'Час засукати рукави та взятися за роботу! Мяу~ 🐾',
      'settings-title': 'Налаштування профілю',
      'settings-profile-heading': 'Керування профілем',
      'settings-name-label': "Ім'я користувача",
      'settings-email-label': 'Email',
      'settings-password-label': 'Пароль',
      'settings-avatar-label': 'Персоналізація аватара',
      'settings-lang-label': 'Мова інтерфейсу',
      'btn-change-emoji': 'Змінити емодзі',
      'btn-delete': 'Видалити',
      'btn-save': 'Зберегти зміни',
      'btn-logout': 'Вийти з акаунта',
      'settings-theme-heading': 'Тема оформлення',
      'danger-heading': 'Небезпечна зона',
      'danger-text': 'Видалення профілю призведе до втрати всіх дошок, завдань та персональних даних.',
      'btn-delete-profile': 'Видалити профіль',
      'btn-add-board-title': 'Додати дошку',
      'btn-collapse-sidebar-title': 'Згорнути меню',
      'btn-expand-sidebar-title': 'Відкрити меню',
      'btn-expand-sidebar': '▶ Меню',
      'theme-neon': '💜 Фіолетовий неон',
      'theme-cyberpunk': '💙 Блакитний кіберпанк',
      'theme-light': '☀️ Світла тема',
      'placeholder-name': 'Наприклад: Надія',
      'placeholder-email': 'your@email.com',
      'placeholder-password': 'Введіть пароль',
      'placeholder-board': 'Введіть назву...',
      'placeholder-task': 'Введіть назву задачі...',
      'btn-confirm': 'Підтвердити',
      'modal-task-heading': 'Нова задача',
      'modal-task-name': 'Назва задачі',
      'modal-task-priority': 'Пріоритет',
      'modal-task-deadline': 'Дедлайн',
      'prio-low': 'Низький',
      'prio-med': 'Середній',
      'prio-high': 'Високий',
      'btn-cancel': 'Скасувати',
      'btn-create': 'Створити',
      'board-new-title': 'Нова дошка',
      'board-new-text': 'Введіть назву для нової дошки:',
      'board-edit-title': 'Редагувати дошку',
      'board-edit-text': 'Введіть нову назву:',
      'board-del-title': 'Видалення дошки',
      'board-del-text': 'Ви дійсно хочете видалити дошку',
      'board-err-title': 'Помилка',
      'board-err-text': 'Неможливо видалити єдину дошку!'
    },
    en: {
      'app-title': 'TaskFlow — Kanban Board',
      'auth-welcome': 'Welcome!',
      'auth-sub': 'Please register to get started.',
      'btn-create-profile': 'Create Profile',
      'auth-login-title': 'Welcome back!',
      'auth-login-sub': 'Sign in to continue working with your boards.',
      'auth-login-button': 'Sign In',
      'auth-show-login': 'Already have an account? Sign in',
      'auth-show-register': "Don't have an account? Create one",
      'settings-current-password-label': 'Current password',
      'settings-new-password-label': 'New password (optional)',
      'account-delete-confirm': 'Permanently delete your account, boards, and tasks?',
      'landing-eyebrow': 'PLAN. ACT. ACHIEVE.',
      'landing-title': 'Manage tasks without chaos or stress',
      'landing-subtitle': 'TaskFlow brings your work and personal tasks together in one convenient place.',
      'landing-cta': 'Try it for free',
      'landing-open-app': 'Go to your board',
      'landing-preview-task-one': 'Design the website header',
      'landing-preview-task-two': 'Finish work on the project',
      'landing-preview-label': 'Sample task list',
      'landing-features-title': 'Why TaskFlow?',
      'landing-feature-planning-title': 'Plan with clarity',
      'landing-feature-planning-text': 'Set priorities and decide what to tackle first.',
      'landing-feature-boards-title': 'Flexible boards',
      'landing-feature-boards-text': 'Organize tasks by stage and manage multiple projects.',
      'landing-feature-focus-title': 'A friendly focus buddy',
      'landing-feature-focus-text': 'A playful cat companion adds encouragement to your focus sessions.',
      'landing-how-title': 'Get started in three steps',
      'landing-step-one-title': 'Create an account',
      'landing-step-one-text': 'Sign up to keep your boards and tasks saved.',
      'landing-step-two-title': 'Add your tasks',
      'landing-step-two-text': 'Sort your work into boards and choose what to do first.',
      'landing-step-three-title': 'Make progress',
      'landing-step-three-text': 'Track progress and deadlines, then focus with the Pomodoro timer.',
      'landing-bottom-title': 'Your plans. Your pace. Your TaskFlow.',
      'landing-bottom-text': 'Take the first step toward a calmer, more organized day.',
      'landing-footer': 'Less chaos — more done.',
      'menu-title': 'Menu',
      'nav-boards': '📋 Boards',
      'nav-calendar': '📅 Calendar',
      'nav-analytics': '📊 Analytics',
      'nav-settings': '⚙️ Settings',
      'focus-mode': 'Focus Mode',
      'focus-heading': '🎯 Focus Mode (Pomodoro)',
      'focus-start': 'Start ▶',
      'focus-pause': 'Pause ⏸',
      'focus-reset': 'Reset 🔄',
      'focus-close': 'Close',
      'focus-finished': '🎉 Time is up! Great work! Take a break! 🐾',
      'focus-quote-1': 'Focus on the task! Your cat believes in you 🐾',
      'focus-quote-2': 'One small step every day leads to great success! ✨',
      'focus-quote-3': "Don't get distracted, your cat is watching your progress! 🐈‍⬛",
      'focus-quote-4': 'Deep concentration is the secret of true masters! 🚀',
      'focus-quote-5': 'Do it now so you can rest with a clear conscience! ☕',
      'sort-label': '🔀 Sort by:',
      'sort-default': 'Default',
      'sort-title': 'By Name (A-Z)',
      'sort-deadline': 'By Deadline',
      'sort-priority': 'By Priority',
      'sort-today': '📅 Due Today',
      'btn-new-task': '+ New Task',
      'col-todo': 'To Do',
      'col-in-progress': 'In Progress',
      'col-done': 'Done',
      'cal-title': 'Task Calendar',
      'cal-prev': '← Previous',
      'cal-next': 'Next →',
      'day-mo': 'Mon', 'day-tu': 'Tue', 'day-we': 'Wed', 'day-th': 'Thu', 'day-fr': 'Fri', 'day-sa': 'Sat', 'day-su': 'Sun',
      'analytics-title': 'Productivity Analytics',
      'stat-total-label': 'Total Tasks',
      'stat-done-label': 'Completed',
      'stat-active-label': 'In Progress',
      'mascot-title': 'Analyst Cat says:',
      'mascot-text': 'Time to roll up your sleeves and get to work! Meow~ 🐾',
      'settings-title': 'Profile Settings',
      'settings-profile-heading': 'Profile Management',
      'settings-name-label': 'Username',
      'settings-email-label': 'Email',
      'settings-password-label': 'Password',
      'settings-avatar-label': 'Avatar Customization',
      'settings-lang-label': 'Interface Language',
      'btn-change-emoji': 'Change Emoji',
      'btn-delete': 'Delete',
      'btn-save': 'Save Changes',
      'btn-logout': 'Log Out',
      'settings-theme-heading': 'Theme Appearance',
      'danger-heading': 'Danger Zone',
      'danger-text': 'Deleting your profile will result in the loss of all boards, tasks, and personal data.',
      'btn-delete-profile': 'Delete Profile',
      'btn-add-board-title': 'Add board',
      'btn-collapse-sidebar-title': 'Collapse menu',
      'btn-expand-sidebar-title': 'Open menu',
      'btn-expand-sidebar': '▶ Menu',
      'theme-neon': '💜 Purple Neon',
      'theme-cyberpunk': '💙 Blue Cyberpunk',
      'theme-light': '☀️ Light Theme',
      'placeholder-name': 'For example: Nadia',
      'placeholder-email': 'your@email.com',
      'placeholder-password': 'Enter password',
      'placeholder-board': 'Enter a name...',
      'placeholder-task': 'Enter task title...',
      'btn-confirm': 'Confirm',
      'modal-task-heading': 'New Task',
      'modal-task-name': 'Task Title',
      'modal-task-priority': 'Priority',
      'modal-task-deadline': 'Deadline',
      'prio-low': 'Low',
      'prio-med': 'Medium',
      'prio-high': 'High',
      'btn-cancel': 'Cancel',
      'btn-create': 'Create',
      'board-new-title': 'New Board',
      'board-new-text': 'Enter a name for the new board:',
      'board-edit-title': 'Edit Board',
      'board-edit-text': 'Enter a new board name:',
      'board-del-title': 'Delete Board',
      'board-del-text': 'Are you sure you want to delete board',
      'board-err-title': 'Error',
      'board-err-text': 'Cannot delete the only board!'
    }
  };

  function setLanguage(lang, persist = true) {
    const selectedLang = translations[lang] ? lang : 'uk';
    localStorage.setItem('taskflow_lang', selectedLang);
    document.documentElement.lang = selectedLang;
    const dict = translations[selectedLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] && el.id !== 'nav-boards') {
        el.textContent = dict[key];
      }
    });
    if (landingCtas.length) {
      const ctaKey = currentUser ? 'landing-open-app' : 'landing-cta';
      landingCtas.forEach(button => { button.textContent = dict[ctaKey]; });
    }
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key]) el.setAttribute('title', dict[key]);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (dict[key]) el.setAttribute('aria-label', dict[key]);
    });
    if (langSelect) langSelect.value = selectedLang;
    if (customModalSubmit) customModalSubmit.textContent = dict['btn-confirm'];
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    if (openSidebarBtn) openSidebarBtn.textContent = dict['btn-expand-sidebar'];
    const calendarView = document.getElementById('view-calendar');
    const analyticsView = document.getElementById('view-analytics');
    if (calendarView && calendarView.classList.contains('active-view')) renderCalendar();
    if (analyticsView && analyticsView.classList.contains('active-view')) updateAnalyticsStats();
    updateTaskCounter();
    applySortAndRender();
    updateAuthMode();
    if (persist && currentUser && currentUser.language !== selectedLang) {
      saveProfilePatch({ language: selectedLang }).catch(error => showNotice(profileError, error.message));
    }
  }

  const savedLang = localStorage.getItem('taskflow_lang') || 'uk';
  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = savedLang;
    langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
  }

  function applyTheme(themeName, persist = true) {
    if (!['neon', 'cyberpunk', 'light'].includes(themeName)) themeName = 'neon';
    document.body.classList.remove('theme-neon', 'theme-cyberpunk', 'theme-light');
    document.body.classList.add(`theme-${themeName}`);
    localStorage.setItem('taskflow_theme', themeName);
    if (persist && currentUser && currentUser.theme !== themeName) {
      saveProfilePatch({ theme: themeName }).catch(error => showNotice(profileError, error.message));
    }

    let lightStyle = document.getElementById('dynamic-light-theme');
    if (themeName === 'light') {
      if (!lightStyle) {
        lightStyle = document.createElement('style');
        lightStyle.id = 'dynamic-light-theme';
        lightStyle.innerHTML = `
          body.theme-light { background: #f4f5f9 !important; color: #1e1e2d !important; }
          body.theme-light .sidebar { background: #ffffff !important; color: #1e1e2d !important; border-right: 1px solid #e2e8f0 !important; }
          body.theme-light .main-content { background: #f4f5f9 !important; color: #1e1e2d !important; }
          body.theme-light .kanban-column { background: #ffffff !important; color: #1e1e2d !important; border: 1px solid #8c52ff !important; box-shadow: 0 4px 12px rgba(140, 82, 255, 0.08) !important; }
          body.theme-light .task-card { background: #f8f9fc !important; color: #1e1e2d !important; border: 1px solid #8c52ff !important; box-shadow: 0 2px 6px rgba(0,0,0,0.05) !important; }
          body.theme-light .task-title, body.theme-light .column-title, body.theme-light .page-title, body.theme-light h1, body.theme-light h2, body.theme-light h3, body.theme-light label, body.theme-light span, body.theme-light p { color: #1e1e2d !important; }
          body.theme-light input, body.theme-light select { background: #ffffff !important; color: #1e1e2d !important; border: 1px solid #8c52ff !important; }
          body.theme-light .settings-container, body.theme-light .analytics-card, body.theme-light .auth-card, body.theme-light .modal-content, body.theme-light .calendar-grid-container { background: #ffffff !important; color: #1e1e2d !important; border: 1px solid #8c52ff !important; box-shadow: 0 4px 15px rgba(140, 82, 255, 0.12) !important; }
          body.theme-light .analytics-mascot-card { background: #ffffff !important; border: 1px solid #8c52ff !important; }
          body.theme-light .sidebar-profile-box { background: #f0edff !important; border: 1px solid #8c52ff !important; }
          body.theme-light .sidebar-mascot-widget { background: #ffffff !important; border: 1px solid #8c52ff !important; }
          body.theme-light .board-item { color: #4a5568 !important; }
          body.theme-light .board-item.active { background: #f0edff !important; color: #8c52ff !important; font-weight: bold; }
          body.theme-light .calendar-days-grid > div { background: #f8f9fc !important; border: 1px solid #e2e8f0 !important; color: #1e1e2d !important; }
        `;
        document.head.appendChild(lightStyle);
      }
    } else if (lightStyle) {
      lightStyle.remove();
    }
  }

  const savedTheme = localStorage.getItem('taskflow_theme') || 'neon';
  applyTheme(savedTheme);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
    });
  });

  // --- МОДАЛЬНЕ ВІКНО ДОШОК ---
  let modalCallback = null;

  function showCustomModal(titleKey, textKey, hasInput = true, defaultValue = '', extraText = '', callback = null) {
    if (!customModal) return;
    const lang = localStorage.getItem('taskflow_lang') || 'uk';
    const dict = translations[lang] || translations.uk;

    customModalTitle.textContent = dict[titleKey] || titleKey;
    customModalText.textContent = (dict[textKey] || textKey) + (extraText ? ` "${extraText}"?` : '');

    if (hasInput) {
      customModalInput.style.display = 'block';
      customModalInput.value = defaultValue;
    } else {
      customModalInput.style.display = 'none';
    }

    modalCallback = callback;
    customModal.style.display = 'flex';
    customModal.classList.add('active');
    if (hasInput && customModalInput) {
      setTimeout(() => customModalInput.focus(), 50);
    }
  }

  if (customModalCancel) {
    customModalCancel.onclick = (e) => {
      e.stopPropagation();
      if (customModal) {
        customModal.classList.remove('active');
        customModal.style.display = 'none';
      }
    };
  }

  if (customModalSubmit) {
    customModalSubmit.onclick = (e) => {
      e.stopPropagation();
      const val = customModalInput.value.trim();
      if (modalCallback) {
        const result = modalCallback(val);
        if (result && typeof result.catch === 'function') {
          result.catch(error => showNotice(profileError || authError, error.message));
        }
      }
      if (customModal) {
        customModal.classList.remove('active');
        customModal.style.display = 'none';
      }
    };
  }

  // --- САЙДБАР ---
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const openSidebarBtn = document.getElementById('open-sidebar-btn');
  const sidebar = document.getElementById('app-sidebar');
  const mainContent = document.getElementById('app-main-content');
  const mobileViewport = window.matchMedia('(max-width: 900px)');

  if (toggleSidebarBtn && openSidebarBtn && sidebar && mainContent) {
    const setSidebarOpen = (isOpen) => {
      sidebar.classList.toggle('collapsed', !isOpen);
      mainContent.classList.toggle('expanded', !isOpen);
      openSidebarBtn.style.display = isOpen ? 'none' : 'block';
      openSidebarBtn.setAttribute('aria-expanded', String(isOpen));
    };

    const syncSidebarToViewport = () => {
      setSidebarOpen(!mobileViewport.matches);
    };

    toggleSidebarBtn.addEventListener('click', () => {
      setSidebarOpen(false);
    });

    openSidebarBtn.addEventListener('click', () => {
      setSidebarOpen(true);
    });

    mobileViewport.addEventListener('change', syncSidebarToViewport);
    syncSidebarToViewport();

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(navItem => {
      navItem.addEventListener('click', () => {
        if (mobileViewport.matches) setSidebarOpen(false);
      });
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && mobileViewport.matches && !sidebar.classList.contains('collapsed')) {
        setSidebarOpen(false);
      }
    });
  }

  // --- ПРОФІЛЬ ---
  function updateProfileUI() {
    const sidebarName = document.getElementById('user-display-name');
    const sidebarEmail = document.getElementById('user-display-email');
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const settingsAvatarPreview = document.getElementById('settings-avatar-preview');

    if (sidebarName) sidebarName.textContent = currentUser?.displayName || 'Користувач';
    if (sidebarEmail) sidebarEmail.textContent = currentUser?.email || '';
    const avatar = currentUser?.avatar || '👤';
    if (avatar.startsWith('data:image/')) {
      const image = document.createElement('img');
      image.src = avatar;
      image.alt = 'Avatar';
      if (sidebarAvatar) sidebarAvatar.replaceChildren(image.cloneNode());
      if (settingsAvatarPreview) settingsAvatarPreview.replaceChildren(image);
    } else {
      if (sidebarAvatar) sidebarAvatar.textContent = avatar;
      if (settingsAvatarPreview) settingsAvatarPreview.textContent = avatar;
    }

    if (landingCtas.length) {
      const lang = localStorage.getItem('taskflow_lang') || 'uk';
      const dict = translations[lang] || translations.uk;
      landingCtas.forEach(button => {
        button.textContent = dict[currentUser ? 'landing-open-app' : 'landing-cta'];
      });
    }
  }

  function updateAuthMode() {
    const dict = translations[localStorage.getItem('taskflow_lang') || 'uk'] || translations.uk;
    const nameInput = document.getElementById('auth-name');
    const passwordInput = document.getElementById('auth-password');
    const nameGroup = nameInput && nameInput.closest('.form-group');
    const title = document.getElementById('auth-title');
    const subtitle = document.querySelector('.auth-subtitle');
    const submit = authForm && authForm.querySelector('button[type="submit"]');
    if (nameGroup) nameGroup.style.display = authMode === 'register' ? '' : 'none';
    if (nameInput) nameInput.required = authMode === 'register';
    if (passwordInput) {
      passwordInput.autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
      passwordInput.minLength = authMode === 'register' ? 10 : 0;
      passwordInput.maxLength = 72;
    }
    if (title) title.textContent = dict[authMode === 'register' ? 'auth-welcome' : 'auth-login-title'];
    if (subtitle) subtitle.textContent = dict[authMode === 'register' ? 'auth-sub' : 'auth-login-sub'];
    if (submit) submit.textContent = dict[authMode === 'register' ? 'btn-create-profile' : 'auth-login-button'];
    if (authModeToggle) {
      authModeToggle.textContent = dict[authMode === 'register' ? 'auth-show-login' : 'auth-show-register'];
    }
  }

  function showLandingPage() {
    document.body.classList.add('landing-mode', 'landing-body');
    if (authModal) authModal.style.display = 'none';
  }

  function showDashboard() {
    document.body.classList.remove('landing-mode', 'landing-body');
    if (authModal) authModal.style.display = 'none';
    switchView('boards');
    if (navBoards) navBoards.classList.add('active');
  }

  function saveProfilePatch(changes) {
    if (!currentUser) return Promise.resolve(null);
    return apiRequest('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(changes)
    }).then(({ user }) => {
      currentUser = user;
      updateProfileUI();
      return user;
    });
  }

  function readLegacyData() {
    try {
      const savedBoards = JSON.parse(localStorage.getItem('taskflow_boards') || 'null');
      const tasksByBoard = JSON.parse(localStorage.getItem('taskflow_tasks_by_board') || '{}');
      if (!Array.isArray(savedBoards) || savedBoards.length === 0) return null;
      const boardsToImport = savedBoards.map((board, index) => (
        typeof board === 'string'
          ? { id: String(index), name: board }
          : { id: String(board.id || index), name: board.name }
      ));
      if (boardsToImport.some(board => !board.name)) return null;
      const avatar = localStorage.getItem('user_avatar') || '👤';
      const allowedAvatars = ['👤', '🐱', '🦊', '🚀', '👑', '⚡', '💻', '🌸', '🍕'];
      return {
        boards: boardsToImport,
        tasksByBoard: tasksByBoard && typeof tasksByBoard === 'object' && !Array.isArray(tasksByBoard)
          ? tasksByBoard
          : {},
        language: localStorage.getItem('taskflow_lang') || 'uk',
        theme: localStorage.getItem('taskflow_theme') || 'neon',
        avatar: allowedAvatars.includes(avatar)
          || (avatar.length <= 1_500_000 && /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(avatar))
          ? avatar
          : '👤'
      };
    } catch (error) {
      console.warn('Could not read locally saved data for account migration:', error);
      return null;
    }
  }

  function clearLegacyData() {
    [
      'username',
      'useremail',
      'userpass',
      'user_avatar',
      'taskflow_boards',
      'taskflow_tasks_by_board',
      'taskflow_active_board_id',
      'taskflow_legacy_tasks_imported'
    ].forEach(key => localStorage.removeItem(key));
  }

  if (landingCtas.length) {
    landingCtas.forEach(button => button.addEventListener('click', () => {
      if (currentUser) {
        showDashboard();
      } else if (authModal) {
        authModal.style.display = 'flex';
      }
    }));
  }

  if (homeLogo) {
    homeLogo.addEventListener('click', (e) => {
      e.preventDefault();
      showLandingPage();
    });
  }

  updateAuthMode();
  if (authModeToggle) {
    authModeToggle.addEventListener('click', () => {
      authMode = authMode === 'register' ? 'login' : 'register';
      showNotice(authError);
      updateAuthMode();
    });
  }

  const savedName = localStorage.getItem('username');
  const savedEmail = localStorage.getItem('useremail');
  const authName = document.getElementById('auth-name');
  const authEmail = document.getElementById('auth-email');
  if (authName && savedName) authName.value = savedName;
  if (authEmail && savedEmail) authEmail.value = savedEmail;

  if (authForm && authModal) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showNotice(authError);
      const nameInput = document.getElementById('auth-name');
      const emailInput = document.getElementById('auth-email');
      const passInput = document.getElementById('auth-password');
      const legacyData = authMode === 'register' ? readLegacyData() : null;
      try {
        const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
        const result = await apiRequest(path, {
          method: 'POST',
          body: JSON.stringify({
            displayName: nameInput?.value.trim(),
            email: emailInput?.value.trim(),
            password: passInput?.value,
            language: localStorage.getItem('taskflow_lang') || 'uk'
          })
        });
        currentUser = result.user;
        if (authMode === 'register' && legacyData) {
          try {
            await apiRequest('/api/account/import', {
              method: 'POST',
              body: JSON.stringify({
                boards: legacyData.boards,
                tasksByBoard: legacyData.tasksByBoard
              })
            });
            currentUser = await saveProfilePatch({
              language: legacyData.language,
              theme: legacyData.theme,
              avatar: legacyData.avatar
            });
            clearLegacyData();
          } catch (error) {
            showNotice(authError, `Account created, but existing browser data could not be imported: ${error.message}`);
          }
        } else {
          clearLegacyData();
        }
        await initializeAccount();
        if (passInput) passInput.value = '';
        showDashboard();
      } catch (error) {
        showNotice(authError, error.message);
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        showNotice(profileError, error.message);
        return;
      }
      localStorage.removeItem(`taskflow_active_board_id:${currentUser.id}`);
      currentUser = null;
      clearLegacyData();
      boards = [];
      tasksByBoard = {};
      globalTasks = [];
      updateProfileUI();
      showLandingPage();
    });
  }

  const profileSettingsForm = document.getElementById('profile-settings-form');
  if (profileSettingsForm) {
    profileSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('settings-name');
      const currentPassword = document.getElementById('settings-current-password');
      const newPassword = document.getElementById('settings-new-password');
      showNotice(profileError);
      try {
        await saveProfilePatch({ displayName: nameInput.value.trim() });
        if (newPassword.value || currentPassword.value) {
          if (!currentPassword.value || !newPassword.value) {
            throw new Error('Enter both your current and new password to change it');
          }
          await apiRequest('/api/profile/password', {
            method: 'POST',
            body: JSON.stringify({
              currentPassword: currentPassword.value,
              newPassword: newPassword.value
            })
          });
        }
        currentPassword.value = '';
        newPassword.value = '';
      } catch (error) {
        showNotice(profileError, error.message);
      }
    });
  }

  const changeAvatarEmojiBtn = document.getElementById('change-avatar-emoji-btn');
  const deleteAvatarBtn = document.getElementById('delete-avatar-btn');
  const avatarFileInput = document.getElementById('avatar-file-input');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const deleteProfileBtn = document.getElementById('delete-profile-btn');

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const currentPassword = document.getElementById('settings-current-password');
      const newPassword = document.getElementById('settings-new-password');
      const reveal = currentPassword.type === 'password';
      currentPassword.type = reveal ? 'text' : 'password';
      newPassword.type = reveal ? 'text' : 'password';
    });
  }

  if (deleteProfileBtn) {
    deleteProfileBtn.addEventListener('click', async () => {
      const dict = translations[localStorage.getItem('taskflow_lang') || 'uk'] || translations.uk;
      if (!window.confirm(dict['account-delete-confirm'])) return;
      const password = window.prompt(dict['settings-current-password-label']);
      if (password === null) return;
      try {
        await apiRequest('/api/account', {
          method: 'DELETE',
          body: JSON.stringify({ password })
        });
        localStorage.removeItem(`taskflow_active_board_id:${currentUser.id}`);
        currentUser = null;
        clearLegacyData();
        boards = [];
        tasksByBoard = {};
        globalTasks = [];
        updateProfileUI();
        showLandingPage();
      } catch (error) {
        showNotice(profileError, error.message);
      }
    });
  }

  if (changeAvatarEmojiBtn) {
    changeAvatarEmojiBtn.addEventListener('click', async () => {
      const avatars = ['👤', '🐱', '🦊', '🚀', '👑', '⚡', '💻', '🌸', '🍕'];
      const current = currentUser?.avatar || '👤';
      const nextIndex = (avatars.indexOf(current) + 1) % avatars.length;
      try {
        await saveProfilePatch({ avatar: avatars[nextIndex] });
      } catch (error) {
        showNotice(profileError, error.message);
      }
    });
  }

  if (deleteAvatarBtn) {
    deleteAvatarBtn.addEventListener('click', async () => {
      try {
        await saveProfilePatch({ avatar: '👤' });
      } catch (error) {
        showNotice(profileError, error.message);
      }
    });
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 1_000_000) {
          showNotice(profileError, 'Choose a PNG, JPEG, GIF, or WebP image smaller than 1 MB.');
          avatarFileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = async function(event) {
          try {
            await saveProfilePatch({ avatar: event.target.result });
          } catch (error) {
            showNotice(profileError, error.message);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // --- ВКЛАДКИ ---
  const navBoards = document.getElementById('nav-boards');
  const navCalendar = document.getElementById('nav-calendar');
  const navAnalytics = document.getElementById('nav-analytics');
  const navSettings = document.getElementById('nav-settings');

  const views = {
    boards: document.getElementById('view-boards'),
    calendar: document.getElementById('view-calendar'),
    analytics: document.getElementById('view-analytics'),
    settings: document.getElementById('view-settings')
  };

  function switchView(activeKey) {
    Object.keys(views).forEach(key => {
      if (views[key]) views[key].classList.remove('active-view');
    });
    [navBoards, navCalendar, navAnalytics, navSettings].forEach(item => {
      if (item) item.classList.remove('active');
    });

    if (views[activeKey]) views[activeKey].classList.add('active-view');

    if (activeKey === 'calendar') renderCalendar();
    if (activeKey === 'analytics') updateAnalyticsStats();
    if (activeKey === 'settings') loadSettingsData();
  }

  if (navBoards) navBoards.addEventListener('click', (e) => { e.preventDefault(); switchView('boards'); navBoards.classList.add('active'); });
  if (navCalendar) navCalendar.addEventListener('click', (e) => { e.preventDefault(); switchView('calendar'); navCalendar.classList.add('active'); });
  if (navAnalytics) navAnalytics.addEventListener('click', (e) => { e.preventDefault(); switchView('analytics'); navAnalytics.classList.add('active'); });
  if (navSettings) navSettings.addEventListener('click', (e) => { e.preventDefault(); switchView('settings'); navSettings.classList.add('active'); });

  const boardsList = document.getElementById('boards-list');
  const addBoardBtn = document.getElementById('add-board-btn');

  function getActiveBoardStorageKey() {
    return `taskflow_active_board_id:${currentUser.id}`;
  }

  function renderBoards() {
    if (!boardsList) return;
    boardsList.innerHTML = '';

    boards.forEach((board, index) => {
      const li = document.createElement('li');
      li.className = `board-item ${index === activeBoardIndex ? 'active' : ''}`;
      li.dataset.index = index;

      li.innerHTML = `
        <span class="board-title-text" style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📌 ${escapeHtml(board.name)}</span>
        <div style="display:flex; gap:4px; position:relative; z-index:999;">
          <button type="button" class="board-action-btn edit-board-btn" data-index="${index}">✏️</button>
          <button type="button" class="board-action-btn delete-board-btn" data-index="${index}">🗑️</button>
        </div>
      `;

      boardsList.appendChild(li);
    });
  }

  async function loadBoards(selectedBoardId = null) {
    const result = await apiRequest('/api/boards');
    boards = result.boards;
    if (boards.length === 0) throw new Error('Your account has no boards');
    tasksByBoard = {};
    const loadedTasks = await Promise.all(boards.map(async board => {
      const { tasks } = await apiRequest(`/api/boards/${encodeURIComponent(board.id)}/tasks`);
      return [board.id, tasks];
    }));
    tasksByBoard = Object.fromEntries(loadedTasks);

    const savedBoardId = localStorage.getItem(getActiveBoardStorageKey());
    const requestedBoardId = selectedBoardId || savedBoardId;
    const selectedIndex = boards.findIndex(board => board.id === requestedBoardId);
    activeBoardIndex = selectedIndex < 0 ? 0 : selectedIndex;
    localStorage.setItem(getActiveBoardStorageKey(), boards[activeBoardIndex].id);
    globalTasks = tasksByBoard[boards[activeBoardIndex].id];
    document.getElementById('current-board-title').textContent = boards[activeBoardIndex].name;
    renderBoards();
    applySortAndRender();
  }

  async function initializeAccount() {
    if (!currentUser) return;
    setLanguage(currentUser.language, false);
    applyTheme(currentUser.theme, false);
    updateProfileUI();
    await loadBoards();
    loadSettingsData();
  }

  // Делегування кліків для списку дошок
  if (boardsList) {
    boardsList.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-board-btn');
      const deleteBtn = e.target.closest('.delete-board-btn');
      const boardItem = e.target.closest('.board-item');

      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        const index = Number.parseInt(editBtn.dataset.index, 10);
        const board = boards[index];
        if (!board) return;
        showCustomModal('board-edit-title', 'board-edit-text', true, board.name, '', async (newName) => {
          if (newName) {
            await apiRequest(`/api/boards/${encodeURIComponent(board.id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ name: newName })
            });
            await loadBoards(board.id);
          }
        });
        return;
      }

      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const index = Number.parseInt(deleteBtn.dataset.index, 10);
        const board = boards[index];
        if (!board) return;
        if (boards.length <= 1) {
          showCustomModal('board-err-title', 'board-err-text', false);
          return;
        }
        showCustomModal('board-del-title', 'board-del-text', false, '', board.name, async () => {
          const nextActiveBoardId = activeBoardIndex === index
            ? boards[index === 0 ? 1 : 0].id
            : boards[activeBoardIndex].id;
          await apiRequest(`/api/boards/${encodeURIComponent(board.id)}`, { method: 'DELETE' });
          await loadBoards(nextActiveBoardId);
        });
        return;
      }

      if (boardItem) {
        activeBoardIndex = Number.parseInt(boardItem.dataset.index, 10);
        if (!boards[activeBoardIndex]) return;
        localStorage.setItem(getActiveBoardStorageKey(), boards[activeBoardIndex].id);
        globalTasks = tasksByBoard[boards[activeBoardIndex].id] || [];
        document.getElementById('current-board-title').textContent = boards[activeBoardIndex].name;
        renderBoards();
        applySortAndRender();
        switchView('boards');
      }
    });
  }

  if (addBoardBtn) {
    addBoardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCustomModal('board-new-title', 'board-new-text', true, '', '', async (newName) => {
        if (newName) {
          const { board } = await apiRequest('/api/boards', {
            method: 'POST',
            body: JSON.stringify({ name: newName })
          });
          await loadBoards(board.id);
        }
      });
    });
  }

  // --- ФОКУС-РЕЖИМ (ПОВНЕ ВИПРАВЛЕННЯ КНОПКИ ТА ТАЙМЕРА) ---
  const openFocusBtn = document.getElementById('open-focus-btn');
  const focusModal = document.getElementById('focus-modal');
  const focusTimerEl = document.getElementById('focus-timer');
  const focusStartBtn = document.getElementById('focus-start-btn');
  const focusPauseBtn = document.getElementById('focus-pause-btn');
  const focusResetBtn = document.getElementById('focus-reset-btn');
  const focusCloseBtn = document.getElementById('focus-close-btn');
  const focusQuoteEl = document.getElementById('focus-quote');

  let focusTimeLeft = 25 * 60;
  let focusTimerId = null;

  function getFocusQuotes() {
    const dict = translations[localStorage.getItem('taskflow_lang') || 'uk'] || translations.uk;
    return [1, 2, 3, 4, 5].map(index => dict[`focus-quote-${index}`]);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(focusTimeLeft / 60);
    const secs = focusTimeLeft % 60;
    if (focusTimerEl) {
      focusTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  if (openFocusBtn && focusModal) {
    openFocusBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const focusQuotes = getFocusQuotes();
      const randomQuote = focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
      if (focusQuoteEl) focusQuoteEl.textContent = randomQuote;
      focusModal.style.display = 'flex';
      focusModal.classList.add('active');
    };
  }

  if (focusCloseBtn && focusModal) {
    focusCloseBtn.onclick = (e) => {
      e.preventDefault();
      focusModal.classList.remove('active');
      focusModal.style.display = 'none';
    };
  }

  if (focusStartBtn && focusPauseBtn) {
    focusStartBtn.onclick = () => {
      focusStartBtn.style.display = 'none';
      focusPauseBtn.style.display = 'inline-block';

      focusTimerId = setInterval(() => {
        if (focusTimeLeft > 0) {
          focusTimeLeft--;
          updateTimerDisplay();
        } else {
          clearInterval(focusTimerId);
          const dict = translations[localStorage.getItem('taskflow_lang') || 'uk'] || translations.uk;
          alert(dict['focus-finished']);
          focusStartBtn.style.display = 'inline-block';
          focusPauseBtn.style.display = 'none';
        }
      }, 1000);
    };

    focusPauseBtn.onclick = () => {
      clearInterval(focusTimerId);
      focusStartBtn.style.display = 'inline-block';
      focusPauseBtn.style.display = 'none';
    };
  }

  if (focusResetBtn) {
    focusResetBtn.onclick = () => {
      clearInterval(focusTimerId);
      focusTimeLeft = 25 * 60;
      updateTimerDisplay();
      if (focusStartBtn && focusPauseBtn) {
        focusStartBtn.style.display = 'inline-block';
        focusPauseBtn.style.display = 'none';
      }
    };
  }

  // --- ЗАВДАННЯ ---
  if (openTaskModalBtn && taskModal) {
    openTaskModalBtn.addEventListener('click', () => {
      editingTaskId = null;
      const dict = translations[localStorage.getItem('taskflow_lang') || 'uk'] || translations.uk;
      document.getElementById('modal-task-title').textContent = dict['modal-task-heading'];
      if (taskForm) taskForm.reset();
      taskModal.style.display = 'flex';
      taskModal.classList.add('active');
    });
  }

  if (closeTaskModalBtn && taskModal) {
    closeTaskModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      taskModal.style.display = 'none';
      taskModal.classList.remove('active');
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applySortAndRender();
    });
  }

  function applySortAndRender() {
    let tasksToRender = [...globalTasks];
    const todayStr = new Date().toISOString().split('T')[0];

    if (currentSort === 'today') {
      tasksToRender = tasksToRender.filter(t => t.dueDate === todayStr);
    } else if (currentSort === 'title') {
      tasksToRender.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'deadline') {
      tasksToRender.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    } else if (currentSort === 'priority') {
      const pWeights = { High: 1, Medium: 2, Low: 3 };
      tasksToRender.sort((a, b) => (pWeights[a.priority] || 2) - (pWeights[b.priority] || 2));
    }

    renderTasks(tasksToRender);
    updateTaskCounter();
  }

  function renderTasks(tasks) {
    if (!todoList || !inProgressList || !doneList) return;

    todoList.innerHTML = '';
    inProgressList.innerHTML = '';
    doneList.innerHTML = '';

    const lang = localStorage.getItem('taskflow_lang') || 'uk';
    const dict = translations[lang] || translations.uk;

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.draggable = true;
      card.dataset.id = task.id;

      const deadlineText = task.dueDate ? `<span>📅 ${task.dueDate}</span>` : '';

      let statusLabel = dict['col-todo'];
      if (task.status === 'in-progress') statusLabel = dict['col-in-progress'];
      else if (task.status === 'done') statusLabel = dict['col-done'] + ' ✅';

      let prioLabel = dict['prio-med'];
      if (task.priority === 'Low') prioLabel = dict['prio-low'];
      if (task.priority === 'High') prioLabel = dict['prio-high'];

      card.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:12px;">
          <span>${dict['modal-task-priority']}: <strong>${prioLabel}</strong></span>
          <span style="opacity: 0.8;">${statusLabel}</span>
          ${deadlineText}
        </div>
      `;

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(task.id));
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      if (task.status === 'todo') todoList.appendChild(card);
      else if (task.status === 'in-progress') inProgressList.appendChild(card);
      else if (task.status === 'done') doneList.appendChild(card);
    });
  }

  const kanbanColumns = document.querySelectorAll('.kanban-column');
  kanbanColumns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      let newStatus = 'todo';
      if (column.id === 'col-in-progress') newStatus = 'in-progress';
      else if (column.id === 'col-done') newStatus = 'done';

      const taskIndex = globalTasks.findIndex(t => String(t.id) === String(taskId));
      if (taskIndex !== -1) {
        const board = boards[activeBoardIndex];
        try {
          await apiRequest(`/api/boards/${encodeURIComponent(board.id)}/tasks/${encodeURIComponent(taskId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
          });
          globalTasks[taskIndex].status = newStatus;
          tasksByBoard[board.id] = globalTasks;
          applySortAndRender();
        } catch (error) {
          showNotice(profileError, error.message);
        }
      }
    });
  });

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = taskInput ? taskInput.value.trim() : '';
      const priority = prioritySelect ? prioritySelect.value : 'Medium';
      const dueDate = deadlineInput && deadlineInput.value ? deadlineInput.value : null;

      if (!title) return;

      const board = boards[activeBoardIndex];
      if (!board) return;
      try {
        const { task } = await apiRequest(`/api/boards/${encodeURIComponent(board.id)}/tasks`, {
          method: 'POST',
          body: JSON.stringify({
            title,
            status: 'todo',
            priority,
            dueDate
          })
        });
        globalTasks.push(task);
        tasksByBoard[board.id] = globalTasks;
      } catch (error) {
        showNotice(profileError, error.message);
        return;
      }

      if (taskForm) taskForm.reset();
      if (taskModal) {
        taskModal.style.display = 'none';
        taskModal.classList.remove('active');
      }

      applySortAndRender();
    });
  }

  // --- КАЛЕНДАР ---
  function renderCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    const title = document.getElementById('cal-month-year-title');
    if (!grid) return;

    grid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const lang = localStorage.getItem('taskflow_lang') || 'uk';
    const monthNamesUk = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const monthNames = lang === 'en' ? monthNamesEn : monthNamesUk;
    if (title) title.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingPoint = firstDay === 0 ? 6 : firstDay - 1;

    grid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 15px;';

    for (let i = 0; i < startingPoint; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.cssText = 'padding: 15px; opacity: 0.2;';
      grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayCell = document.createElement('div');
      dayCell.style.cssText = 'padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; min-height: 70px; border: 1px solid rgba(255,255,255,0.1);';

      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = globalTasks.filter(t => t.dueDate === dateString);

      let tasksHtml = dayTasks.map(t => `<div style="font-size:10px; background:#8c52ff; padding:2px 4px; border-radius:4px; margin-top:4px; overflow:hidden; color:#fff;">${escapeHtml(t.title)}</div>`).join('');

      dayCell.innerHTML = `<strong>${day}</strong>${tasksHtml}`;
      grid.appendChild(dayCell);
    }
  }

  const prevMonthBtn = document.getElementById('cal-prev-month');
  const nextMonthBtn = document.getElementById('cal-next-month');

  if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
  if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

  // --- АНАЛІТИКА ---
  function updateTaskCounter() {
    const counter = document.getElementById('task-counter');
    if (counter) {
      const activeTasks = globalTasks.filter(t => t.status !== 'done').length;
      const lang = localStorage.getItem('taskflow_lang') || 'uk';

      if (lang === 'en') {
        counter.textContent = `${activeTasks} task${activeTasks === 1 ? '' : 's'} remaining!`;
      } else {
        const absN = Math.abs(activeTasks) % 100;
        const lastDigit = absN % 10;
        let word = 'задач';
        if (absN <= 10 || absN >= 20) {
          if (lastDigit === 1) word = 'задача';
          else if (lastDigit >= 2 && lastDigit <= 4) word = 'задачі';
        }
        counter.textContent = `Залишилось ${activeTasks} ${word}!`;
      }
    }
  }

  function updateAnalyticsStats() {
    const totalEl = document.getElementById('stat-total');
    const doneEl = document.getElementById('stat-done');
    const activeEl = document.getElementById('stat-active');

    const allTasks = boards.flatMap(board => (
      Array.isArray(tasksByBoard[board.id]) ? tasksByBoard[board.id] : []
    ));
    if (totalEl) totalEl.textContent = allTasks.length;
    if (doneEl) doneEl.textContent = allTasks.filter(t => t.status === 'done').length;
    if (activeEl) activeEl.textContent = allTasks.filter(t => t.status === 'in-progress').length;
  }

  function loadSettingsData() {
    const nameInput = document.getElementById('settings-name');
    const emailInput = document.getElementById('settings-email');
    const currentPassword = document.getElementById('settings-current-password');
    const newPassword = document.getElementById('settings-new-password');

    if (nameInput) nameInput.value = currentUser?.displayName || '';
    if (emailInput) emailInput.value = currentUser?.email || '';
    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (langSelect) langSelect.value = currentUser?.language || savedLang;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  async function initializeApp() {
    setLanguage(savedLang, false);
    applyTheme(localStorage.getItem('taskflow_theme') || 'neon', false);
    updateAuthMode();
    try {
      const { user } = await apiRequest('/api/auth/me');
      if (!user) {
        updateProfileUI();
        showLandingPage();
        return;
      }
      currentUser = user;
      await initializeAccount();
      showDashboard();
    } catch (error) {
      if (error.status !== 401) showNotice(authError, error.message);
      currentUser = null;
      updateProfileUI();
      showLandingPage();
    }
  }

  initializeApp();
});