(async function () {
  const container = document.getElementById('main-content');

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  try {
    const res = await fetch('https://ctt-worker.andermd535.workers.dev/api/guest/info');
    const info = await res.json();

    const approachItems = (info.approach || [])
      .map(a => `<li style="font-size:0.9375rem;line-height:1.7;">${escHtml(a)}</li>`)
      .join('');

    container.innerHTML = `
      <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-primary-dark);margin-bottom:24px;">About Me</h1>

      <div class="card">
        <div class="card__title">${escHtml(info.name)}</div>
        <p style="font-size:0.9375rem;line-height:1.7;">${escHtml(info.bio)}</p>
      </div>

      <div class="card mt-16">
        <div class="card__title">Coaching Approach</div>
        <ul style="padding-left:20px;display:flex;flex-direction:column;gap:10px;">
          ${approachItems}
        </ul>
      </div>

      <div class="card mt-16">
        <div class="card__title">Get in Touch</div>
        <p style="font-size:0.9375rem;">${escHtml(info.contact)}</p>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="card"><p>Unable to load page. Please try again.</p></div>';
  }
})();
