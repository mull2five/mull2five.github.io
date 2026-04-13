(function() {
  function expandPlayerFromHash() {
    const hash = window.location.hash.substring(1);
    if (hash) {
      const playerCard = document.getElementById(hash);
      if (playerCard && playerCard.classList.contains('player-card')) {
        // Collapse other expanded cards
        document.querySelectorAll('.player-card.expanded').forEach(card => {
          if (card !== playerCard) {
            card.classList.remove('expanded');
          }
        });
        playerCard.classList.add('expanded');
        // Scroll slightly above the player card to account for any fixed headers if needed
        playerCard.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  window.updatePlayerHash = function(element) {
    if (element.classList.contains('expanded')) {
      // Collapse other expanded cards
      document.querySelectorAll('.player-card.expanded').forEach(card => {
        if (card !== element) {
          card.classList.remove('expanded');
        }
      });
      const id = element.id;
      if (id) {
        history.replaceState(null, null, '#' + id);
      }
    } else {
      // If no player card is expanded, remove the hash
      const expandedCards = document.querySelectorAll('.player-card.expanded');
      if (expandedCards.length === 0) {
        history.replaceState(null, null, window.location.pathname + window.location.search);
      }
    }
  };

  window.addEventListener('DOMContentLoaded', expandPlayerFromHash);
  window.addEventListener('hashchange', expandPlayerFromHash);
})();
