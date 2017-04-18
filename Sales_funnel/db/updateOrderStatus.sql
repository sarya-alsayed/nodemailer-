UPDATE orders
   SET status=$2
 WHERE order_id=$1;
