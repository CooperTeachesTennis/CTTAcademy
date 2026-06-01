(function () {
  const firstNameEl = document.getElementById('firstName');
  const lastNameEl = document.getElementById('lastName');
  const emailEl = document.getElementById('email');
  const phoneEl = document.getElementById('phone');
  const ntrpEl = document.getElementById('ntrpLevel');
  const goalsEl = document.getElementById('improvementGoals');
  const parentEmailEl = document.getElementById('parentEmail');
  const registerBtn = document.getElementById('register-btn');
  const errorEl = document.getElementById('register-error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('is-visible');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
  }

  // Pre-fill email from the pending email stored during lookup
  const pendingEmail = sessionStorage.getItem('ctt_pending_email');
  if (pendingEmail) {
    emailEl.value = pendingEmail;
    sessionStorage.removeItem('ctt_pending_email');
  }

  registerBtn.addEventListener('click', async () => {
    hideError();

    const firstName = firstNameEl.value.trim();
    const lastName = lastNameEl.value.trim();
    const email = emailEl.value.trim();
    const phone = phoneEl.value.trim();

    if (!firstName || !lastName || !email || !phone) {
      showError('All fields are required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating profile…';

    try {
      const res = await window.CTTAPI.apiPost('/api/player', {
        firstName,
        lastName,
        email,
        phone,
        ntrpLevel: ntrpEl.value,
        improvementGoals: goalsEl.value.trim(),
        parentEmail: parentEmailEl.value.trim(),
      });

      const data = await window.CTTAPI.parseJson(res);

      if (res.status === 409) {
        if (data?.code === 'INACTIVE') {
          showError(data.error);
        } else {
          showError('A profile already exists for this email. Go back and use the lookup form.');
        }
        return;
      }

      if (!res.ok || !data?.id) {
        showError(data?.error || 'Something went wrong. Please try again.');
        return;
      }

      window.CTTAuth.setPlayerSession(data.id, email);
      window.location.href = `/profile.html?id=${data.id}`;
    } catch {
      showError('Something went wrong. Please try again.');
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create My Profile';
    }
  });
})();
