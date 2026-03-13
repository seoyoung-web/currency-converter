const API = 'https://api.frankfurter.app';

// DOM refs
const fromCurrencyEl = document.getElementById('from-currency');
const toCurrencyEl = document.getElementById('to-currency');
const fromAmountEl = document.getElementById('from-amount');
const toAmountEl = document.getElementById('to-amount');
const swapBtn = document.getElementById('swap-btn');
const rateTextEl = document.getElementById('rate-text');
const addFavBtn = document.getElementById('add-favorite-btn');
const lastUpdatedEl = document.getElementById('last-updated');
const favoritesList = document.getElementById('favorites-list');
const chartLoading = document.getElementById('chart-loading');
const chartTitleEl = document.getElementById('chart-title');

let currentRate = null;
let rateChart = null;
let currentPeriod = 7;

// Popular currencies shown first
const POPULAR = ['USD', 'KRW', 'EUR', 'JPY', 'GBP', 'CNY', 'CAD', 'AUD', 'CHF', 'HKD'];

// ── Currencies ──────────────────────────────────────────────────────────────

// ── Conversion ───────────────────────────────────────────────────────────────
async function convert() {
  const from = fromCurrencyEl.value;
  const to = toCurrencyEl.value;
  const amount = parseFloat(fromAmountEl.value) || 0;

  if (from === to) {
    currentRate = 1;
    toAmountEl.textContent = amount.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
    rateTextEl.textContent = `1 ${from} = 1 ${to}`;
    return;
  }

  try {
    const res = await fetch(`${API}/latest?from=${from}&to=${to}`);
    const data = await res.json();
    currentRate = data.rates[to];
    const converted = amount * currentRate;

    toAmountEl.textContent = converted.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
    rateTextEl.textContent = `1 ${from} = ${currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${to}`;
    lastUpdatedEl.textContent = `마지막 업데이트: ${data.date}`;
  } catch {
    toAmountEl.textContent = '오류';
    rateTextEl.textContent = 'API 연결 실패';
  }
}

// ── Chart ────────────────────────────────────────────────────────────────────
async function loadChart() {
  const from = fromCurrencyEl.value;
  const to = toCurrencyEl.value;

  chartLoading.classList.remove('hidden');
  chartTitleEl.textContent = `${from} → ${to} 환율 추이`;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - currentPeriod);

  const fmt = d => d.toISOString().split('T')[0];

  try {
    const url = from === to
      ? null
      : `${API}/${fmt(startDate)}..${fmt(endDate)}?from=${from}&to=${to}`;

    if (!url) {
      chartLoading.textContent = '같은 통화는 차트를 표시할 수 없습니다.';
      return;
    }

    const res = await fetch(url);
    const data = await res.json();

    const labels = Object.keys(data.rates).sort();
    const values = labels.map(d => data.rates[d][to]);

    renderChart(labels, values, from, to);
  } catch {
    chartLoading.textContent = '차트 데이터를 불러올 수 없습니다.';
  } finally {
    chartLoading.classList.add('hidden');
  }
}

function renderChart(labels, values, from, to) {
  const ctx = document.getElementById('rate-chart').getContext('2d');

  if (rateChart) rateChart.destroy();

  rateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${from}/${to}`,
        data: values,
        borderColor: '#4299e1',
        backgroundColor: 'rgba(66, 153, 225, 0.1)',
        borderWidth: 2,
        pointRadius: labels.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${to}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 8,
            font: { size: 11 },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            font: { size: 11 },
            callback: v => v.toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
          },
        },
      },
    },
  });
}

// ── Favorites ────────────────────────────────────────────────────────────────
function loadFavorites() {
  return JSON.parse(localStorage.getItem('fav_pairs') || '[]');
}

function saveFavorites(favs) {
  localStorage.setItem('fav_pairs', JSON.stringify(favs));
}

function renderFavorites() {
  const favs = loadFavorites();
  favoritesList.innerHTML = '';

  if (favs.length === 0) {
    favoritesList.innerHTML = '<li class="empty-msg">즐겨찾기가 없습니다.</li>';
    return;
  }

  favs.forEach(({ from, to }) => {
    const li = document.createElement('li');
    li.className = 'fav-item';

    const label = document.createElement('span');
    label.className = 'fav-label';
    label.textContent = `${from} → ${to}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'fav-delete';
    delBtn.textContent = '✕';
    delBtn.title = '삭제';

    li.appendChild(label);
    li.appendChild(delBtn);

    // Click to apply
    label.addEventListener('click', () => {
      fromCurrencyEl.value = from;
      toCurrencyEl.value = to;
      convert();
      loadChart();
    });

    // Delete
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      const updated = loadFavorites().filter(f => !(f.from === from && f.to === to));
      saveFavorites(updated);
      renderFavorites();
    });

    favoritesList.appendChild(li);
  });
}

function addFavorite() {
  const from = fromCurrencyEl.value;
  const to = toCurrencyEl.value;
  const favs = loadFavorites();

  if (favs.some(f => f.from === from && f.to === to)) {
    alert(`${from} → ${to} 는 이미 즐겨찾기에 있습니다.`);
    return;
  }

  favs.push({ from, to });
  saveFavorites(favs);
  renderFavorites();
}

// ── Event Listeners ──────────────────────────────────────────────────────────
fromCurrencyEl.addEventListener('change', () => { convert(); loadChart(); });
toCurrencyEl.addEventListener('change', () => { convert(); loadChart(); });
fromAmountEl.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  const tmp = fromCurrencyEl.value;
  fromCurrencyEl.value = toCurrencyEl.value;
  toCurrencyEl.value = tmp;
  convert();
  loadChart();
});

addFavBtn.addEventListener('click', addFavorite);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPeriod = parseInt(tab.dataset.period, 10);
    loadChart();
  });
});

// ── Compare ──────────────────────────────────────────────────────────────────
const compareCurrencyEl = document.getElementById('compare-currency');
const compareAmountEl = document.getElementById('compare-amount');
const compareSearchEl = document.getElementById('compare-search');
const compareGrid = document.getElementById('compare-grid');

let allRates = {};
let allCurrencyNames = {};

async function loadCompare() {
  const from = compareCurrencyEl.value;
  if (!from) return;

  compareGrid.innerHTML = '<div class="chart-overlay" style="position:static;background:none;padding:2rem;">불러오는 중...</div>';

  try {
    const res = await fetch(`${API}/latest?from=${from}`);
    const data = await res.json();
    allRates = data.rates;
    allRates[from] = 1;
    renderCompareGrid();
  } catch {
    compareGrid.innerHTML = '<div class="chart-overlay" style="position:static;background:none;padding:2rem;">데이터를 불러올 수 없습니다.</div>';
  }
}

function renderCompareGrid() {
  const amount = parseFloat(compareAmountEl.value) || 1;
  const search = compareSearchEl.value.trim().toLowerCase();
  const from = compareCurrencyEl.value;

  const entries = Object.entries(allRates)
    .filter(([code]) => {
      if (!search) return true;
      const name = (allCurrencyNames[code] || '').toLowerCase();
      return code.toLowerCase().includes(search) || name.includes(search);
    })
    .sort(([a], [b]) => {
      const ai = POPULAR.indexOf(a);
      const bi = POPULAR.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

  compareGrid.innerHTML = '';

  entries.forEach(([code, rate]) => {
    const value = (amount * rate).toLocaleString('ko-KR', { maximumFractionDigits: 4 });
    const name = allCurrencyNames[code] || '';
    const isPopular = POPULAR.includes(code);
    const isSelf = code === from;

    const div = document.createElement('div');
    div.className = `compare-item${isPopular ? ' popular' : ''}`;
    div.innerHTML = `
      <div class="compare-code">${code}${isSelf ? ' ★' : ''}</div>
      <div class="compare-name">${name}</div>
      <div class="compare-value">${value}</div>
    `;
    div.addEventListener('click', () => {
      fromCurrencyEl.value = from;
      toCurrencyEl.value = code;
      fromAmountEl.value = compareAmountEl.value;
      convert();
      loadChart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    compareGrid.appendChild(div);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch(`${API}/currencies`);
  const data = await res.json();
  allCurrencyNames = data;

  const all = Object.entries(data);
  const popular = POPULAR.filter(c => data[c]).map(c => [c, data[c]]);
  const rest = all.filter(([c]) => !POPULAR.includes(c)).sort((a, b) => a[0].localeCompare(b[0]));
  const sorted = [...popular, ...rest];

  [fromCurrencyEl, toCurrencyEl, compareCurrencyEl].forEach(sel => {
    sorted.forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} — ${name}`;
      sel.appendChild(opt);
    });
  });

  fromCurrencyEl.value = 'USD';
  toCurrencyEl.value = 'KRW';
  compareCurrencyEl.value = 'USD';

  convert();
  loadChart();
  loadCompare();
  renderFavorites();
}

compareCurrencyEl.addEventListener('change', loadCompare);
compareAmountEl.addEventListener('input', renderCompareGrid);
compareSearchEl.addEventListener('input', renderCompareGrid);

init();
