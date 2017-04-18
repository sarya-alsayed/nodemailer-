select s.email,  t.theme, a.activity_state, a.was_cold, a.was_lost, a.was_gold from subscribe_activity a
join subscribers s
on s.id = a.subscribe_id
join landing_themes t
on a.theme_id = t.id 
join domains d
on t.domain_id = d.id