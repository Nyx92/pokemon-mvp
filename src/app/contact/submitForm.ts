import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

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
      res.status(500).json({ error: "Error sending email" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
};

export default handler;
