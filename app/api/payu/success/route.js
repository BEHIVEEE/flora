import { getDb } from '@/lib/mongo';
import { finalizeOrder } from '@/lib/orders';
import { payuRedirect, verifyPayuResponseHash } from '@/lib/payu';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const status = String(formData.get('status') || '');
    const txnid = String(formData.get('txnid') || '');
    const amount = String(formData.get('amount') || '');
    const productinfo = String(formData.get('productinfo') || '');
    const firstname = String(formData.get('firstname') || '');
    const email = String(formData.get('email') || '');
    const phone = String(formData.get('phone') || '');
    const hash = String(formData.get('hash') || '');
    const udf1 = String(formData.get('udf1') || '');
    const udf2 = String(formData.get('udf2') || '');
    const udf3 = String(formData.get('udf3') || '');
    const udf4 = String(formData.get('udf4') || '');
    const udf5 = String(formData.get('udf5') || '');
    const additionalCharges = String(formData.get('additionalCharges') || '');

    // Log everything PayU sent back for debugging
    console.log('[PayU success raw]', {
      status, txnid, amount, productinfo, firstname, email,
      hash, additionalCharges,
      udf1: udf1?.slice(0, 120),
      udf2, udf3, udf4, udf5,
      allKeys: [...formData.keys()],
    });

    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    if (!merchantSalt || !merchantKey) {
      return payuRedirect(req, '/checkout?error=server_error');
    }

    const hashValid = verifyPayuResponseHash({
      salt: merchantSalt,
      merchantKey,
      status,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      additionalCharges,
      hash,
    });

    if (!hashValid) {
      console.error('PayU hash mismatch', { txnid, status, amount });
      return payuRedirect(req, '/checkout?error=verification_failed');
    }

    if (status !== 'success') {
      return payuRedirect(req, '/checkout?error=payment_failed');
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
      return payuRedirect(req, `/checkout?error=insufficient_stock&shortages=${shortageParam}`);
    }
    if (result?.error) {
      return payuRedirect(req, `/checkout?error=${encodeURIComponent(result.error)}`);
    }
    const order = result;

    return payuRedirect(req, `/order-confirmed?id=${order.id}`);
  } catch (error) {
    console.error('PayU success error:', error);
    return payuRedirect(req, '/checkout?error=server_error');
  }
}
