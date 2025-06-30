const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "aarambhdecor.delhi@gmail.com", // Your Gmail address
    pass: "uouj dqqk sfut uacn",       // Replace with your App Password
  },
});

const sendEmail = async (email, subject, text) => {
  try {
    await transporter.sendMail({
      from: '"Aarambh Decor" <aarambhdecor.delhi@gmail.com>',
      to: email,
      subject,
      text,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = { sendEmail };
