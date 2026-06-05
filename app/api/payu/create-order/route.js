import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { amount, orderId, email, phone, name } = await req.json();

    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;

    if (!merchantKey || !merchantSalt) {
      return NextResponse.json({ error: 'PayU not configured' }, { status: 503 });
    }

    // Generate hash for PayU
    const hashInput = `${merchantKey}|${orderId}|${amount}|Order|${name}|${email}|||||||||||${merchantSalt}`;
    const hash = crypto.createHash('sha512').update(hashInput).digest('hex');

    return NextResponse.json({
      ok: true,
      merchantKey,
      orderId,
      amount,
      email,
      phone,
      name,
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
