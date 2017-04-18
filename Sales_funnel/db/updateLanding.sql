UPDATE landing_pages
   SET name=$2,  landing_class=$3, is_sell_content=$4, options=$5, marketing_stats=$6
 WHERE id=$1;