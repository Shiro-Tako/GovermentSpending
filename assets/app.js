const chart = echarts.init(document.getElementById('chart'));
let dataset = null;
let currentCenter = null;
let nodeCounter = 0;
const nodeIndex = new Map();

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
  centerSubtitle: document.getElementById('mindmapSubtitle'),
  back: document.getElementById('backBtn')
};

const palette = ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#a855f7', '#fb7185', '#22d3ee'];

const THB = (value) => new Intl.NumberFormat('en-US').format(value);
const compactTHB = (value) =>
  '฿' +
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value);
const pct = (value, total) =>
  total && value != null ? ((value / total) * 100).toFixed(2) + '%' : '—';


function parseBudgetValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[฿,\s]/g, '').toUpperCase();
    const match = normalized.match(/^([0-9]*\.?[0-9]+)([KMBT]?)$/);
    if (match) {
      const amount = parseFloat(match[1]);
      const unit = match[2];
      const multipliers = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
      return amount * (multipliers[unit] || 1);
    }
    const numeric = Number(normalized);
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
}

function sanitize(node, parent = null) {
  const copy = {
    id: ++nodeCounter,
    name: node.name || 'Untitled node',
    value: parseBudgetValue(node.value),
    rawValue: node.value,
    desc: node.desc || ''
  };
  if (node.meta) {
    copy.meta = node.meta;
  }
  nodeIndex.set(copy.id, copy);
  copy.children = Array.isArray(node.children)
    ? node.children.map((child) => sanitize(child, copy))
    : [];
  Object.defineProperty(copy, '__parent', { value: parent, enumerable: false });

  return copy;
}

function sumChildren(node) {
  if (!node.children || !node.children.length) return 0;
  return node.children.reduce((total, child) => total + (child.value ?? sumChildren(child)), 0);
}

function totalFor(node) {
  return node.value != null ? node.value : sumChildren(node);
}

function countLeaves(node) {
  if (!node.children || !node.children.length) return 1;
  return node.children.reduce((total, child) => total + countLeaves(child), 0);
}

function buildPath(node) {
  const steps = [];
  let current = node;
  while (current) {
    steps.unshift(current.name);
    current = current.__parent || null;
  }
  return steps;
}

function formatTitle(name) {
  if (!name) return 'Thailand Budget';
  return name.replace(/\s*\(/, '\n(');
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

function updateSummary(root) {
  if (!root) return;
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

function updateBackButton() {
  if (!els.back) return;
  if (!dataset || currentCenter === dataset) {
    els.back.classList.add('hidden');
  } else {
    els.back.classList.remove('hidden');
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
    if (total != null) {
      let subtitle = compactTHB(total);
      const share = pct(total, parentTotal);
      if (parent && share !== '—') {
        subtitle += ` · ${share} of ${parent.name}`;
      }
      els.centerSubtitle.textContent = subtitle;
    } else {
      els.centerSubtitle.textContent = 'Total allocation not specified';
    }
  }
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
    amount.textContent = value != null
      ? `฿${THB(value)}${share !== '—' ? ` · ${share}` : ''}`
      : '—';
    item.append(name, amount);
    els.children.appendChild(item);
  }
}

function showNodeDetails(node, path, parent) {
  if (!node) return;
  const total = totalFor(node);
  const parentTotal = parent ? totalFor(parent) : null;
  if (els.title) els.title.textContent = node.name;
  if (els.totalDetail) {
    els.totalDetail.textContent = total != null ? '฿' + THB(total) : '—';
  }
  if (els.share) {
    els.share.textContent = pct(total, parentTotal);
  }
  if (els.path) {
    els.path.textContent = '/' + path.join('/');
  }
  if (els.desc) {
    els.desc.textContent = node.desc
      ? node.desc
      : 'No additional description provided for this node.';
  }
  renderChildren(node);
}

function cloneNodeForTree(node, depth, maxDepth) {
  const clone = {
    name: node.name,
    nodeId: node.id,
    total: totalFor(node)
  };
  if (depth < maxDepth && node.children && node.children.length) {
    clone.children = node.children.map((child) => cloneNodeForTree(child, depth + 1, maxDepth));
  } else {
    clone.children = [];
  }
  return clone;
}

function createBreadcrumbNode(target) {
  return {
    name: `◀ ${target.name}`,
    nodeId: target.id,
    total: totalFor(target),
    breadcrumb: true,
    children: []
  };
}

function decorateBreadcrumb(node) {
  node.value = node.total;
  node.symbolSize = 46;
  node.itemStyle = {
    color: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(148, 163, 184, 0.65)',
    borderWidth: 2,
    shadowBlur: 20,
    shadowColor: 'rgba(15, 23, 42, 0.5)'
  };
  node.lineStyle = {
    color: 'rgba(148, 163, 184, 0.55)',
    width: 2,
    curveness: 0.6
  };
  node.label = {
    show: true,
    fontSize: 12,
    fontWeight: 600,
    color: '#e2e8f0',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderColor: 'rgba(148, 163, 184, 0.5)',
    borderWidth: 1,
    borderRadius: 16,
    padding: [6, 16],
    position: 'top',
    distance: 18,
    align: 'center',
    verticalAlign: 'middle',
    formatter: () => 'Back to ' + (nodeIndex.get(node.nodeId)?.name || 'overview')
  };
  node.emphasis = {
    label: {
      color: '#f8fafc',
      backgroundColor: 'rgba(30, 41, 59, 0.92)'
    }
  };
}

function decorateBranch(node, depth, branchColor) {
  node.value = node.total;
  const symbolSize = depth === 1 ? 74 : Math.max(40, 74 - depth * 10);
  const fill = depth === 1 ? withAlpha(branchColor, 0.12) : withAlpha(branchColor, 0.08);
  const border = depth === 1 ? withAlpha(branchColor, 0.85) : withAlpha(branchColor, 0.6);
  const line = withAlpha(branchColor, depth === 1 ? 0.65 : 0.45);
  node.symbolSize = symbolSize;
  node.itemStyle = {
    color: fill,
    borderColor: border,
    borderWidth: depth === 1 ? 5 : 3,
    shadowBlur: depth === 1 ? 32 : 20,
    shadowColor: withAlpha(branchColor, depth === 1 ? 0.5 : 0.3)
  };
  node.lineStyle = {
    color: line,
    width: depth === 1 ? 4 : 2,
    curveness: 0.55
  };
  node.label = {
    show: true,
    color: '#0f172a',
    fontWeight: depth <= 2 ? 600 : 500,
    fontSize: depth === 1 ? 15 : 13,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    borderColor: withAlpha(branchColor, 0.45),
    borderWidth: 1.4,
    borderRadius: 18,
    padding: [6, 16],
    shadowBlur: 18,
    shadowColor: withAlpha(branchColor, 0.25),
    position: 'top',
    distance: depth === 1 ? 26 : 18,
    align: 'center',
    verticalAlign: 'middle',
    rotate: 'radial',
    formatter: ({ data }) => {
      const reference = nodeIndex.get(data.nodeId);
      const labelName = reference ? reference.name : data.name;
      const value = data.total;
      if (value == null) return labelName;
      const parent = reference?.__parent || null;
      const share = parent ? pct(value, totalFor(parent)) : '—';
      return share !== '—'
        ? `${labelName}\n${compactTHB(value)} · ${share}`
        : `${labelName}\n${compactTHB(value)}`;
    }
  };
  node.emphasis = {
    label: {
      backgroundColor: '#f8fafc',
      borderColor: withAlpha(branchColor, 0.65),
      borderWidth: 2,
      color: '#0f172a'
    }
  };
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => decorateBranch(child, depth + 1, branchColor));
  }
}

function decorateMindmap(root) {
  if (!root) return root;
  root.value = root.total;
  root.symbolSize = 150;
  root.itemStyle = {
    color: 'rgba(15, 23, 42, 0.98)',
    borderColor: 'rgba(94, 234, 212, 0.35)',
    borderWidth: 8,
    shadowBlur: 55,
    shadowColor: 'rgba(14, 165, 233, 0.45)'
  };
  root.label = {
    show: true,
    position: 'inside',
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 700,
    align: 'center',
    verticalAlign: 'middle',
    formatter: (params) => (params.data.total != null ? compactTHB(params.data.total) : '—')
  };
  root.emphasis = {
    label: {
      show: true,
      fontSize: 22
    }
  };
  if (!Array.isArray(root.children)) return root;
  let branchIndex = 0;
  root.children.forEach((child) => {
    if (child.breadcrumb) {
      decorateBreadcrumb(child);
    } else {
      const color = palette[branchIndex % palette.length];
      branchIndex += 1;
      decorateBranch(child, 1, color);
    }
  });
  return root;
}

function buildMindmapTree(center) {
  if (!center) return null;
  const isNational = center === dataset;
  const maxDepth = isNational ? 1 : 2;
  const tree = cloneNodeForTree(center, 0, maxDepth);
  if (center.__parent) {
    tree.children.unshift(createBreadcrumbNode(center.__parent));
  }
  return decorateMindmap(tree);
}

function renderMindmap() {
  if (!currentCenter) return;
  const tree = buildMindmapTree(currentCenter);
  if (!tree) return;
  chart.setOption({
    backgroundColor: 'rgba(0,0,0,0)',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      borderColor: 'rgba(94, 234, 212, 0.35)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params) => {
        const data = params.data;
        const node = nodeIndex.get(data.nodeId);
        if (!node) return params.name;
        const total = totalFor(node);
        if (data.breadcrumb) {
          return [
            `<div style="font-weight:600;margin-bottom:4px;">Back to ${node.name}</div>`,
            `<div>${total != null ? '฿' + THB(total) : 'Budget not specified'}</div>`
          ].join('');
        }
        const parent = node.__parent || null;
        const lines = [
          `<div style="font-weight:600;margin-bottom:4px;">${node.name}</div>`,
          `<div>Budget: ${total != null ? '฿' + THB(total) : 'Not specified'}</div>`
        ];
        if (parent) {
          const share = pct(total, totalFor(parent));
          if (share !== '—') {
            lines.push(`<div style="opacity:0.7;font-size:11px;">Share of parent: ${share}</div>`);
          }
        }
        return lines.join('');
      }
    },
    series: [
      {
        type: 'tree',
        data: [tree],
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
        animationDuration: 620,
        animationDurationUpdate: 520,
        animationEasing: 'cubicOut',
        animationEasingUpdate: 'cubicOut',
        lineStyle: {
          color: 'rgba(94, 234, 212, 0.14)',
          width: 1.8,
          curveness: 0.52
        },
        label: { show: false },
        emphasis: { focus: 'ancestor' }
      }
    ]
  }, true);
  chart.resize();
}


function focusNode(node) {
  if (!node) return;
  currentCenter = node;
  updateBackButton();
  updateCenterBadge(node, node.__parent || null);
  renderMindmap();
  const path = buildPath(node);
  showNodeDetails(node, path, node.__parent || null);

}

chart.on('click', (params) => {
  const data = params.data;
  if (!data) return;
  const node = nodeIndex.get(data.nodeId);
  if (!node) return;
  if (data.breadcrumb) {
    focusNode(node);
    return;
  }
  if (node.children && node.children.length) {
    focusNode(node);
  } else {
    const path = buildPath(node);
    showNodeDetails(node, path, node.__parent || null);
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!dataset) return;
  focusNode(dataset);
});

document.getElementById('dlPngBtn').addEventListener('click', () => {
  const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: '#0f172a' });
  const a = document.createElement('a');
  a.href = url;
  a.download = 'thailand-budget-mindmap.png';
  a.click();
});

if (els.back) {
  els.back.addEventListener('click', () => {
    if (dataset) {
      focusNode(dataset);
    }
  });
}

const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      nodeCounter = 0;
      nodeIndex.clear();
      const parsed = JSON.parse(e.target.result);
      dataset = sanitize(parsed, null);
      currentCenter = dataset;
      updateSummary(dataset);
      focusNode(dataset);
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
    nodeCounter = 0;
    nodeIndex.clear();
    dataset = sanitize(json, null);
    currentCenter = dataset;
    updateSummary(dataset);
    focusNode(dataset);
  } catch (error) {
    console.warn('Failed to load default dataset, using fallback demo.', error);
    const fallback = {
      name: 'Thailand National Budget (Demo)',
      value: 3400000000000,
      meta: {
        fiscalYear: 'FY2025',
        lastUpdated: 'Draft dataset',
        source: 'Demo data generated in-app'
      },
      children: [
        {
          name: 'Ministry of Finance',
          value: 840000000000,
          children: [
            { name: 'Customs Department', value: 120000000000 },
            { name: 'Excise Department', value: 150000000000 },
            { name: 'Fiscal Policy Office', value: 90000000000 }
          ]
        },
        {
          name: 'Ministry of Education',
          value: 620000000000,
          children: [
            { name: 'Office of the Basic Education Commission', value: 280000000000 },
            { name: 'Vocational Education Commission', value: 120000000000 }
          ]
        },
        {
          name: 'Ministry of Public Health',
          value: 520000000000,
          children: [
            { name: 'Department of Medical Services', value: 180000000000 },
            { name: 'Department of Health', value: 96000000000 }
          ]
        },
        {
          name: 'Ministry of Transport',
          value: 410000000000,
          children: [
            { name: 'Department of Highways', value: 160000000000 },
            { name: 'State Railway of Thailand', value: 120000000000 }
          ]
        },
        { name: 'Central Fund (งบกลาง)', value: 420000000000 }
      ]
    };
    nodeCounter = 0;
    nodeIndex.clear();
    dataset = sanitize(fallback, null);
    currentCenter = dataset;
    updateSummary(dataset);
    focusNode(dataset);
  }
}

loadDefault();

window.addEventListener('resize', () => {
  chart.resize();
});
