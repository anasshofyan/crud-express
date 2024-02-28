const nodemailer = require('nodemailer')

const sendVerificationEmail = async (email, token, name) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_SENDER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  })

  const verificationLink = `${process.env.REACT_BASE_URL}=${token}`
  const htmlContent = createEmailContent(name, verificationLink)

  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: email,
    subject: 'Email Verification',
    html: htmlContent,
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log('Email sent successfully')
  } catch (error) {
    console.error('Error sending email:', error)
  }
}

const createEmailContent = (name, verificationLink) => {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifikasi Email | Dompet Cerdas</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
      <table role="presentation" align="center" width="100%" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 20px 0; text-align: center;">
            <h1>Verifikasi Email</h1>
            <p>Hai, ${name}! Klik tombol di bawah untuk verifikasi emailmu ya.</p>
            <table align="center" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td bgcolor="#15803" style="border-radius: 3px;">
                  <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #15803; color: #ffffff; text-decoration: none; border-radius: 3px;">Verifikasi Email</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="text-align: center; margin-top: 20px;">Makasih ya udah pakai Dompet Cerdas!</p>
      <p style="text-align: center;">© 2024 Dompet Cerdas. Made with 💖</p>
    </body>
    </html>
  `
}

module.exports = sendVerificationEmail
