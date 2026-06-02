<?php
session_start();
$OTP=$_SESSION['OTP'];

$API="-------------"; // ENTER YOUR VALID API KEY HERE
$PHONE=$_POST['phone'];
$_SESSION['phone']=$PHONE;
$URL="https://sms.renflair.in/V1.php?API=$API&PHONE=$PHONE&OTP=$OTP";
$curl=curl_init($URL);
curl_setopt($curl,CURLOPT_URL,$URL);
curl_setopt($curl,CURLOPT_RETURNTRANSFER,true);
$resp=curl_exec($curl);
curl_close($curl);
$data=json_decode($resp);
header("location:otp.php");
?>