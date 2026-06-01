(async function () {
  const stateLookup = document.getElementById('state-lookup');
  const stateNotFound = document.getElementById('state-notfound');
  const emailInput = document.getElementById('email-input');
  const lookupBtn = document.getElementById('lookup-btn');
  const lookupError = document.getElementById('lookup-error');
  const createProfileBtn = document.getElementById('create-profile-btn');
  const tryAgainBtn = document.getElementById('try-again-btn');

  let pendingEmail = '';

  function showError(msg) {
    lookupError.textContent = msg;
    lookupError.classList.add('is-visible');
  }

  function hideError() {
    lookupError.textContent = '';
    lookupError.classList.remove('is-visible');
  }

  function showState(state) {
    stateLookup.style.display = state === 'lookup' ? '' : 'none';
    stateNotFound.style.display = state === 'notfound' ? '' : 'none';
  }

  // If already authenticated, skip the landing page
  const redirected = await window.CTTAuth.redirectIfAuthenticated();
  if (redirected) return;

  lookupBtn.addEventListener('click', async () => {
    hideError();
    const email = emailInput.value.trim();
    if (!email) { showError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Please enter a valid email address.'); return; }

    lookupBtn.disabled = true;
    lookupBtn.textContent = 'Looking up…';

    try {
      const res = await window.CTTAPI.apiPost('/api/player/lookup', { email });
      const data = await window.CTTAPI.parseJson(res);

      if (res.status === 404 || !data.found) {
        pendingEmail = email;
        sessionStorage.setItem('ctt_pending_email', email);
        showState('notfound');
        return;
      }

      if (!data.players || data.players.length === 0) {
        showError('No profiles found. Please try again.');
        return;
      }

      if (data.players.length === 1) {
        window.CTTAuth.setPlayerSession(data.players[0].id, email);
        window.location.href = `/profile.html?id=${data.players[0].id}`;
      } else {
        window.CTTAuth.setLookupResult(data.players, email);
        window.location.href = '/select.html';
      }
    } catch {
      showError('Something went wrong. Please try again.');
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = 'Access My Profile';
    }
  });

  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupBtn.click();
  });

  createProfileBtn.addEventListener('click', () => {
    window.location.href = '/register.html';
  });

  tryAgainBtn.addEventListener('click', () => {
    pendingEmail = '';
    emailInput.value = '';
    hideError();
    showState('lookup');
    emailInput.focus();
  });
})();
