select o.order_id, o.date, l.name, s.id subscribe_id, s.firstname, s.lastname, s.middlename,
o.order_type, o.amount, o.currency,o.status
from orders o
join landing_pages l
on o.landing_id = l.id
join subscribers s
on s.id = o.client_id
order by order_id