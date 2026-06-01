# PayU Payment Gateway Setup

Since Razorpay doesn't support pharmacies, we've integrated **PayU** which explicitly supports medical stores and pharmacies.

## Step 1: Create PayU Account

1. Go to https://www.payu.in/
2. Click **"Sign Up"** → Select **"Merchant"**
3. Fill in your business details:
   - Business Type: **Medical Store / Pharmacy**
   - Shop Name: FloraChemist
   - Address: Your shop address
4. Complete KYC verification (PAN, GST, Bank Account)
5. Once approved, you'll get:
   - **Merchant Key** (e.g., `gtKFFx`)
   - **Merchant Salt** (e.g., `eCwWELxi`)

## Step 2: Add Environment Variables

Add these to your `.env.local` and Vercel:

```
PAYU_MERCHANT_KEY=your_merchant_key_here
PAYU_MERCHANT_SALT=your_merchant_salt_here
PAYU_MODE=sandbox  # Use 'sandbox' for testing, 'production' for live
```

## Step 3: Test Payment (Sandbox)

1. Set `PAYU_MODE=sandbox` in `.env.local`
2. Go to checkout and select **UPI/CARD/WALLET**
3. You'll be redirected to PayU sandbox
4. Use test credentials:
   - **Card:** 4111111111111111
   - **Expiry:** Any future date
   - **CVV:** 123
   - **OTP:** 123456

## Step 4: Go Live

1. PayU will verify your account (24-48 hours)
2. Change `PAYU_MODE=production` in Vercel
3. Update environment variables with live keys
4. Test with real payment (small amount)

## Supported Payment Methods

PayU supports:
- ✅ UPI (GPay, PhonePe, Paytm, BHIM)
- ✅ Credit/Debit Cards (Visa, Mastercard, RuPay)
- ✅ Net Banking
- ✅ Wallets (Paytm, Mobikwik, Freecharge)
- ✅ EMI options

## Features

- **Instant Settlement:** Funds transferred to your bank within 24 hours
- **Low Fees:** 1.5-2% for pharmacies (negotiable)
- **Pharmacy Support:** Explicitly supports medical stores
- **Secure:** PCI-DSS Level 1 certified
- **Easy Reconciliation:** Dashboard with detailed reports

## Troubleshooting

**Payment fails with "Invalid merchant":**
- Check `PAYU_MERCHANT_KEY` and `PAYU_MERCHANT_SALT` are correct
- Ensure they're set in both `.env.local` and Vercel

**Hash mismatch error:**
- Verify merchant salt is exactly as provided by PayU
- Check that amount format is correct (2 decimal places)

**Test card not working:**
- Use sandbox mode: `PAYU_MODE=sandbox`
- Try different test card: 5555555555554444

## Support

- PayU Support: https://www.payu.in/contact-us
- Documentation: https://www.payu.in/merchant/faq
- Email: merchant@payu.in
