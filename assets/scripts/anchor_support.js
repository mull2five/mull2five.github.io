(function() {
  function expandPlayerFromHash() {
    const hash = window.location.hash.substring(1);
    if (hash) {
      const playerCard = document.getElementById(hash);
      if (playerCard && playerCard.classList.contains('player-card')) {
        playerCard.classList.add('expanded');
      }
    }
  }
  window.addEventListener('DOMContentLoaded', expandPlayerFromHash);
  window.addEventListener('hashchange', expandPlayerFromHash);
})();
