import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { finalizeOrder } from '@/lib/orders';
import { verifyPayuResponseHash } from '@/lib/payu';

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      status,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      hash,
      orderData,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      additionalCharges = '',
    } = body;

    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    if (!merchantSalt || !merchantKey) {
      return NextResponse.json({ error: 'PayU not configured' }, { status: 503 });
    }

    const hashValid = verifyPayuResponseHash({
      salt: merchantSalt,
      merchantKey,
      status,
      udf1: udf1 || (orderData ? JSON.stringify(orderData) : ''),
      udf2,
      udf3,
      udf4,
      udf5,
      email,
      firstname,
      productinfo,
      amount: String(amount ?? ''),
      txnid,
      additionalCharges,
      hash,
    });

    if (!hashValid) {
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
      return NextResponse.json({ error: 'insufficient_stock', shortages: result.shortages }, { status: 409 });
    }
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const order = result;

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
