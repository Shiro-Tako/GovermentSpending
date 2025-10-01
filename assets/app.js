// Core logic for Thailand Budget Mind Map (radial tree with notes)
const chart = echarts.init(document.getElementById('chart'));
let originalData = null;    // full tree
let currentRoot = null;     // current view root
let currentPath = [];       // path array from original root
const stack = [];           // navigation stack

const THB = n => new Intl.NumberFormat('en-US').format(n);
const pct = (num, den) => (den && num != null) ? ((num/den)*100).toFixed(2) + '%' : '—';

function sanitize(node){
  // Coerce value to number, allow desc, ensure children array
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

function render(root, pathArr){
  currentRoot = root;
  currentPath = pathArr || [root.name];
  const total = computeTotal(root);
  chart.setOption({
    backgroundColor: '#0b0e12',
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
      lineStyle: { color: '#263445' },
      label: {
        position: 'right',
        verticalAlign: 'middle',
        align: 'left',
        color: '#d1d5db',
        fontSize: 12,
        formatter: function(params){
          const n = params.data;
          const pv = computeTotal(n);
          const parent = params.treeAncestors && params.treeAncestors.length > 1 ? params.treeAncestors[1] : root;
          const pTotal = computeTotal(parent);
          const share = pct(pv, pTotal);
          return n.name + (pv ? ' • ' + THB(pv) + ' (' + share + ')' : '');
        }
      },
      emphasis: { focus: 'descendant' }
    }]
  });
  updateDetails(root, currentPath, total, null);
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

function drillTo(node, nextPathArr){
  stack.push({ root: currentRoot, path: currentPath });
  render(node, nextPathArr);
}

chart.on('click', function (params) {
  const node = params.data;
  let parentTotal = null;
  if (params.treeAncestors && params.treeAncestors.length > 1){
    parentTotal = computeTotal(params.treeAncestors[1]);
  }
  const pathArr = (params.treePathInfo || []).map(x => x.name);
  updateDetails(node, pathArr, computeTotal(node), parentTotal);
  if (node && node.children && node.children.length){
    drillTo(node, pathArr);
  }
});

document.getElementById('backBtn').onclick = () => {
  if (!stack.length) return;
  const prev = stack.pop();
  render(prev.root, prev.path);
};
document.getElementById('resetBtn').onclick = () => {
  if (originalData){ stack.length = 0; render(originalData, [originalData.name]); }
};
document.getElementById('dlPngBtn').onclick = () => {
  const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: '#0b0e12' });
  const a = document.createElement('a');
  a.href = url;
  a.download = 'th_budget_mindmap.png';
  a.click();
};

// Notes utilities
function lsKey(pathStr){ return 'thb_notes::' + pathStr; }
function escapeHtml(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',''':'&#39;'}[m])); }
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
    render(originalData, [originalData.name]);
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
    render(originalData, [originalData.name]);
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
      render(originalData, [originalData.name]);
    } catch(err){
      alert('Invalid JSON: ' + err.message);
    }
  };
  reader.readAsText(f, 'utf-8');
});

loadDefault();
