UPDATE subscribe_activity
   SET was_cold=$3, was_lost=$4, was_gold=$5,
       activity_state=$6
 WHERE subscribe_id=$1 and theme_id=$2;
