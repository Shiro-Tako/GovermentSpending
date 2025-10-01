// Core logic for Thailand Budget Mind Map (radial tree with notes)
const chart = echarts.init(document.getElementById('chart'));
let originalData = null;    // full tree
let currentRoot = null;     // current view root
let currentPath = [];       // path array from original root
const stack = [];           // navigation stack

const summaryEls = {
  total: document.getElementById('summaryTotal'),
  ministries: document.getElementById('summaryMinistries'),
  nodes: document.getElementById('summaryNodes'),
  updated: document.getElementById('summaryUpdated'),
};

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('nodeSearch');
const searchHint = document.getElementById('searchHint');
const defaultHint = searchHint ? searchHint.textContent : '';
let searchIndex = [];

const THB = n => new Intl.NumberFormat('en-US').format(n);
const pct = (num, den) => (den && num != null) ? ((num/den)*100).toFixed(2) + '%' : '—';
const formatUpdated = (source) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(source ?? new Date());

function sanitize(node){
  const v = node.value;
  if (v === '' || v === null || v === undefined) node.value = null;
  else node.value = Number(v);
  node.desc = node.desc || '';
  if (Array.isArray(node.children)) node.children = node.children.map(sanitize);
  else node.children = [];
  return node;
}

function sumChildren(node){
  if (!node.children) return 0;
  return node.children.reduce((s, c) => s + (c.value ?? sumChildren(c)), 0);
}
function computeTotal(node){ return node.value ?? sumChildren(node); }
function countNodes(node){
  if (!node) return 0;
  const children = Array.isArray(node.children) ? node.children : [];
  return 1 + children.reduce((acc, child) => acc + countNodes(child), 0);
}

function updateOverview(){
  if (!originalData) return;
  const total = computeTotal(originalData);
  summaryEls.total.textContent = total != null ? THB(total) + ' THB' : '—';
  summaryEls.ministries.textContent = originalData.children ? originalData.children.length : 0;
  summaryEls.nodes.textContent = countNodes(originalData);
}

function setOverviewUpdated(label){
  summaryEls.updated.textContent = label;
}

function setSearchHint(message, isError){
  if (!searchHint) return;
  searchHint.textContent = message || defaultHint;
  searchHint.classList.toggle('error', Boolean(isError));
}

function updateSearchIndex(){
  if (!originalData) return;
  searchIndex = [];
  const datalist = document.getElementById('nodeOptions');
  if (datalist) datalist.innerHTML = '';
  const traverse = (node, pathArr, parentTotal) => {
    const total = computeTotal(node);
    const entry = {
      name: node.name,
      path: pathArr.slice(),
      total,
      parentTotal
    };
    searchIndex.push(entry);
    if (datalist){
      const option = document.createElement('option');
      option.value = node.name;
      option.label = total ? `${node.name} • ${THB(total)} THB` : node.name;
      datalist.appendChild(option);
    }
    (node.children || []).forEach(child => traverse(child, [...pathArr, child.name], total));
  };
  traverse(originalData, [originalData.name], null);
  setSearchHint(defaultHint, false);
}

function focusByPath(pathArr, parentTotal){
  if (!originalData || !Array.isArray(pathArr) || !pathArr.length) return false;
  const rootName = originalData.name;
  const resolvedPath = pathArr[0] === rootName ? pathArr.slice() : [rootName, ...pathArr];
  const ancestors = [originalData];
  let node = originalData;
  for (let i = 1; i < resolvedPath.length; i++){
    const targetName = resolvedPath[i];
    const next = (node.children || []).find(child => child.name === targetName);
    if (!next) return false;
    ancestors.push(next);
    node = next;
  }
  stack.length = 0;
  for (let i = 0; i < ancestors.length - 1; i++){
    stack.push({ root: ancestors[i], path: resolvedPath.slice(0, i + 1) });
  }
  const parentNode = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null;
  const parentTotalResolved = parentTotal ?? (parentNode ? computeTotal(parentNode) : null);
  render(node, resolvedPath, parentTotalResolved);
  return true;
}

function handleSearch(query){
  if (!query || !query.trim()){
    setSearchHint('Type a ministry or programme to navigate.', false);
    return;
  }
  const lower = query.trim().toLowerCase();
  let match = searchIndex.find(entry => entry.name.toLowerCase() === lower);
  if (!match){
    match = searchIndex.find(entry => entry.name.toLowerCase().includes(lower));
  }
  if (!match){
    setSearchHint(`No match for “${query}”.`, true);
    return;
  }
  if (focusByPath(match.path, match.parentTotal)){
    const share = match.parentTotal ? pct(match.total, match.parentTotal) : '100%';
    setSearchHint(`Showing ${match.name} • ${match.total ? THB(match.total) + ' THB' : '—'} (${share}).`, false);
    searchInput && (searchInput.value = match.name);
  } else {
    setSearchHint(`Could not open “${match.name}”.`, true);
  }
}

function render(root, pathArr, parentTotal){
  currentRoot = root;
  currentPath = pathArr || [root.name];
  const total = computeTotal(root);
  chart.setOption({
    backgroundColor: 'transparent',
    series: [{
      type: 'tree',
      data: [root],
      top: '2%',
      left: '1.5%',
      bottom: '2%',
      right: '1.5%',
      symbol: 'circle',
      symbolSize: 10,
      edgeShape: 'curve',
      layout: 'radial',
      roam: true,
      initialTreeDepth: 2,
      animationDurationUpdate: 400,
      lineStyle: { color: 'rgba(148, 163, 184, 0.35)' },
      label: {
        position: 'right',
        verticalAlign: 'middle',
        align: 'left',
        color: '#e2e8f0',
        fontSize: 12,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        formatter: function(params){
          const n = params.data;
          const pv = computeTotal(n);
          const parent = params.treeAncestors && params.treeAncestors.length > 1 ? params.treeAncestors[1] : root;
          const pTotal = computeTotal(parent);
          const share = pct(pv, pTotal);
          return n.name + (pv ? ` • ${THB(pv)} (${share})` : '');
        }
      },
      emphasis: { focus: 'descendant' }
    }]
  });
  const shareBase = parentTotal != null ? parentTotal : null;
  updateDetails(root, currentPath, total, shareBase);
  document.getElementById('backBtn').disabled = stack.length === 0;
}

function updateDetails(node, pathArr, total, parentTotal){
  const pathStr = '/' + pathArr.join('/');
  const nodeTotal = computeTotal(node);
  document.getElementById('nodeTitle').textContent = 'Center: ' + node.name;
  document.getElementById('nodeTotal').textContent = nodeTotal != null ? THB(nodeTotal) + ' THB' : '—';
  document.getElementById('nodeShare').textContent = parentTotal ? pct(nodeTotal, parentTotal) : '—';
  document.getElementById('nodePath').textContent = pathStr;
  document.getElementById('nodeDesc').textContent = node.desc || '—';

  loadNotes(pathStr);
  document.getElementById('addNoteBtn').onclick = () => addNote(pathStr);
  document.getElementById('clearNodeNotes').onclick = () => clearNotes(pathStr);
  document.getElementById('exportNodeNotes').onclick = () => exportNotes(pathStr);
}

function drillTo(node, nextPathArr, parentTotal){
  stack.push({ root: currentRoot, path: currentPath });
  render(node, nextPathArr, parentTotal);
}

chart.on('click', function (params) {
  const node = params.data;
  let parentTotal = null;
  if (params.treeAncestors && params.treeAncestors.length > 1){
    parentTotal = computeTotal(params.treeAncestors[1]);
  }
  const pathArr = (params.treePathInfo || []).map(x => x.name);
  const nodeTotal = computeTotal(node);
  updateDetails(node, pathArr, nodeTotal, parentTotal);
  if (node && node.children && node.children.length){
    drillTo(node, pathArr, parentTotal);
  }
});

document.getElementById('backBtn').onclick = () => {
  if (!stack.length) return;
  const prev = stack.pop();
  let parentTotal = null;
  if (prev.path && prev.path.length > 1 && originalData){
    const parentPath = prev.path.slice(0, -1);
    let parentNode = originalData;
    for (let i = 1; i < parentPath.length; i++){
      const next = (parentNode.children || []).find(child => child.name === parentPath[i]);
      if (!next) break;
      parentNode = next;
    }
    parentTotal = computeTotal(parentNode);
  }
  render(prev.root, prev.path, parentTotal);
};
document.getElementById('resetBtn').onclick = () => {
  if (originalData){
    stack.length = 0;
    render(originalData, [originalData.name], null);
    setSearchHint(defaultHint, false);
  }
};
document.getElementById('dlPngBtn').onclick = () => {
  const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: '#0b0e12' });
  const a = document.createElement('a');
  a.href = url;
  a.download = 'th_budget_mindmap.png';
  a.click();
};

if (searchForm && searchInput){
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(searchInput.value);
  });
  searchInput.addEventListener('change', () => {
    if (searchInput.value){
      handleSearch(searchInput.value);
    }
  });
  searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()){
      setSearchHint(defaultHint, false);
    } else if (searchHint) {
      searchHint.classList.remove('error');
    }
  });
}

// Notes utilities
function lsKey(pathStr){ return 'thb_notes::' + pathStr; }
function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}
function loadNotes(pathStr){
  const el = document.getElementById('notesList');
  el.innerHTML = '';
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(lsKey(pathStr)) || '[]'); } catch(e){ notes = []; }
  if (!notes.length){
    el.innerHTML = '<div class="muted">No messages yet. Start the discussion for this ministry.</div>';
    return;
  }
  for (const n of notes){
    const div = document.createElement('div');
    div.className = 'note';
    div.innerHTML = `${escapeHtml(n.text)}<time>${new Date(n.ts).toLocaleString()}</time>`;
    el.appendChild(div);
  }
}
function addNote(pathStr){
  const ta = document.getElementById('noteText');
  const txt = ta.value.trim();
  if (!txt) return;
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(lsKey(pathStr)) || '[]'); } catch(e){ notes = []; }
  notes.push({ text: txt, ts: Date.now() });
  localStorage.setItem(lsKey(pathStr), JSON.stringify(notes));
  ta.value = '';
  loadNotes(pathStr);
}
function clearNotes(pathStr){
  if (!confirm('Clear all messages for this ministry?')) return;
  localStorage.removeItem(lsKey(pathStr));
  loadNotes(pathStr);
}
function exportNotes(pathStr){
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(lsKey(pathStr)) || '[]'); } catch(e){ notes = []; }
  const blob = new Blob([JSON.stringify({ path: pathStr, notes }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notes' + pathStr.replace(/\//g,'_') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Load default data
async function loadDefault(){
  try {
    const res = await fetch('data/th_budget_FY2025.json', { cache: 'no-store' });
    const json = await res.json();
    originalData = sanitize(json);
    render(originalData, [originalData.name], null);
    updateOverview();
    updateSearchIndex();
    const lastMod = res.headers.get('last-modified');
    if (lastMod){
      setOverviewUpdated(new Date(lastMod).toLocaleString());
    } else {
      setOverviewUpdated(formatUpdated());
    }
    setSearchHint('Loaded FY2025 national budget dataset.', false);
  } catch (e){
    console.warn('Failed to load default JSON, using demo set:', e);
    const demo = {
      name: 'Thailand National Budget (FY2025)',
      value: 0,
      children: [
        { name: 'Ministry of Finance', value: 0, children: [
          { name: 'Customs Department', value: 0 },
          { name: 'Excise Department', value: 0 }
        ]},
        { name: 'Ministry of Education', value: 0, children: []},
        { name: 'Ministry of Public Health', value: 0, children: []},
        { name: 'Central Fund (งบกลาง)', value: 0, children: []}
      ]
    };
    originalData = sanitize(demo);
    render(originalData, [originalData.name], null);
    updateOverview();
    updateSearchIndex();
    setOverviewUpdated('Demo data');
    setSearchHint('Using demo dataset because the default file could not be loaded.', true);
  }
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try{
      const parsed = JSON.parse(ev.target.result);
      originalData = sanitize(parsed);
      stack.length = 0;
      render(originalData, [originalData.name], null);
      updateOverview();
      updateSearchIndex();
      setOverviewUpdated('Custom upload • ' + formatUpdated());
      setSearchHint('Loaded custom dataset from file upload.', false);
    } catch(err){
      alert('Invalid JSON: ' + err.message);
    }
  };
  reader.readAsText(f, 'utf-8');
});

loadDefault();
