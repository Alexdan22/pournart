function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  await import("dotenv/config");
  const roles = [
    ["studio", process.env.EMAIL_STUDIO, "Studio test from studio@pournart.in"],
    ["orders", process.env.EMAIL_ORDERS, "Orders test from orders@pournart.in"],
    ["support", process.env.EMAIL_SUPPORT, "Support test from support@pournart.in"],
    ["contact", process.env.EMAIL_CONTACT, "Contact test from contact@pournart.in"],
  ];

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!process.env.EMAIL_ADMIN) {
    throw new Error("EMAIL_ADMIN is not configured.");
  }

  for (const [role, from, subject] of roles) {
    if (!from) {
      throw new Error(`Missing sender env for ${role}.`);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: process.env.EMAIL_ADMIN,
        subject,
        text: `This is a Pour n Art ${role} role test email.`,
        html: `<p>This is a Pour n Art <strong>${role}</strong> role test email.</p>`,
        reply_to: process.env.EMAIL_ADMIN,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[test-email:${role}:failed]`, result.message || `HTTP ${response.status}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`[test-email:${role}:sent] ${result.id || "accepted"}`);
    await wait(600);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
