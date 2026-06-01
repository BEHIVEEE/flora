import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
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

    // Payment verified, create order
    const db = await getDb();
    const ordersCollection = db.collection('orders');
    const orderData = JSON.parse(udf1);

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

    return NextResponse.redirect(new URL(`/order-confirmed?id=${order.id}`, req.url));
  } catch (error) {
    console.error('PayU success error:', error);
    return NextResponse.redirect(new URL('/checkout?error=server_error', req.url));
  }
}
