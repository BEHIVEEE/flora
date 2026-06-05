import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { amount, orderId, email, phone, name, productInfo } = await req.json();

    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;

    if (!merchantKey || !merchantSalt) {
      return NextResponse.json({ error: 'PayU not configured' }, { status: 503 });
    }

    const productInfoValue = productInfo || 'Order';
    const udf1 = '';
    const udf2 = '';
    const udf3 = '';
    const udf4 = '';
    const udf5 = '';

    // Generate hash for PayU (official formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
    const hashInput = `${merchantKey}|${orderId}|${amount}|${productInfoValue}|${name}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${merchantSalt}`;
    const hash = crypto.createHash('sha512').update(hashInput).digest('hex');

    return NextResponse.json({
      ok: true,
      merchantKey,
      orderId,
      amount,
      email,
      phone,
      name,
      productInfo: productInfoValue,
      hash,
      payuUrl: process.env.PAYU_MODE === 'production'
        ? 'https://secure.payu.in/_payment'
        : 'https://test.payu.in/_payment',
    });
  } catch (error) {
    console.error('PayU order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
