(async function () {
  const container = document.getElementById('main-content');

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  try {
    const res = await fetch('/api/guest/info');
    const info = await res.json();

    const approachItems = (info.approach || []).map(a => `<li style="font-size:0.9375rem;line-height:1.6;">${escHtml(a)}</li>`).join('');

    container.innerHTML = `
      <div class="brand-block" style="text-align:left;margin-bottom:24px;">
        <div class="brand-block__name">${escHtml(info.name)}</div>
        <div class="brand-block__tagline">${escHtml(info.title)}</div>
      </div>

      <div class="card">
        <div class="card__title">About</div>
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

      <div class="text-center mt-24">
        <a href="index.html" class="btn btn--primary" style="width:auto;padding:10px 28px;">
          Access My Player Profile
        </a>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="card"><p>Unable to load page. Please try again.</p></div>';
  }
})();
