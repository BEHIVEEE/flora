import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const error = formData.get('error') || 'Payment failed';
    const txnid = formData.get('txnid');

    console.log('PayU payment failed:', { txnid, error });

    return NextResponse.redirect(new URL(`/checkout?error=${encodeURIComponent(error)}`, req.url));
  } catch (error) {
    console.error('PayU failure handler error:', error);
    return NextResponse.redirect(new URL('/checkout?error=server_error', req.url));
  }
}
