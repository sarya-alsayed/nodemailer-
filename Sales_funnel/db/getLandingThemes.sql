select d.url, t.theme, t.description
from landing_themes t
join domains d
on d.id = t.domain_id
