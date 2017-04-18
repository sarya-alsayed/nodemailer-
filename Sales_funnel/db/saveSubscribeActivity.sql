INSERT INTO subscribe_activity(
            subscribe_id, theme_id, activity_state, was_cold, was_lost, was_gold)
    VALUES ($1, $2, $3, $4, $5, $6);
