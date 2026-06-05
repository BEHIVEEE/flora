import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { finalizeOrder } from '@/lib/orders';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const status = formData.get('status');
    const txnid = formData.get('txnid');
    const amount = formData.get('amount');
    const productinfo = formData.get('productinfo');
    const firstname = formData.get('firstname');
    const email = formData.get('email');
    const phone = formData.get('phone');
    const hash = formData.get('hash');
    const udf1 = formData.get('udf1');

    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    if (!merchantSalt) {
      return NextResponse.json({ error: 'PayU not configured' }, { status: 503 });
    }

    // Verify hash
    const hashInput = `${merchantSalt}|${status}|||||||||||${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||||`;
    const calculatedHash = crypto.createHash('sha512').update(hashInput).digest('hex');

    if (calculatedHash !== hash) {
      return NextResponse.redirect(new URL('/checkout?error=verification_failed', req.url));
    }

    if (status !== 'success') {
      return NextResponse.redirect(new URL('/checkout?error=payment_failed', req.url));
    }

    const db = await getDb();

    let orderPayload = {};
    try {
      orderPayload = udf1 ? JSON.parse(udf1) : {};
    } catch (err) {
      console.error('PayU success parse error:', err);
      orderPayload = {};
    }
    if (!orderPayload || typeof orderPayload !== 'object') orderPayload = {};

    const amountNumber = Number(amount) || 0;
    if (orderPayload.total == null) orderPayload.total = amountNumber;
    if (!orderPayload.payment) orderPayload.payment = 'PayU';

    const result = await finalizeOrder(db, orderPayload, {
      id: txnid,
      paymentId: txnid,
      paymentMethod: 'PayU',
      paymentStatus: 'Paid',
      status: 'confirmed',
      dedupeQuery: { paymentId: txnid },
      extra: {
        gateway: 'PayU',
        gatewayMeta: {
          status,
          productinfo,
          amount: amountNumber,
          email,
          phone,
          customer: firstname,
        },
      },
    });

    if (result?.error === 'insufficient_stock') {
      const shortageParam = encodeURIComponent(JSON.stringify(result.shortages || []));
      return NextResponse.redirect(new URL(`/checkout?error=insufficient_stock&shortages=${shortageParam}`, req.url));
    }
    if (result?.error) {
      return NextResponse.redirect(new URL(`/checkout?error=${encodeURIComponent(result.error)}`, req.url));
    }
    const order = result;

    return NextResponse.redirect(new URL(`/order-confirmed?id=${order.id}`, req.url));
  } catch (error) {
    console.error('PayU success error:', error);
    return NextResponse.redirect(new URL('/checkout?error=server_error', req.url));
  }
}
