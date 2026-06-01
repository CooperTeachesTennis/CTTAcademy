(async function () {
  // If player is already signed in, offer quick access to their profile
  const { playerId } = window.CTTAuth.getPlayerSession();
  if (playerId) {
    const profileLink = document.querySelector('a[href="index.html"].btn--primary');
    if (profileLink) {
      profileLink.href = `/profile.html?id=${playerId}`;
      profileLink.textContent = 'Go to My Profile';
    }
  }
})();
