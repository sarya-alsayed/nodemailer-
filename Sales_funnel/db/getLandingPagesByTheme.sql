select p.id, p.name, p.landing_class, p.is_sell_content from landing_pages p
join landing_themes t
on p.landing_theme_id = t.id
where t.theme = $1