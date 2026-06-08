import crypto from 'crypto';
import { NextResponse } from 'next/server';

/** PayU reverse-hash verification for payment response (POST callback). */
export function verifyPayuResponseHash({
  salt,
  merchantKey,
  status,
  udf1 = '',
  udf2 = '',
  udf3 = '',
  udf4 = '',
  udf5 = '',
  email = '',
  firstname = '',
  productinfo = '',
  amount = '',
  txnid = '',
  additionalCharges = '',
  hash = '',
}) {
  if (!salt || !merchantKey || !hash) return false;

  // PayU response hash (reverse of request):
  // Without additionalCharges: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
  // With additionalCharges:    sha512(additionalCharges|SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
  const core = [
    salt,
    status,
    '', '', '', '', '', // 5 empty fields (udf10–udf6 reversed)
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    merchantKey,
  ];

  const hashInput = additionalCharges
    ? [additionalCharges, ...core].join('|')
    : core.join('|');

  const calculated = crypto.createHash('sha512').update(hashInput).digest('hex');

  console.log('[PayU hash debug]', {
    txnid,
    status,
    amount,
    additionalCharges,
    udf1: udf1?.slice(0, 80),
    receivedHash: hash,
    calculatedHash: calculated,
    match: calculated === hash,
    hashInput: hashInput.slice(0, 200),
  });

  return calculated === hash;
}

/** Redirect browser with GET after PayU POST callback (avoids HTTP 405 on /checkout). */
export function payuRedirect(req, pathname) {
  return NextResponse.redirect(new URL(pathname, req.url), 303);
}
