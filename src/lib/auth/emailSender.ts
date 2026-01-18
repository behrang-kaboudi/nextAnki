export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email provider not configured. Implement sendEmail() for production.");
  }

  console.log("[DEV EMAIL]", { to, subject, text });
}

