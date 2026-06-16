import { payuRedirect } from '@/lib/payu';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const error = formData.get('error') || 'Payment failed';
    const txnid = formData.get('txnid');

    console.log('PayU payment failed:', { txnid, error });

    return payuRedirect(req, `/checkout?error=${encodeURIComponent(error)}`);
  } catch (error) {
    console.error('PayU failure handler error:', error);
    return payuRedirect(req, '/checkout?error=server_error');
  }
}
