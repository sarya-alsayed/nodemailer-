select o.event_date, t.theme from targeted_offers o
join landing_themes t
on o.theme_id = t.id
where subscribe_id = $1