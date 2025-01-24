const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text, html) => {
    // Create a transporter object using SMTP transport
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure:  false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER, // SMTP username
            pass: process.env.SMTP_PASS  // SMTP password
        }
    });

    // Define email options
    const mailOptions = {
        from: process.env.SMTP_USER, // sender address
        to, // list of receivers
        subject, // Subject line
        text, // plain text body
        html // html body
    };

    // Send email
    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = sendEmail;