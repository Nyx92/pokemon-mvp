import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

const sendSlackAlert = async (message: string) => {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!slackWebhookUrl) {
    console.error("Slack webhook URL is not defined");
    return;
  }

  await fetch(slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "POST") {
    const {
      firstName,
      lastName,
      country,
      dateOfBirth,
      email,
      countryCode,
      phoneNumber,
    } = req.body;

    // Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: "your-email@gmail.com",
      subject: "New Form Submission",
      text: `Details:\nName: ${firstName} ${lastName}\nCountry: ${country}\nDOB: ${dateOfBirth}\nEmail: ${email}\nPhone: ${countryCode}${phoneNumber}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Form submitted successfully" });
    } catch (error) {
      // Type guard to ensure error is an instance of Error before accessing 'message'
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Send alert to Slack
      await sendSlackAlert(
        `🚨 Form submission failed for ${email}. Error: ${errorMessage}`
      );

      res.status(500).json({ error: "Error sending email" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
};

export default handler;
