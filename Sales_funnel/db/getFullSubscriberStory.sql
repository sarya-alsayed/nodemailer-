select s.*, t.theme, a.activity_state, a.was_cold, a.was_lost, a.was_gold
from subscribers s
join subscribe_activity a
on s.id = a.subscribe_id
join landing_themes t
on a.theme_id = t.id
where s.id=$1
