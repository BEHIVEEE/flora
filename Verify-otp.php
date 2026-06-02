<?php
session_start();
$actual_sent_otp=$_SESSION['OTP'];
$entered_otp=$_POST['otp'];
$phone=$_SESSION['phone'];
if($actual_sent_otp==$entered_otp){
    echo "<h1 style='color:green'>Account Verified with OTP</h1>";
    echo "<h2 style='color:red'>Phone: $phone </h2>";
}else{
    header("location:otp.php?msg=Incorrect OTP Entered");
}

?>