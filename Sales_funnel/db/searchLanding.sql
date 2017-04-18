select p.* from landing_pages p
join landing_themes t
on t.id = p.landing_theme_id
where p.landing_class = $1 and t.theme = $2