(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BudgetMindMapUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function sanitize(node) {
    const next = node || {};
    const rawValue = next.value;
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      next.value = null;
    } else {
      const coerced = Number(rawValue);
      next.value = Number.isFinite(coerced) ? coerced : null;
    }
    next.desc = next.desc || '';
    if (Array.isArray(next.children)) {
      next.children = next.children.map(sanitize);
    } else {
      next.children = [];
    }
    return next;
  }

  function sumChildren(node) {
    if (!node.children || !node.children.length) return 0;
    return node.children.reduce((total, child) => {
      const childValue = child.value;
      return total + (childValue != null ? childValue : sumChildren(child));
    }, 0);
  }

  function computeTotal(node) {
    return node.value != null ? node.value : sumChildren(node);
  }

  function lsKey(pathStr) {
    return 'thb_notes::' + pathStr;
  }

  function escapeHtml(input) {
    const text = input == null ? '' : String(input);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, (ch) => map[ch]);
  }

  return { sanitize, sumChildren, computeTotal, lsKey, escapeHtml };
});
