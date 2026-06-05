import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    let { amount, orderId, email, phone, name, productInfo, udf1: udf1Raw = '' } = await req.json();
    // PayU expects amount as 2-decimal string
    amount = (Number(amount) || 0).toFixed(2);

    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;

    if (!merchantKey || !merchantSalt) {
      return NextResponse.json({ error: 'PayU not configured' }, { status: 503 });
    }

    const productInfoValue = productInfo || 'Order';
    const udf1 = udf1Raw;
    const udf2 = '';
    const udf3 = '';
    const udf4 = '';
    const udf5 = '';
    const udf6 = '';
    const udf7 = '';
    const udf8 = '';
    const udf9 = '';
    const udf10 = '';

    // Generate hash for PayU (official formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
    const hashInput = `${merchantKey}|${orderId}|${amount}|${productInfoValue}|${name}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}|${udf6}|${udf7}|${udf8}|${udf9}|${udf10}|${merchantSalt}`;
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
