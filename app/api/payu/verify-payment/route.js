import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { finalizeOrder } from '@/lib/orders';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const body = await req.json();
    const { status, txnid, amount, productinfo, firstname, email, phone, hash, orderData } = body;

    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    if (!merchantSalt) {
      return NextResponse.json({ error: 'PayU not configured' }, { status: 503 });
    }

    // Verify hash
    const hashInput = `${merchantSalt}|${status}|||||||||||${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||||`;
    const calculatedHash = crypto.createHash('sha512').update(hashInput).digest('hex');

    if (calculatedHash !== hash) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    if (status !== 'success') {
      return NextResponse.json({ error: 'Payment was not successful' }, { status: 400 });
    }

    const db = await getDb();

    const amountNumber = Number(amount) || 0;
    const orderPayload = orderData || {};
    if (orderPayload.total == null) orderPayload.total = amountNumber;
    if (!orderPayload.payment) orderPayload.payment = 'PayU';

    const order = await finalizeOrder(db, orderPayload, {
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

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
      },
    });
  } catch (error) {
    console.error('PayU verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
