(async function () {
  const mainContent = document.getElementById('main-content');
  const isCoach = !!window.CTTAuth.getCoachToken();

  let currentData = { discountCodes: '', links: [] };

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Escapes HTML, converts **bold** to <strong>, newlines to paragraphs
  function renderMarkdown(text) {
    if (!text || !text.trim()) return '';
    return text.trim().split('\n')
      .map(line => {
        const escaped = escHtml(line).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        return line.trim() ? `<p style="margin:0 0 4px;">${escaped}</p>` : '<br>';
      })
      .join('');
  }

  // Inline version for single-line fields (no paragraph wrapping)
  function renderInline(text) {
    if (!text) return '';
    return escHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  // Wraps saved selection in the given input/textarea with **
  function applyBold(el, start, end) {
    if (start === end) return;
    const val = el.value;
    el.value = val.slice(0, start) + '**' + val.slice(start, end) + '**' + val.slice(end);
    el.focus();
    el.setSelectionRange(start + 2, end + 2);
  }

  function showMsg(el, msg, type = 'error') {
    el.textContent = msg;
    el.className = `alert alert--${type} is-visible`;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderView(data) {
    const hasDiscounts = data.discountCodes && data.discountCodes.trim();
    const hasLinks = data.links && data.links.length > 0;
    const isEmpty = !hasDiscounts && !hasLinks;

    mainContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-primary-dark);">Resources</h1>
        ${isCoach ? `<button class="btn btn--secondary btn--sm" id="edit-resources-btn" type="button">Edit</button>` : ''}
      </div>

      ${isEmpty ? `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">📚</div>
            <div class="empty-state__text">Resources coming soon.</div>
          </div>
        </div>
      ` : ''}

      ${hasDiscounts ? `
        <div class="card mt-16">
          <div class="card__title">Discount Codes</div>
          <div style="font-size:0.9375rem;line-height:1.7;color:var(--color-text);">
            ${renderMarkdown(data.discountCodes)}
          </div>
        </div>
      ` : ''}

      ${hasLinks ? `
        <div class="card mt-16">
          <div class="card__title">Player Resources</div>
          <ul style="list-style:none;margin:0;padding:0;">
            ${data.links.map(l => `
              <li style="padding:12px 0;border-bottom:1px solid var(--color-border);">
                <a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer"
                   style="color:var(--color-primary);font-weight:500;font-size:0.9375rem;text-decoration:underline;">
                  ${renderInline(l.label)}
                </a>
                ${l.description ? `<div style="font-size:0.875rem;color:var(--color-text-muted);margin-top:3px;">${renderInline(l.description)}</div>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    if (isCoach) {
      document.getElementById('edit-resources-btn').addEventListener('click', () => renderEdit(data));
    }
  }

  function buildLinkRow(link) {
    const row = document.createElement('div');
    row.className = 'link-row';
    row.style.cssText = 'border:1px solid var(--color-border);border-radius:8px;padding:12px;margin-bottom:10px;';
    row.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input type="text" class="link-label" placeholder="Label (e.g. Singles Strategy Book)"
               value="${escHtml(link.label || '')}" style="flex:1;">
        <button class="btn btn--ghost btn--sm remove-link-btn" type="button"
                style="color:#c0392b;flex-shrink:0;">Remove</button>
      </div>
      <input type="url" class="link-url" placeholder="https://..."
             value="${escHtml(link.url || '')}" style="width:100%;margin-bottom:8px;box-sizing:border-box;">
      <textarea class="link-description" placeholder="Description — wrap text in **asterisks** to bold it"
                rows="2" style="width:100%;box-sizing:border-box;resize:vertical;">${escHtml(link.description || '')}</textarea>
    `;
    row.querySelector('.remove-link-btn').addEventListener('click', () => row.remove());
    return row;
  }

  function renderEdit(data) {
    const links = data.links && data.links.length > 0 ? [...data.links] : [];

    mainContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-primary-dark);">Resources</h1>
      </div>

      <div id="resources-msg" class="alert" role="alert"></div>

      <div class="card">
        <div class="card__title">Discount Codes</div>
        <p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:4px;">
          One code per line. Select text and click <strong>B</strong> to bold it.
        </p>
        <div style="text-align:right;margin-bottom:2px;">
          <button class="btn btn--ghost btn--sm" id="bold-discounts-btn" type="button"
                  title="Bold selected text" style="font-weight:700;min-width:32px;">B</button>
        </div>
        <textarea id="discount-codes-input" style="min-height:120px;">${escHtml(data.discountCodes)}</textarea>
      </div>

      <div class="card mt-16">
        <div class="card__title">Player Resources</div>
        <p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:8px;">
          Add links below. Wrap description text in <strong>**asterisks**</strong> to bold it.
        </p>
        <div id="links-list"></div>
        <button class="btn btn--secondary btn--sm mt-8" id="add-link-btn" type="button">+ Add link</button>
      </div>

      <div class="btn-row mt-16">
        <button class="btn btn--primary" id="save-resources-btn" type="button">Save</button>
        <button class="btn btn--secondary" id="cancel-resources-btn" type="button">Cancel</button>
      </div>
    `;

    const linksList = document.getElementById('links-list');
    for (const link of links) {
      linksList.appendChild(buildLinkRow(link));
    }

    const discountEl = document.getElementById('discount-codes-input');
    document.getElementById('bold-discounts-btn').addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyBold(discountEl, discountEl.selectionStart, discountEl.selectionEnd);
    });

    document.getElementById('add-link-btn').addEventListener('click', () => {
      linksList.appendChild(buildLinkRow({ label: '', url: '', description: '' }));
    });

    document.getElementById('cancel-resources-btn').addEventListener('click', () => renderView(currentData));

    document.getElementById('save-resources-btn').addEventListener('click', async () => {
      const msgEl = document.getElementById('resources-msg');
      const btn = document.getElementById('save-resources-btn');
      btn.disabled = true; btn.textContent = 'Saving…';

      const discountCodes = document.getElementById('discount-codes-input').value;
      const linksArr = [];
      for (const row of document.querySelectorAll('.link-row')) {
        const label = row.querySelector('.link-label').value.trim();
        const url = row.querySelector('.link-url').value.trim();
        const description = row.querySelector('.link-description').value.trim();
        if (label || url) linksArr.push({ label, url, description });
      }

      try {
        const res = await window.CTTAPI.apiPut('/api/resources', { discountCodes, links: linksArr });
        const saved = await window.CTTAPI.parseJson(res);
        if (!res.ok) { showMsg(msgEl, saved?.error || 'Save failed.'); return; }
        currentData = saved;
        renderView(currentData);
      } catch { showMsg(document.getElementById('resources-msg'), 'Something went wrong.'); }
      finally { btn.disabled = false; btn.textContent = 'Save'; }
    });
  }

  try {
    const res = await window.CTTAPI.apiGet('/api/resources');
    const data = await window.CTTAPI.parseJson(res);
    if (data) currentData = data;
    renderView(currentData);
  } catch {
    mainContent.innerHTML = '<div class="card"><p>Could not load resources. Please refresh.</p></div>';
  }
})();
