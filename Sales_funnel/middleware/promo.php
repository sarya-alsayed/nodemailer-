<?php 
echo w;

$db = mysqli_connect("192.168.1.36", "root", "root", "jobmarket");

// Check connection
if($db === false){
   die("ERROR: Could not connect. " . mysqli_connect_error());
}



// Attempt ins ert query execution
$query = "INSERT IN TO promocode (promo)




VALUES ('$_POST[w]')";

if(mysqli_query($db, $query)){
   echo "Records added successfully.";
} else{
   echo "ERROR: Could not able to execute $query. " . mysqli_error($db);
}



// Close connection
mysqli_close($db);
?>