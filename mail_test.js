import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

try {
  const response = await resend.emails.send({
    from: "Pour n Art <studio@pournart.in>",
    to: "pournart@gmail.com",
    replyTo: "studio@pournart.in",
    subject: "Resend Test",
    html: "<h2>Hello Alex 👋</h2><p>This is a test from Resend.</p>",
  });

  console.log(response);
} catch (error) {
  console.error(error);
}