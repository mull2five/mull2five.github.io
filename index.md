---
layout: default
---

<section id="about-us">
  <h2>About Us</h2>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
  <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
</section>

<hr>

<section id="players">
  <h2>Our Players</h2>
  <div class="players-container">
    {% for player_entry in site.data.players %}
      {% assign player_id = player_entry.id %}
      {% assign player_data = site.data.player_info[player_id] %}
      {% include player_card.html player=player_data extra=player_entry %}
    {% endfor %}
  </div>
</section>

