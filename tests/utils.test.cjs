const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitize, computeTotal, escapeHtml, lsKey } = require('../assets/utils.js');

test('sanitize coerces blank and numeric values', () => {
  const node = sanitize({
    value: '',
    desc: undefined,
    children: [
      { name: 'Child A', value: '10' },
      { name: 'Child B', value: 5 }
    ]
  });

  assert.equal(node.value, null);
  assert.equal(node.desc, '');
  assert.equal(node.children[0].value, 10);
  assert.equal(node.children[1].value, 5);
});

test('computeTotal sums children when value missing', () => {
  const root = sanitize({
    name: 'Root',
    value: '',
    children: [
      { name: 'Child A', value: 25 },
      { name: 'Child B', value: '', children: [{ name: 'Leaf', value: 5 }] }
    ]
  });

  assert.equal(computeTotal(root), 30);
});

test('escapeHtml escapes angle brackets and quotes', () => {
  const escaped = escapeHtml("<script>alert('x')</script>");
  assert.equal(escaped, '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
});

test('lsKey namespaces note storage paths', () => {
  assert.equal(lsKey('/Thailand/Budget'), 'thb_notes::/Thailand/Budget');
});
