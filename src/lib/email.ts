import { Resend } from 'resend';

function getResendClient() {
  const apiKey = import.meta.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set.');
  }

  return new Resend(apiKey);
}

export async function sendOTP(email: string, otp: string) {
  const resend = getResendClient();

  await resend.emails.send({
    from: 'SweepsIntel <onboarding@resend.dev>',
    to: email,
    subject: 'Your SweepsIntel login code',
    text: `Your SweepsIntel login code is ${otp}.\n\nThis code expires in 15 minutes.`,
  });
}
