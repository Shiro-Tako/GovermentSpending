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
  children: document.getElementById('childrenList')
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
      borderColor: 'rgba(56, 189, 248, 0.24)',
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
        return [
          `<div style="font-weight:600;margin-bottom:4px;">${path}</div>`,
          `<div>${total != null ? '฿' + THB(total) : 'Not specified'}</div>`,
          `<div style="opacity:0.65;font-size:11px;">Share of parent: ${pct(total, parentTotal)}</div>`
        ].join('');
      }
    },
    series: [
      {
        type: 'tree',
        data: [root],
        layout: 'radial',
        top: '2%',
        bottom: '2%',
        left: '2%',
        right: '2%',
        symbol: 'circle',
        symbolSize: 10,
        roam: true,
        expandAndCollapse: false,
        initialTreeDepth: 1,
        animationDuration: 500,
        animationDurationUpdate: 400,
        lineStyle: {
          color: 'rgba(56, 189, 248, 0.4)',
          width: 1.6
        },
        itemStyle: {
          color: '#0ea5e9',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1.2
        },
        label: {
          position: 'top',
          verticalAlign: 'middle',
          align: 'center',
          rotate: 'radial',
          distance: 14,
          color: '#f0f9ff',
          fontSize: 13,
          formatter: (params) => {
            const node = params.data;
            const value = totalFor(node);
            if (!params.treeAncestors || params.treeAncestors.length <= 1) {
              return '';
            }
            return `${node.name}\n${value != null ? compactTHB(value) : '—'}`;
          }
        },
        leaves: {
          label: {
            position: 'top',
            rotate: 'radial',
            distance: 12,
            fontSize: 12
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
  for (const child of node.children) {
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
}

function applyData(data) {
  dataset = sanitize(data);
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
  const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: '#020617' });
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
