// utils/mailer.js
// ─── EMAIL NOTIFICATION TOOL ──────────────────────────────────────────────────
// Sends a reminder email to the parent if no mood has been logged today.
// Uses Nodemailer with Gmail (App Password required — see .env.example).
//
// HOW IT WORKS:
//   A cron-like scheduler runs once per day at a set time (default: 8PM).
//   It checks MongoDB for any mood entry logged today.
//   If none found → sends a reminder email to the configured parent address.

const nodemailer = require('nodemailer');
const Mood       = require('../models/Mood');

// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // your Gmail address
    pass: process.env.GMAIL_PASS,   // Gmail App Password (NOT your real password)
  }
});

// ── Check if any mood was logged today ───────────────────────────────────────
async function wasMoodLoggedToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await Mood.countDocuments({
    occurredAt: { $gte: startOfDay, $lte: endOfDay }
  });
  return count > 0;
}

// ── Send the reminder email ───────────────────────────────────────────────────
async function sendReminderEmail() {
  const parentEmail = process.env.PARENT_EMAIL;
  if (!parentEmail) {
    console.warn('⚠️  PARENT_EMAIL not set in .env — skipping email.');
    return;
  }

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const mailOptions = {
    from: `"MoodTrack App" <${process.env.GMAIL_USER}>`,
    to: parentEmail,
    subject: `🌈 Reminder: No mood logged yet today (${today})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f0f4ff;border-radius:16px;">
        <h1 style="color:#6366f1;font-size:1.6rem;margin-bottom:8px;">MoodTrack Reminder 🌈</h1>
        <p style="color:#374151;font-size:1rem;line-height:1.6;">
          Hi! Just a friendly reminder — <strong>no mood has been logged today</strong> (${today}).
        </p>
        <p style="color:#374151;font-size:1rem;line-height:1.6;">
          Tracking your child's emotions daily helps identify patterns and supports better care decisions.
        </p>
        <a href="http://localhost:3000/moods/new"
           style="display:inline-block;margin-top:16px;padding:12px 28px;background:#6366f1;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:1rem;">
          Log a Mood Now →
        </a>
        <p style="margin-top:28px;color:#9ca3af;font-size:.85rem;">
          This is an automated reminder from MoodTrack. You can disable it in your .env settings.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Reminder email sent to ${parentEmail}`);
  } catch (err) {
    console.error('❌ Failed to send reminder email:', err.message);
  }
}

// ── Daily Scheduler ───────────────────────────────────────────────────────────
// Checks every minute if it's time to send (default: 20:00 / 8PM).
// Change REMINDER_HOUR in .env to any hour (0–23).
function startDailyReminder() {
  const TARGET_HOUR = parseInt(process.env.REMINDER_HOUR || '20');
  let lastSentDate  = null;

  console.log(`📅 Daily mood reminder scheduled for ${TARGET_HOUR}:00 every day.`);

  setInterval(async () => {
    const now   = new Date();
    const today = now.toDateString();

    // Only fire once per day at the target hour
    if (now.getHours() === TARGET_HOUR && lastSentDate !== today) {
      lastSentDate = today;
      const logged = await wasMoodLoggedToday();
      if (!logged) {
        console.log('📬 No mood logged today — sending reminder...');
        await sendReminderEmail();
      } else {
        console.log('✅ Mood already logged today — no reminder needed.');
      }
    }
  }, 60 * 1000); // check every 60 seconds
}

// ── Manual trigger (for testing via route) ────────────────────────────────────
async function triggerReminderNow() {
  const logged = await wasMoodLoggedToday();
  if (!logged) {
    await sendReminderEmail();
    return { sent: true, reason: 'No mood logged today' };
  }
  return { sent: false, reason: 'Mood already logged today' };
}

module.exports = { startDailyReminder, triggerReminderNow };
