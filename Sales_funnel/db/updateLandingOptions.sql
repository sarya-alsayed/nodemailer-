UPDATE landing_pages
   SET options=$3
 WHERE landing_theme_id=$2 and landing_class=$1;