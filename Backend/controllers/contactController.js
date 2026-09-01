import nodemailer from 'nodemailer';
import Contact from '../models/Contact.js';

// ── Nodemailer transporter (lazy — reads env at request time) ───────────────
const MAIL_USER = process.env.MAIL_USER || 'msbillling@gmail.com';
const MAIL_PASS = process.env.MAIL_APP_PASS || 'awoxpqruiuqjgtdc';

const getTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
});

// ── HTML Email Templates ────────────────────────────────────────────────────

/** Notification email sent to MS Billings team */
const buildAdminEmail = ({ name, email, restaurantName, phone, message }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Contact Inquiry – MS Billings</title>
</head>
<body style="margin:0;padding:0;background:#f4f0eb;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0eb;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#b87333 0%,#c8963e 100%);padding:32px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MS Billings<span style="color:#fde8b0;">.</span></span>
                  <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.8);letter-spacing:0.12em;text-transform:uppercase;">Restaurant Management Platform</p>
                </td>
                <td align="right">
                  <span style="background:rgba(255,255,255,0.18);border-radius:6px;padding:6px 14px;font-size:11px;color:#fff;font-weight:600;letter-spacing:0.08em;">NEW INQUIRY</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 24px;">
            <h2 style="margin:0 0 6px;font-size:20px;color:#2c1f0e;font-weight:700;">You have a new contact message 🎉</h2>
            <p style="margin:0 0 28px;font-size:14px;color:#6b5c4e;">Someone submitted the contact form on your landing page. Details below.</p>

            <!-- Info Grid -->
            <table width="100%" cellpadding="0" cellspacing="0">

              <tr>
                <td style="padding:10px 14px;background:#fdf8f3;border-radius:8px 8px 0 0;border-bottom:1px solid #f0e8de;">
                  <span style="font-size:11px;color:#b87333;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Name</span><br/>
                  <span style="font-size:15px;color:#2c1f0e;font-weight:600;">${name}</span>
                </td>
              </tr>

              <tr>
                <td style="padding:10px 14px;background:#fdf8f3;border-bottom:1px solid #f0e8de;">
                  <span style="font-size:11px;color:#b87333;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Email</span><br/>
                  <span style="font-size:15px;color:#2c1f0e;font-weight:600;">${email}</span>
                </td>
              </tr>

              ${restaurantName ? `
              <tr>
                <td style="padding:10px 14px;background:#fdf8f3;border-bottom:1px solid #f0e8de;">
                  <span style="font-size:11px;color:#b87333;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Restaurant</span><br/>
                  <span style="font-size:15px;color:#2c1f0e;font-weight:600;">${restaurantName}</span>
                </td>
              </tr>` : ''}

              ${phone ? `
              <tr>
                <td style="padding:10px 14px;background:#fdf8f3;border-bottom:1px solid #f0e8de;">
                  <span style="font-size:11px;color:#b87333;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Phone</span><br/>
                  <span style="font-size:15px;color:#2c1f0e;font-weight:600;">${phone}</span>
                </td>
              </tr>` : ''}

              <tr>
                <td style="padding:10px 14px;background:#fdf8f3;border-radius:0 0 8px 8px;">
                  <span style="font-size:11px;color:#b87333;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Message</span><br/>
                  <span style="font-size:15px;color:#2c1f0e;line-height:1.6;white-space:pre-line;">${message}</span>
                </td>
              </tr>

            </table>

            <!-- Reply CTA -->
            <div style="margin-top:28px;text-align:center;">
              <a href="mailto:${email}?subject=Re: Your MS Billings Inquiry"
                 style="display:inline-block;background:linear-gradient(135deg,#b87333,#c8963e);color:#fff;font-weight:700;font-size:14px;padding:13px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.04em;">
                ✉️ &nbsp;Reply to ${name}
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fdf8f3;padding:18px 40px;border-top:1px solid #f0e8de;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9b8878;">This email was auto-generated by MS Billings contact system.</p>
            <p style="margin:4px 0 0;font-size:12px;color:#b87333;font-weight:600;">msbillling@gmail.com &nbsp;·&nbsp; msbillings.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
`;

/** Acknowledgement email sent to the user who submitted the form */
const buildUserEmail = ({ name }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thanks for reaching out – MS Billings</title>
</head>
<body style="margin:0;padding:0;background:#f4f0eb;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0eb;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#b87333 0%,#c8963e 100%);padding:36px 40px;text-align:center;">
            <span style="font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MS Billings<span style="color:#fde8b0;">.</span></span>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.85);letter-spacing:0.12em;text-transform:uppercase;">Restaurant Management Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 28px;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">🎉</div>
            <h2 style="margin:0 0 10px;font-size:22px;color:#2c1f0e;font-weight:800;">Thank you, ${name}!</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#6b5c4e;line-height:1.7;max-width:440px;margin-left:auto;margin-right:auto;">
              We received your message and our team will get back to you within <strong>24 hours</strong>. 
              We're excited to help power your restaurant with MS Billings!
            </p>

            <div style="background:#fdf8f3;border-radius:10px;padding:20px 28px;border:1px solid #f0e8de;margin-bottom:28px;">
              <p style="margin:0;font-size:13px;color:#9b8878;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">What to expect</p>
              <ul style="margin:12px 0 0;padding-left:20px;text-align:left;font-size:14px;color:#4a3728;line-height:2;">
                <li>A personal response from our sales team</li>
                <li>A demo walkthrough of the POS system</li>
                <li>Tailored pricing for your restaurant</li>
              </ul>
            </div>

            <a href="https://restaurant-billing-seven.vercel.app"
               style="display:inline-block;background:linear-gradient(135deg,#b87333,#c8963e);color:#fff;font-weight:700;font-size:14px;padding:13px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.04em;">
              Explore MS Billings →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fdf8f3;padding:18px 40px;border-top:1px solid #f0e8de;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9b8878;">You're receiving this because you contacted us at msbillings.com</p>
            <p style="margin:4px 0 0;font-size:12px;color:#b87333;font-weight:600;">© 2025 MS Tech Hive · msbillling@gmail.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
`;

// ── Controller ──────────────────────────────────────────────────────────────

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, restaurantName, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required fields.' });
    }

    // 1. Save to database
    const newContact = new Contact({ name, email, restaurantName, phone, message });
    await newContact.save();

    // 2. Send notification email to MS Billings team
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"MS Billings Contact" <${MAIL_USER}>`,
      to: MAIL_USER,
      replyTo: email,
      subject: `📩 New Inquiry from ${name}${restaurantName ? ` — ${restaurantName}` : ''}`,
      html: buildAdminEmail({ name, email, restaurantName, phone, message }),
    });

    // 3. Send acknowledgement email to the user
    await transporter.sendMail({
      from: `"MS Billings" <${MAIL_USER}>`,
      to: email,
      subject: `Thanks for reaching out, ${name}! — MS Billings`,
      html: buildUserEmail({ name }),
    });

    res.status(201).json({ message: 'Message sent successfully! Check your email for confirmation.' });
  } catch (error) {
    console.error('Contact form error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack?.split('\n')[0]);
    res.status(500).json({ message: 'Server error while sending your message.', detail: error.message });
  }
};
