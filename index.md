---
layout: default
---

<section id="about-us">
  <h2>About Us</h2>
  <p>
  Founded in early 2026, <strong>Mull 2 Five</strong> — also referred to as <strong>Mull2Five</strong> or simply <strong>M25</strong> — is a competitive Magic: The Gathering team based in Northern Germany. Even when the opening hand isn't perfect, we play to win. What started as a group of amateur enthusiasts in and around Hamburg has grown into a dedicated collective of players striving for the next level of competitive play. Our most commonly played format by far is Standard, but we also have players active in Modern and other formats.
  </p>
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

