/**
 * HeyBurrito admin dashboard.
 *
 * Plain ES module, no build step: it is served straight from /ui by the Nest
 * static asset middleware. Every value coming from the API is written with
 * textContent, never innerHTML, so a crafted Slack message cannot inject markup.
 */

const TOKEN_KEY = 'jwt_token';
const THEME_KEY = 'hb_theme';
const LOGIN_URL = '/admin/login';
const REFRESH_MS = 60_000;
const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ utils */

const numberFormat = new Intl.NumberFormat('es');
const decimalFormat = new Intl.NumberFormat('es', {
  maximumFractionDigits: 1,
});
// The activity series is keyed by UTC day, so render those labels in UTC or a
// negative offset shows every bar one day early.
const utcDayMonthFormat = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const dateTimeFormat = new Intl.DateTimeFormat('es', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** Creates an element. `text` is always set through textContent. */
function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const { text, className, dataset, on, ...attrs } = options;

  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key in node && typeof node[key] !== 'object') {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const [key, value] of Object.entries(dataset ?? {})) {
    node.dataset[key] = value;
  }
  for (const [event, handler] of Object.entries(on ?? {})) {
    node.addEventListener(event, handler);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function clear(node) {
  node.replaceChildren();
  return node;
}

function formatNumber(value) {
  return numberFormat.format(value ?? 0);
}

function formatDecimal(value) {
  return decimalFormat.format(value ?? 0);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormat.format(date);
}

function formatRelative(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const steps = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ];

  let amount = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size) return relativeFormat.format(amount, unit);
    amount = Math.round(amount / size);
  }
  return relativeFormat.format(amount, 'year');
}

function formatDayMonth(day, month) {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function describeDelay(days) {
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${days} días`;
}

/** Mirrors the server side parser so bad input never reaches the API. */
function parseBirthdayInput(raw) {
  const input = (raw ?? '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  const dayFirst = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?$/.exec(input);

  let day;
  let month;
  let year;

  if (iso) {
    [, year, month, day] = iso.map(Number);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = Number(dayFirst[2]);
    year = dayFirst[3] ? Number(dayFirst[3]) : undefined;
  } else {
    return null;
  }

  if (month < 1 || month > 12) return null;

  const leap = year
    ? (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    : true;
  const lengths = [
    31,
    year && !leap ? 28 : 29,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day < 1 || day > lengths[month - 1]) return null;
  if (year !== undefined && (year < 1900 || year > new Date().getFullYear())) {
    return null;
  }

  return year === undefined ? { day, month } : { day, month, year };
}

function initials(slackId, name) {
  if (name) {
    const words = name.trim().split(/\s+/).slice(0, 2);
    return words
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }
  const letters = String(slackId ?? '?').replace(/[^a-z0-9]/gi, '');
  return (letters.slice(1, 3) || letters.slice(0, 2) || '?').toUpperCase();
}

/* ------------------------------------------------------------------- auth */

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be unavailable; the redirect still applies */
  }
  window.location.href = LOGIN_URL;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  if (!token) {
    logout();
    throw new ApiError('Sesión no iniciada', 401);
  }

  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    logout();
    throw new ApiError('Sesión expirada', 401);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = Array.isArray(detail?.message)
      ? detail.message.join(', ')
      : detail?.message || `Error ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return response.status === 204 ? null : response.json();
}

/* ------------------------------------------------------------------ theme */

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) ?? '';
  } catch {
    return '';
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* preference is best effort */
  }
}

function cycleTheme() {
  const order = ['', 'light', 'dark'];
  const next = order[(order.indexOf(readTheme()) + 1) % order.length];
  applyTheme(next);
  toast(
    next === ''
      ? 'Tema: automático'
      : next === 'light'
        ? 'Tema: claro'
        : 'Tema: oscuro',
  );
}

/* ----------------------------------------------------------------- toasts */

function toast(message, variant = '') {
  const host = document.getElementById('toasts');
  const node = el('div', {
    className: `toast${variant ? ` toast--${variant}` : ''}`,
    text: message,
  });
  host.append(node);
  setTimeout(() => node.remove(), 4000);
}

/* --------------------------------------------------------------- fragments */

function panel({ title, hint, actions = [], body, flush = false }) {
  const head = title
    ? el('div', { className: 'panel__head' }, [
        el('h2', { className: 'panel__title', text: title }),
        hint ? el('span', { className: 'panel__hint', text: hint }) : null,
        actions.length
          ? el('div', { className: 'panel__actions' }, actions)
          : null,
      ])
    : null;

  return el('section', { className: 'panel' }, [
    head,
    flush ? body : el('div', { className: 'panel__body' }, body),
  ]);
}

function emptyState(message, icon = '∅') {
  return el('div', { className: 'empty' }, [
    el('span', { className: 'empty__icon', text: icon, 'aria-hidden': 'true' }),
    el('span', { text: message }),
  ]);
}

function statCard({ label, value, hint }) {
  return el('div', { className: 'stat' }, [
    el('div', { className: 'stat__label', text: label }),
    el('div', { className: 'stat__value', text: value }),
    hint ? el('div', { className: 'stat__hint', text: hint }) : null,
  ]);
}

function userCell(slackId, name) {
  return el('span', { className: 'user' }, [
    el('span', {
      className: 'avatar',
      text: initials(slackId, name),
      'aria-hidden': 'true',
    }),
    el('span', {}, [
      el('span', { text: name || slackId }),
      name ? el('div', { className: 'stat__hint', text: slackId }) : null,
    ]),
  ]);
}

/** Bar under a number. Zero draws nothing: a 1px stub reads as a rendering bug. */
function meter(value, max, active) {
  if (!active || !value) return null;
  return el('span', {
    className: 'meter',
    style: `width:${Math.max(2, Math.round((value / max) * 100))}%`,
  });
}

function table(headers, rows) {
  if (rows.length === 0) return null;

  const head = el(
    'tr',
    {},
    headers.map((header) =>
      el('th', {
        text: header.label,
        className: header.numeric ? 'num' : '',
        scope: 'col',
      }),
    ),
  );

  return el('div', { className: 'table-wrap' }, [
    el('table', {}, [el('thead', {}, head), el('tbody', {}, rows)]),
  ]);
}

function skeletonBlock(height = 120) {
  return el('div', { className: 'skeleton', style: `height:${height}px` });
}

function loadingView() {
  return el('div', { className: 'section' }, [
    el('div', { className: 'stats' }, [
      skeletonBlock(92),
      skeletonBlock(92),
      skeletonBlock(92),
      skeletonBlock(92),
    ]),
    skeletonBlock(240),
  ]);
}

function errorView(message, onRetry) {
  return el('div', { className: 'section' }, [
    el('div', { className: 'banner banner--error' }, [
      el('span', { text: '⚠' }),
      el('span', { text: message }),
    ]),
    el('div', {}, [
      el('button', {
        className: 'button',
        type: 'button',
        text: 'Reintentar',
        on: { click: onRetry },
      }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ chart */

function activityChart(activity) {
  if (!activity?.length)
    return emptyState('Sin actividad en los últimos 30 días');

  const width = 720;
  const height = 150;
  const gap = 3;
  const barWidth = (width - gap * (activity.length - 1)) / activity.length;
  const max = Math.max(...activity.map((point) => point.count), 1);

  const svg = svgEl('svg', {
    class: 'chart',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': `Burritos por día en los últimos ${activity.length} días`,
  });

  activity.forEach((point, index) => {
    const barHeight =
      point.count === 0 ? 2 : Math.max(3, (point.count / max) * height);
    const rect = svgEl('rect', {
      class: point.count === 0 ? 'chart__bar chart__bar--empty' : 'chart__bar',
      x: index * (barWidth + gap),
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
      rx: Math.min(2, barWidth / 2),
    });
    const label = svgEl('title');
    label.textContent = `${utcDayMonthFormat.format(
      new Date(`${point.date}T00:00:00Z`),
    )}: ${point.count}`;
    rect.append(label);
    svg.append(rect);
  });

  const first = new Date(`${activity[0].date}T00:00:00Z`);
  const last = new Date(`${activity[activity.length - 1].date}T00:00:00Z`);

  return el('div', {}, [
    svg,
    el('div', { className: 'chart__axis' }, [
      el('span', { text: utcDayMonthFormat.format(first) }),
      el('span', { text: `pico: ${formatNumber(max)}` }),
      el('span', { text: utcDayMonthFormat.format(last) }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ views */

const state = {
  route: 'overview',
  transactionsSkip: 0,
  rankingSort: 'burritosReceived',
  rankingQuery: '',
};

async function renderOverview() {
  const data = await api('/admin/dashboard');
  const { burritoStats, userStats, birthdayStats, leaderboard, activity } =
    data;
  const birthdayStatus = data.birthdayStatus;

  const celebratingToday = birthdayStats.today.length > 0;
  const celebratingNames = birthdayStats.today
    .map((person) => person.name || person.slackId)
    .join(', ');

  const upcomingRows = birthdayStats.upcoming.map((entry) =>
    el('tr', {}, [
      el('td', {}, userCell(entry.slackId, entry.name)),
      el('td', { text: formatDayMonth(entry.day, entry.month) }),
      el('td', {}, [
        el('span', {
          className: `badge${
            entry.daysUntil === 0
              ? ' badge--today'
              : entry.daysUntil <= 7
                ? ' badge--soon'
                : ''
          }`,
          text: describeDelay(entry.daysUntil),
        }),
      ]),
    ]),
  );

  const leaderRows = leaderboard.slice(0, 5).map((user, index) =>
    el('tr', {}, [
      el('td', {}, [
        el('span', {
          className: `rank${index === 0 ? ' rank--1' : ''}`,
          text: index + 1,
        }),
      ]),
      el('td', {}, userCell(user.slackId, user.name)),
      el('td', { className: 'num', text: formatNumber(user.burritosReceived) }),
    ]),
  );

  return el('div', { className: 'section' }, [
    el('div', {}, [
      el('h1', { className: 'section__title', text: 'Resumen' }),
      el('p', {
        className: 'section__lede',
        text: 'Actividad de burritos y cumpleaños del equipo.',
      }),
    ]),

    celebratingToday
      ? el('div', { className: 'banner banner--party' }, [
          el('span', { text: '🎂' }),
          el('span', {
            text: `Hoy cumple${birthdayStats.today.length > 1 ? 'n' : ''} años: ${celebratingNames}`,
          }),
        ])
      : null,

    // Silence is the worst failure mode here: without this, a missing channel
    // just means nobody ever gets greeted and nothing says why.
    birthdayStatus && !birthdayStatus.scheduled && birthdayStats.total > 0
      ? el('div', { className: 'banner banner--error' }, [
          el('span', { text: '⚠', 'aria-hidden': 'true' }),
          el('span', {}, [
            el('strong', {
              text: 'El saludo de cumpleaños no se está enviando. ',
            }),
            el('a', {
              href: '#birthdays',
              text: 'Ver el detalle en Cumpleaños',
              style: 'color:inherit',
            }),
          ]),
        ])
      : null,

    el('div', { className: 'stats' }, [
      statCard({
        label: 'Burritos totales',
        value: formatNumber(burritoStats.total),
      }),
      statCard({
        label: 'Hoy',
        value: formatNumber(burritoStats.today),
        hint: 'desde las 00:00 UTC',
      }),
      statCard({
        label: 'Este mes',
        value: formatNumber(burritoStats.thisMonth),
      }),
      statCard({
        label: 'Promedio diario',
        value: formatDecimal(burritoStats.dailyAverage),
        hint: 'últimos 30 días',
      }),
      statCard({
        label: 'Usuarios activos',
        value: formatNumber(userStats.active),
        hint: `de ${formatNumber(userStats.total)} registrados`,
      }),
      statCard({
        label: 'Cumpleaños',
        value: formatNumber(birthdayStats.total),
        hint: 'registrados',
      }),
    ]),

    panel({
      title: 'Actividad',
      hint: `${formatNumber(burritoStats.last30Days)} burritos en 30 días`,
      body: activityChart(activity),
    }),

    el('div', { className: 'grid-2' }, [
      panel({
        title: 'Top receptores',
        flush: true,
        body:
          table(
            [
              { label: '#' },
              { label: 'Usuario' },
              { label: 'Recibidos', numeric: true },
            ],
            leaderRows,
          ) ?? emptyState('Todavía no hay burritos', '🌯'),
      }),
      panel({
        title: 'Próximos cumpleaños',
        flush: true,
        body:
          table(
            [{ label: 'Usuario' }, { label: 'Fecha' }, { label: 'Cuándo' }],
            upcomingRows,
          ) ?? emptyState('Sin cumpleaños registrados', '🎂'),
      }),
    ]),
  ]);
}

async function renderRanking() {
  const users = await api('/admin/users');

  const build = () => {
    const query = state.rankingQuery.trim().toLowerCase();
    const sorted = users
      .filter((user) =>
        query ? String(user.slackId).toLowerCase().includes(query) : true,
      )
      .sort((a, b) => b[state.rankingSort] - a[state.rankingSort]);

    const max = Math.max(...sorted.map((user) => user[state.rankingSort]), 1);

    const rows = sorted.map((user, index) =>
      el('tr', {}, [
        el('td', {}, [
          el('span', {
            className: `rank${index === 0 ? ' rank--1' : ''}`,
            text: index + 1,
          }),
        ]),
        el('td', {}, userCell(user.slackId, user.name)),
        el('td', { className: 'num' }, [
          el('span', { text: formatNumber(user.burritosReceived) }),
          meter(
            user.burritosReceived,
            max,
            state.rankingSort === 'burritosReceived',
          ),
        ]),
        el('td', { className: 'num' }, [
          el('span', { text: formatNumber(user.burritosGiven) }),
          meter(user.burritosGiven, max, state.rankingSort === 'burritosGiven'),
        ]),
      ]),
    );

    return (
      table(
        [
          { label: '#' },
          { label: 'Usuario' },
          { label: 'Recibidos', numeric: true },
          { label: 'Dados', numeric: true },
        ],
        rows,
      ) ??
      emptyState(
        query
          ? `Sin resultados para “${state.rankingQuery}”`
          : 'Sin usuarios todavía',
        '🔍',
      )
    );
  };

  const body = el('div', {}, build());

  const rerender = () => clear(body).append(build());

  const search = el('input', {
    className: 'search',
    type: 'search',
    placeholder: 'Buscar por Slack ID…',
    value: state.rankingQuery,
    'aria-label': 'Buscar usuario',
    on: {
      input: (event) => {
        state.rankingQuery = event.target.value;
        rerender();
      },
    },
  });

  const sortToggle = el('button', {
    className: 'button',
    type: 'button',
    text:
      state.rankingSort === 'burritosReceived'
        ? 'Ordenar por dados'
        : 'Ordenar por recibidos',
    on: {
      click: (event) => {
        state.rankingSort =
          state.rankingSort === 'burritosReceived'
            ? 'burritosGiven'
            : 'burritosReceived';
        event.target.textContent =
          state.rankingSort === 'burritosReceived'
            ? 'Ordenar por dados'
            : 'Ordenar por recibidos';
        rerender();
      },
    },
  });

  return el('div', { className: 'section' }, [
    el('div', {}, [
      el('h1', { className: 'section__title', text: 'Ranking' }),
      el('p', {
        className: 'section__lede',
        text: `${formatNumber(users.length)} usuarios registrados.`,
      }),
    ]),
    panel({
      title: 'Usuarios',
      actions: [search, sortToggle],
      flush: true,
      body,
    }),
  ]);
}

async function renderTransactions() {
  const page = await api(
    `/admin/transactions?limit=${PAGE_SIZE}&skip=${state.transactionsSkip}`,
  );

  const rows = page.items.map((item) =>
    el('tr', {}, [
      el('td', {}, [
        el('span', { text: formatDateTime(item.createdAt) }),
        el('div', {
          className: 'stat__hint',
          text: formatRelative(item.createdAt),
        }),
      ]),
      el('td', {}, userCell(item.giverId)),
      el('td', {}, userCell(item.receiverId)),
      el('td', { className: 'wrap-text', text: item.message || '—' }),
    ]),
  );

  const from = page.total === 0 ? 0 : state.transactionsSkip + 1;
  const to = Math.min(state.transactionsSkip + PAGE_SIZE, page.total);

  const pager = el('div', { className: 'pager' }, [
    el('span', {
      text: `${formatNumber(from)}–${formatNumber(to)} de ${formatNumber(page.total)}`,
    }),
    el('span', { className: 'pager__spacer' }),
    el('button', {
      className: 'button',
      type: 'button',
      text: '← Anterior',
      disabled: state.transactionsSkip === 0,
      on: {
        click: () => {
          state.transactionsSkip = Math.max(
            0,
            state.transactionsSkip - PAGE_SIZE,
          );
          refresh();
        },
      },
    }),
    el('button', {
      className: 'button',
      type: 'button',
      text: 'Siguiente →',
      disabled: to >= page.total,
      on: {
        click: () => {
          state.transactionsSkip += PAGE_SIZE;
          refresh();
        },
      },
    }),
  ]);

  return el('div', { className: 'section' }, [
    el('div', {}, [
      el('h1', { className: 'section__title', text: 'Movimientos' }),
      el('p', {
        className: 'section__lede',
        text: 'Cada burrito entregado, del más reciente al más antiguo.',
      }),
    ]),
    panel({
      title: 'Historial',
      flush: true,
      body: el('div', {}, [
        table(
          [
            { label: 'Fecha' },
            { label: 'De' },
            { label: 'Para' },
            { label: 'Mensaje' },
          ],
          rows,
        ) ?? emptyState('Todavía no se ha entregado ningún burrito', '🌯'),
        page.total > 0 ? pager : null,
      ]),
    }),
  ]);
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('es', { month: 'long' }).format(
    new Date(2021, index, 1),
  ),
);

function daysInMonthUi(month, year) {
  if (month === 2) {
    const leap = year
      ? (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
      : true;
    return leap ? 29 : 28;
  }
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Explains, in one line, whether the daily greeting will actually go out. */
function birthdayStatusBanner(status) {
  if (status.scheduled) {
    return el('div', { className: 'banner banner--ok' }, [
      el('span', { text: '✓', 'aria-hidden': 'true' }),
      el('span', {}, [
        el('strong', { text: 'Saludo automático activo. ' }),
        el('span', {
          text: `Se publica en ${status.channel} a las ${cronHour(status.cron)} (${status.timezone}).`,
        }),
        status.nextRun
          ? el('div', {
              className: 'stat__hint',
              text: `Próxima ejecución: ${formatDateTime(status.nextRun)} (${formatRelative(status.nextRun)}).`,
            })
          : null,
      ]),
    ]);
  }

  const problems = {
    'no-channel': {
      title: 'El saludo automático NO se está enviando.',
      detail:
        'Falta el canal. Define BIRTHDAY_CHANNEL (o SLACK_DEFAULT_CHANNEL) en el entorno, invita al bot al canal y reinicia la app.',
    },
    disabled: {
      title: 'El módulo de cumpleaños está desactivado.',
      detail: 'Pon ENABLE_BIRTHDAYS=true en el entorno y reinicia la app.',
    },
    'invalid-cron': {
      title: 'El saludo automático NO se está enviando.',
      detail: `La expresión BIRTHDAY_CRON ("${status.cron}") no es válida.`,
    },
  };

  const problem = problems[status.problem] ?? {
    title: 'El saludo automático NO se está enviando.',
    detail: 'Revisa la configuración del módulo de cumpleaños.',
  };

  return el('div', { className: 'banner banner--error' }, [
    el('span', { text: '⚠', 'aria-hidden': 'true' }),
    el('span', {}, [
      el('strong', { text: `${problem.title} ` }),
      el('span', { text: problem.detail }),
    ]),
  ]);
}

function cronHour(cron) {
  const [minute, hour] = String(cron).split(' ');
  if (!/^\d+$/.test(hour ?? '') || !/^\d+$/.test(minute ?? '')) return cron;
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

async function renderBirthdays() {
  const [birthdays, status, users] = await Promise.all([
    api('/admin/birthdays'),
    api('/admin/birthdays/status'),
    api('/admin/users'),
  ]);

  const celebrants = birthdays.filter((birthday) => birthday.isToday);
  const canPost = Boolean(status.channel) && status.enabled;

  /* ---------------------------------------------------------- greet now */

  async function greetNow(button, label) {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Enviando…';
    try {
      const result = await api('/admin/birthdays/announce', {
        method: 'POST',
        body: { force: true },
      });
      toast(
        result.announced.length
          ? `Saludo publicado para ${result.announced.join(', ')}`
          : 'Hoy no cumple años nadie registrado',
        result.announced.length ? 'success' : '',
      );
      refresh();
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
      button.textContent = original ?? label;
    }
  }

  const todayPanel = celebrants.length
    ? panel({
        title: `🎉 Cumplen hoy (${celebrants.length})`,
        hint: celebrants.every((person) => person.greetedThisYear)
          ? 'Ya recibieron su saludo este año'
          : 'Todavía sin saludar',
        actions: [
          el('button', {
            className: 'button button--primary',
            type: 'button',
            text: '📣 Saludar ahora',
            disabled: !canPost,
            title: canPost
              ? 'Publica el saludo en el canal ahora mismo'
              : 'Configura BIRTHDAY_CHANNEL para poder publicar',
            on: {
              click: (event) => greetNow(event.currentTarget),
            },
          }),
        ],
        flush: true,
        body: table(
          [{ label: 'Usuario' }, { label: 'Fecha' }, { label: 'Saludo' }],
          celebrants.map((person) =>
            el('tr', {}, [
              el('td', {}, userCell(person.slackId, person.name)),
              el('td', { text: formatDayMonth(person.day, person.month) }),
              el('td', {}, [
                el('span', {
                  className: `badge${person.greetedThisYear ? ' badge--soon' : ''}`,
                  text: person.greetedThisYear ? 'enviado' : 'pendiente',
                }),
              ]),
            ]),
          ),
        ),
      })
    : null;

  /* --------------------------------------------------------------- form */

  const userOptions = el(
    'datalist',
    { id: 'knownUsers' },
    users.map((user) =>
      el('option', {
        value: user.slackId,
        label: user.name || user.slackId,
      }),
    ),
  );

  const slackIdInput = el('input', {
    type: 'text',
    placeholder: 'U012ABCDEF',
    list: 'knownUsers',
    required: true,
    'aria-label': 'Usuario de Slack',
  });
  const daySelect = el('select', { 'aria-label': 'Día' });
  const monthSelect = el(
    'select',
    {
      'aria-label': 'Mes',
      on: { change: () => syncDays() },
    },
    MONTH_NAMES.map((name, index) =>
      el('option', { value: String(index + 1), text: name }),
    ),
  );
  const yearInput = el('input', {
    type: 'text',
    inputmode: 'numeric',
    placeholder: 'p. ej. 1990',
    'aria-label': 'Año de nacimiento',
    on: { input: () => syncDays() },
  });
  const channelInput = el('input', {
    type: 'text',
    placeholder: 'C012ABCDEF',
    'aria-label': 'Canal',
  });
  const announceCheckbox = el('input', {
    type: 'checkbox',
    checked: true,
    id: 'announceIfToday',
  });
  const submitButton = el('button', {
    className: 'button button--primary',
    type: 'submit',
    text: 'Guardar',
  });
  const cancelButton = el('button', {
    className: 'button',
    type: 'button',
    text: 'Cancelar',
    hidden: true,
    on: { click: () => resetForm() },
  });
  const formTitle = el('h2', {
    className: 'panel__title',
    text: 'Agregar cumpleaños',
  });

  /** Keeps the day list honest for the selected month (and leap years). */
  function syncDays() {
    const month = Number(monthSelect.value);
    const year = Number(yearInput.value) || undefined;
    const total = daysInMonthUi(month, year);
    const previous = Number(daySelect.value) || 1;

    clear(daySelect).append(
      ...Array.from({ length: total }, (_, index) =>
        el('option', { value: String(index + 1), text: String(index + 1) }),
      ),
    );
    daySelect.value = String(Math.min(previous, total));
  }

  function resetForm() {
    slackIdInput.value = '';
    slackIdInput.readOnly = false;
    yearInput.value = '';
    channelInput.value = '';
    announceCheckbox.checked = true;
    const now = new Date();
    monthSelect.value = String(now.getMonth() + 1);
    syncDays();
    daySelect.value = String(now.getDate());
    formTitle.textContent = 'Agregar cumpleaños';
    submitButton.textContent = 'Guardar';
    cancelButton.hidden = true;
  }

  function loadIntoForm(birthday) {
    slackIdInput.value = birthday.slackId;
    slackIdInput.readOnly = true;
    monthSelect.value = String(birthday.month);
    yearInput.value = birthday.year ? String(birthday.year) : '';
    syncDays();
    daySelect.value = String(birthday.day);
    channelInput.value = birthday.channelId ?? '';
    announceCheckbox.checked = false;
    formTitle.textContent = `Editando a ${birthday.name || birthday.slackId}`;
    submitButton.textContent = 'Guardar cambios';
    cancelButton.hidden = false;
    slackIdInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const form = el(
    'form',
    {
      className: 'form-grid',
      on: {
        submit: async (event) => {
          event.preventDefault();

          const slackId = slackIdInput.value.trim();
          if (!slackId) {
            toast('Falta el usuario de Slack', 'error');
            return;
          }

          const year = yearInput.value.trim();
          if (year && !/^\d{4}$/.test(year)) {
            toast('El año debe tener 4 dígitos', 'error');
            return;
          }

          submitButton.disabled = true;
          try {
            const result = await api('/admin/birthdays', {
              method: 'POST',
              body: {
                slackId,
                day: Number(daySelect.value),
                month: Number(monthSelect.value),
                ...(year ? { year: Number(year) } : {}),
                ...(channelInput.value.trim()
                  ? { channelId: channelInput.value.trim() }
                  : {}),
                announceIfToday: announceCheckbox.checked,
              },
            });

            toast(`Cumpleaños de ${slackId} guardado`, 'success');
            if (result.announceError) {
              toast(`No se pudo saludar: ${result.announceError}`, 'error');
            } else if (result.announced?.length) {
              toast(
                `🎉 Saludo publicado para ${result.announced.join(', ')}`,
                'success',
              );
            } else if (result.celebratesToday && !announceCheckbox.checked) {
              toast('Cumple hoy. Usa «Saludar ahora» cuando quieras enviarlo.');
            }
            refresh();
          } catch (error) {
            toast(error.message, 'error');
          } finally {
            submitButton.disabled = false;
          }
        },
      },
    },
    [
      userOptions,
      el('label', { className: 'field field--wide' }, [
        el('span', { className: 'field__label', text: 'Usuario de Slack *' }),
        slackIdInput,
        el('span', {
          className: 'field__hint',
          text: 'En Slack: abre su perfil › Más › Copiar ID de miembro',
        }),
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field__label', text: 'Día *' }),
        daySelect,
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field__label', text: 'Mes *' }),
        monthSelect,
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field__label', text: 'Año' }),
        yearInput,
        el('span', {
          className: 'field__hint',
          text: 'Opcional, para la edad',
        }),
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field__label', text: 'Canal' }),
        channelInput,
        el('span', {
          className: 'field__hint',
          text: status.channel ? `Por defecto: ${status.channel}` : 'Opcional',
        }),
      ]),
      el('div', { className: 'field field--wide' }, [
        el('label', { className: 'checkbox' }, [
          announceCheckbox,
          el('span', { text: 'Saludar de inmediato si la fecha es hoy' }),
        ]),
        el('div', { className: 'form-actions' }, [submitButton, cancelButton]),
      ]),
    ],
  );

  resetForm();

  /* -------------------------------------------------------------- table */

  const rows = birthdays.map((birthday) =>
    el('tr', {}, [
      el('td', {}, userCell(birthday.slackId, birthday.name)),
      el('td', { text: formatDayMonth(birthday.day, birthday.month) }),
      el('td', {}, [
        el('span', {
          className: `badge${
            birthday.daysUntil === 0
              ? ' badge--today'
              : birthday.daysUntil <= 7
                ? ' badge--soon'
                : ''
          }`,
          text: describeDelay(birthday.daysUntil),
        }),
      ]),
      el('td', { text: birthday.year ? String(birthday.year) : '—' }),
      el('td', {}, [
        birthday.channelId
          ? el('span', { className: 'mono', text: birthday.channelId })
          : el('span', { className: 'stat__hint', text: 'canal por defecto' }),
      ]),
      el('td', {
        text: birthday.lastGreetedAt
          ? formatDateTime(birthday.lastGreetedAt)
          : '—',
      }),
      el('td', { className: 'num row-actions' }, [
        el('button', {
          className: 'button button--ghost',
          type: 'button',
          text: 'Editar',
          on: { click: () => loadIntoForm(birthday) },
        }),
        el('button', {
          className: 'button button--danger',
          type: 'button',
          text: 'Eliminar',
          title: `Eliminar el cumpleaños de ${birthday.slackId}`,
          on: {
            click: async (event) => {
              const who = birthday.name || birthday.slackId;
              if (!window.confirm(`¿Eliminar el cumpleaños de ${who}?`)) return;

              const button = event.currentTarget;
              button.disabled = true;
              try {
                await api(
                  `/admin/birthdays/${encodeURIComponent(birthday.slackId)}`,
                  { method: 'DELETE' },
                );
                toast('Cumpleaños eliminado', 'success');
                refresh();
              } catch (error) {
                button.disabled = false;
                toast(error.message, 'error');
              }
            },
          },
        }),
      ]),
    ]),
  );

  return el('div', { className: 'section' }, [
    el('div', {}, [
      el('h1', { className: 'section__title', text: 'Cumpleaños' }),
      el('p', {
        className: 'section__lede',
        text: 'El bot saluda cada día en el canal configurado, arrobando a quien cumple.',
      }),
    ]),

    birthdayStatusBanner(status),
    todayPanel,

    el('section', { className: 'panel' }, [
      el('div', { className: 'panel__head' }, [
        formTitle,
        el('span', {
          className: 'panel__hint',
          text: 'Un usuario ya registrado se sobrescribe',
        }),
      ]),
      el('div', { className: 'panel__body' }, form),
    ]),

    panel({
      title: 'Registrados',
      hint: `${formatNumber(birthdays.length)} en total`,
      flush: true,
      body:
        table(
          [
            { label: 'Usuario' },
            { label: 'Fecha' },
            { label: 'Próximo' },
            { label: 'Año' },
            { label: 'Canal' },
            { label: 'Último saludo' },
            { label: '', numeric: true },
          ],
          rows,
        ) ??
        emptyState(
          'Sin cumpleaños registrados. Agrega el primero arriba.',
          '🎂',
        ),
    }),
  ]);
}

/* ----------------------------------------------------------------- router */

const ROUTES = [
  { id: 'overview', label: 'Resumen', icon: '▦', render: renderOverview },
  { id: 'ranking', label: 'Ranking', icon: '🏆', render: renderRanking },
  {
    id: 'transactions',
    label: 'Movimientos',
    icon: '🌯',
    render: renderTransactions,
  },
  { id: 'birthdays', label: 'Cumpleaños', icon: '🎂', render: renderBirthdays },
];

function renderNav() {
  const nav = clear(document.getElementById('nav'));
  for (const route of ROUTES) {
    nav.append(
      el(
        'button',
        {
          className: 'nav__item',
          type: 'button',
          'aria-current': route.id === state.route ? 'page' : null,
          on: {
            click: () => {
              window.location.hash = route.id;
            },
          },
        },
        [
          el('span', { text: route.icon, 'aria-hidden': 'true' }),
          el('span', { text: route.label }),
        ],
      ),
    );
  }
}

let inFlight = false;

async function refresh({ silent = false } = {}) {
  if (inFlight) return;
  inFlight = true;

  const view = document.getElementById('view');
  const refreshButton = document.getElementById('refreshButton');
  refreshButton.dataset.busy = 'true';

  const route = ROUTES.find((entry) => entry.id === state.route) ?? ROUTES[0];

  if (!silent) clear(view).append(loadingView());

  try {
    const content = await route.render();
    clear(view).append(content);
    document.getElementById('lastUpdated').textContent =
      `Actualizado ${formatRelative(new Date())}`;
  } catch (error) {
    if (error.status === 401) return; // logout() already redirected
    clear(view).append(
      errorView(error.message || 'No se pudieron cargar los datos', () =>
        refresh(),
      ),
    );
    if (silent) toast(error.message, 'error');
  } finally {
    inFlight = false;
    refreshButton.dataset.busy = 'false';
  }
}

function applyRoute() {
  const requested = window.location.hash.replace('#', '');
  const route = ROUTES.find((entry) => entry.id === requested);
  state.route = route ? route.id : 'overview';
  if (state.route !== 'transactions') state.transactionsSkip = 0;
  renderNav();
  refresh();
}

/* ------------------------------------------------------------------- boot */

function init() {
  if (!getToken()) {
    logout();
    return;
  }

  applyTheme(readTheme());

  document.getElementById('themeButton').addEventListener('click', cycleTheme);
  document.getElementById('logoutButton').addEventListener('click', logout);
  document
    .getElementById('refreshButton')
    .addEventListener('click', () => refresh());

  window.addEventListener('hashchange', applyRoute);

  setInterval(() => {
    if (document.visibilityState === 'visible') refresh({ silent: true });
  }, REFRESH_MS);

  applyRoute();
}

init();
