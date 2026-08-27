// Minimal email sending abstraction.
// No SMTP credentials are configured yet, so by default this just logs the
// email to the server console. Once real SMTP credentials are available
// (SMTP_HOST/PORT/USER/PASS in .env), swap the body of sendEmail to use
// nodemailer (or any provider) - the call sites elsewhere never need to change.

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const hasSmtp = Boolean(process.env.SMTP_HOST);
  if (!hasSmtp) {
    // eslint-disable-next-line no-console
    console.log('--- EMAIL (SMTP not configured, logged only) ---');
    console.log(`To: ${message.to}`);
    console.log(`Subject: ${message.subject}`);
    console.log(message.body);
    console.log('-------------------------------------------------');
    return;
  }

  // TODO: integrate a real SMTP client (e.g. nodemailer) here once credentials exist.
  console.log(`[email] would send to ${message.to}: ${message.subject}`);
}
