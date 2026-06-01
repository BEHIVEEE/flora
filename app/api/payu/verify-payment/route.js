import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
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

    // Payment verified, create order
    const db = await getDb();
    const ordersCollection = db.collection('orders');

    const order = {
      id: txnid,
      userId: orderData.userId,
      items: orderData.items,
      address: orderData.address,
      payment: orderData.payment,
      paymentMethod: 'PayU',
      paymentId: txnid,
      subtotal: orderData.subtotal,
      discount: orderData.discount,
      deliveryFee: orderData.deliveryFee,
      total: orderData.total,
      slotId: orderData.slotId,
      slotDate: orderData.slotDate,
      deliveryMethod: orderData.deliveryMethod,
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await ordersCollection.insertOne(order);

    // Update slot availability if applicable
    if (orderData.slotId && orderData.slotDate) {
      const slotsCollection = db.collection('slots');
      await slotsCollection.updateOne(
        { id: orderData.slotId, date: orderData.slotDate },
        { $inc: { available: -1 } }
      );
    }

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
