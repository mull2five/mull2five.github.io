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
    {% assign player_list = "" | split: "," %}
    {% for player_entry in site.data.players %}
      {% assign player_id = player_entry.id %}
      {% assign player_data = site.data.player_info[player_id] %}
      
      {% assign eu_rank = player_data.sources["Unity League"].data["Rank Europe"] | default: 99999 %}
      {% capture sort_key %}{{ eu_rank | prepend: "000000" | slice: -6, 6 }}{% endcapture %}
      
      {% capture player_item %}{{ sort_key }}|{{ player_id }}{% endcapture %}
      {% assign player_list = player_list | push: player_item %}
    {% endfor %}

    {% assign sorted_player_list = player_list | sort %}

    {% for player_item in sorted_player_list %}
      {% assign parts = player_item | split: "|" %}
      {% assign player_id = parts[1] %}
      {% assign player_entry = site.data.players | where: "id", player_id | first %}
      {% assign player_data = site.data.player_info[player_id] %}
      {% include player_card.html player=player_data extra=player_entry %}
    {% endfor %}
  </div>
</section>

