INSERT INTO orders(
            order_id, landing_id, client_id, date, currency, amount, order_type, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
