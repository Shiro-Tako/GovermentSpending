const chart = echarts.init(document.getElementById('chart'));
let dataset = null;

const els = {
  total: document.getElementById('totalBudget'),
  ministries: document.getElementById('ministryCount'),
  programs: document.getElementById('programCount'),
  updated: document.getElementById('datasetUpdated'),
  source: document.getElementById('datasetSource'),
  fiscal: document.getElementById('fyLabel'),
  title: document.getElementById('nodeTitle'),
  totalDetail: document.getElementById('nodeTotal'),
  share: document.getElementById('nodeShare'),
  path: document.getElementById('nodePath'),
  desc: document.getElementById('nodeDesc'),
  children: document.getElementById('childrenList'),
  centerTitle: document.getElementById('mindmapTitle'),
  centerSubtitle: document.getElementById('mindmapSubtitle')
};

const THB = (value) => new Intl.NumberFormat('en-US').format(value);
const compactTHB = (value) =>
  '฿' +
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value);
const pct = (value, total) =>
  total && value != null ? ((value / total) * 100).toFixed(2) + '%' : '—';

function formatTitle(name) {
  if (!name) return 'Thailand Budget';
  return name.replace(/\s*\(/, '\n(');
}

function sanitize(node) {
  const copy = { ...node };
  copy.value = node.value == null || node.value === '' ? null : Number(node.value);
  copy.desc = node.desc || '';
  copy.children = Array.isArray(node.children) ? node.children.map(sanitize) : [];
  copy.meta = node.meta;
  return copy;
}

function sumChildren(node) {
  if (!node.children || !node.children.length) return 0;
  return node.children.reduce((total, child) => total + (child.value ?? sumChildren(child)), 0);
}

function totalFor(node) {
  return node.value != null ? node.value : sumChildren(node);
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized.padEnd(6, '0');
  const int = parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function decorateMindmap(root) {
  if (!root) return root;
  const palette = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
  root.symbolSize = 120;
  root.itemStyle = {
    color: '#0f172a',
    borderColor: '#1f2937',
    borderWidth: 10,
    shadowBlur: 45,
    shadowColor: 'rgba(15, 23, 42, 0.45)'
  };
  root.label = {
    show: false,
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 700,
    padding: [14, 24],
    backgroundColor: '#0f172a',
    borderRadius: 999,
    borderWidth: 0,
    align: 'center',
    verticalAlign: 'middle',
    shadowBlur: 0
  };

  if (!Array.isArray(root.children)) return root;

  root.children.forEach((child, index) => {
    const color = palette[index % palette.length];
    decorateBranch(child, 1, color);
  });
  return root;
}

function decorateBranch(node, depth, branchColor) {
  const symbolSize = depth === 1 ? 70 : Math.max(32, 64 - depth * 6);
  const mainColor = withAlpha(branchColor, 1);
  const borderColor = depth === 1 ? mainColor : withAlpha(branchColor, 0.85);
  const lineColor = withAlpha(branchColor, depth === 1 ? 0.85 : 0.55);
  const bubbleFill = depth === 1 ? '#ffffff' : withAlpha(branchColor, 0.12);
  node.symbolSize = symbolSize;
  node.itemStyle = {
    color: bubbleFill,
    borderColor,
    borderWidth: depth === 1 ? 6 : 3,
    shadowBlur: depth === 1 ? 30 : 18,
    shadowColor: withAlpha(branchColor, depth === 1 ? 0.4 : 0.25)
  };
  node.lineStyle = {
    color: lineColor,
    width: depth === 1 ? 5 : 3,
    curveness: 0.55
  };
  node.label = {
    color: '#0f172a',
    fontWeight: depth <= 2 ? 600 : 500,
    fontSize: depth === 1 ? 16 : 14,
    backgroundColor: '#ffffff',
    borderColor: withAlpha(branchColor, 0.45),
    borderWidth: 1.5,
    borderRadius: 22,
    padding: [8, 18],
    shadowBlur: 14,
    shadowColor: withAlpha(branchColor, 0.18),
    position: 'top',
    distance: depth === 1 ? 28 : 18,
    align: 'center',
    verticalAlign: 'middle',
    rotate: 'radial'
  };
  node.emphasis = {
    label: {
      backgroundColor: '#f1f5f9',
      borderColor: withAlpha(branchColor, 0.65),
      borderWidth: 2,
      color: '#0f172a'
    }
  };

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => decorateBranch(child, depth + 1, branchColor));
  }
}

function countLeaves(node) {
  if (!node.children || !node.children.length) return 1;
  return node.children.reduce((total, child) => total + countLeaves(child), 0);
}

function updateSummary(root) {
  const total = totalFor(root);
  const ministries = Array.isArray(root.children) ? root.children.length : 0;
  let programs = 0;
  if (root.children) {
    for (const child of root.children) {
      programs += countLeaves(child);
    }
  }

  if (els.total) {
    els.total.textContent = total != null ? compactTHB(total) : '—';
    if (total != null) {
      els.total.title = '฿' + THB(total);
    } else {
      els.total.removeAttribute('title');
    }
  }
  if (els.ministries) els.ministries.textContent = ministries ? THB(ministries) : '0';
  if (els.programs) els.programs.textContent = programs ? THB(programs) : '0';

  const meta = root.meta || {};
  if (els.updated) els.updated.textContent = meta.lastUpdated || '—';
  if (els.source) els.source.textContent = meta.source || 'Thailand Bureau of the Budget';
  if (els.fiscal) els.fiscal.textContent = meta.fiscalYear || 'FY';
}

function renderChart(root) {
  chart.setOption({
    backgroundColor: 'rgba(0,0,0,0)',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.35)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params) => {
        const node = params.data;
        const path = (params.treePathInfo || []).map((step) => step.name).join(' / ');
        const total = totalFor(node);
        let parentTotal = null;
        if (params.treeAncestors && params.treeAncestors.length > 1) {
          parentTotal = totalFor(params.treeAncestors[1]);
        }
        const lines = [
          `<div style="font-weight:600;margin-bottom:4px;">${path}</div>`,
          `<div>${total != null ? '฿' + THB(total) : 'Not specified'}</div>`
        ];
        if (parentTotal != null) {
          lines.push(`<div style="opacity:0.7;font-size:11px;">Share of parent: ${pct(total, parentTotal)}</div>`);
        }
        return lines.join('');
      }
    },
    series: [
      {
        type: 'tree',
        data: [root],
        layout: 'radial',
        orient: 'LR',
        top: '6%',
        bottom: '6%',
        left: '6%',
        right: '6%',
        symbol: 'circle',
        roam: true,
        expandAndCollapse: false,
        initialTreeDepth: 2,
        animationDuration: 600,
        animationDurationUpdate: 450,
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.45)',
          width: 2,
          curveness: 0.5
        },
        label: {
          formatter: (params) => {
            if (!params.treeAncestors || params.treeAncestors.length <= 1) {
              return '';
            }
            const node = params.data;
            const value = totalFor(node);
            const share = params.treeAncestors.length > 1
              ? pct(value, totalFor(params.treeAncestors[1]))
              : '—';
            return value != null
              ? `${node.name}\n${compactTHB(value)}${share !== '—' ? ` (${share})` : ''}`
              : node.name;
          }
        },
        emphasis: {
          focus: 'ancestor'
        }
      }
    ]
  });
  chart.resize();
}

function renderChildren(node) {
  if (!els.children) return;
  els.children.innerHTML = '';
  if (!node.children || !node.children.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No departments listed.';
    els.children.appendChild(empty);
    return;
  }
  const parentTotal = totalFor(node);
  const sortedChildren = [...node.children].sort((a, b) => totalFor(b) - totalFor(a));
  for (const child of sortedChildren) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = child.name;
    const amount = document.createElement('span');
    amount.className = 'amount';
    const value = totalFor(child);
    const share = pct(value, parentTotal);
    amount.textContent = share === '—'
      ? (value != null ? '฿' + THB(value) : '—')
      : `${value != null ? '฿' + THB(value) : '—'} · ${share}`;
    item.append(name, amount);
    els.children.appendChild(item);
  }
}

function updateCenterBadge(node, parent) {
  if (!node) return;
  const total = totalFor(node);
  const parentTotal = parent ? totalFor(parent) : null;
  if (els.centerTitle) {
    els.centerTitle.textContent = formatTitle(node.name);
  }
  if (els.centerSubtitle) {
    let subtitle = total != null
      ? `Total allocation ${compactTHB(total)}`
      : 'Total allocation not specified';
    const share = pct(total, parentTotal);
    if (parent && share !== '—') {
      subtitle += ` · ${share} of parent`;
    }
    els.centerSubtitle.textContent = subtitle;
  }
}

function showNodeDetails(node, path, parent) {
  if (!node) return;
  const total = totalFor(node);
  const parentTotal = parent ? totalFor(parent) : null;
  if (els.title) els.title.textContent = node.name;
  if (els.totalDetail) els.totalDetail.textContent = total != null ? '฿' + THB(total) : '—';
  if (els.share) els.share.textContent = pct(total, parentTotal);
  if (els.path) els.path.textContent = '/' + path.join('/');
  if (els.desc) {
    els.desc.textContent = node.desc ? node.desc : 'No additional description provided for this node.';
  }
  renderChildren(node);
  updateCenterBadge(node, parent);
}

function applyData(data) {
  dataset = decorateMindmap(sanitize(data));
  updateSummary(dataset);
  renderChart(dataset);
  showNodeDetails(dataset, [dataset.name], null);
}

chart.on('click', (params) => {
  const node = params.data;
  if (!node) return;
  const path = (params.treePathInfo || []).map((step) => step.name);
  const parent = params.treeAncestors && params.treeAncestors.length > 1 ? params.treeAncestors[1] : null;
  showNodeDetails(node, path, parent);
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!dataset) return;
  chart.dispatchAction({ type: 'restore' });
  showNodeDetails(dataset, [dataset.name], null);
});

document.getElementById('dlPngBtn').addEventListener('click', () => {
  const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: '#f8fafc' });
  const a = document.createElement('a');
  a.href = url;
  a.download = 'thailand-budget-network.png';
  a.click();
});

const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      applyData(parsed);
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  };
  reader.readAsText(file, 'utf-8');
});

async function loadDefault() {
  try {
    const response = await fetch('data/th_budget_FY2025.json', { cache: 'no-store' });
    const json = await response.json();
    applyData(json);
  } catch (error) {
    console.warn('Failed to load default dataset, using fallback demo.', error);
    applyData({
      name: 'Thailand National Budget (Demo)',
      value: 3400000000000,
      meta: {
        fiscalYear: 'FY2025',
        lastUpdated: 'Draft dataset',
        source: 'Demo data generated in-app'
      },
      children: [
        { name: 'Ministry of Finance', value: 840000000000, children: [
          { name: 'Customs Department', value: 120000000000 },
          { name: 'Excise Department', value: 150000000000 },
          { name: 'Fiscal Policy Office', value: 90000000000 }
        ]},
        { name: 'Ministry of Education', value: 620000000000, children: [
          { name: 'Office of the Basic Education Commission', value: 280000000000 },
          { name: 'Office of the Vocational Education Commission', value: 120000000000 }
        ]},
        { name: 'Ministry of Public Health', value: 520000000000, children: [
          { name: 'Department of Medical Services', value: 180000000000 },
          { name: 'Department of Health', value: 96000000000 }
        ]},
        { name: 'Ministry of Transport', value: 410000000000, children: [
          { name: 'Department of Highways', value: 160000000000 },
          { name: 'State Railway of Thailand', value: 120000000000 }
        ]},
        { name: 'Central Fund (งบกลาง)', value: 420000000000 }
      ]
    });
  }
}

loadDefault();
