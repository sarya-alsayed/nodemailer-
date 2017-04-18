select o.order_id, o.date, l.name, o.currency, o.amount, o.order_type, o.status
from orders o
join landing_pages l
on o.landing_id = l.id
where o.client_id = $1