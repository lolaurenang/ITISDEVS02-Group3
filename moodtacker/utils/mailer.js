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

// ── Send Report Email to Parent ────────────────────────────────────────────────
/**
 * Sends a comprehensive mood report to parent email
 * @param {Object} reportData - Data from the report controller
 *   - emotionStats: array of {emotion, count, avgIntensity}
 *   - escalationAlerts: array of {childName, count}
 *   - recentHighIntensity: array of high-intensity mood entries (last 7 days)
 *   - totalEntries: total number of mood entries
 */
async function sendReportEmail(reportData) {
  const parentEmail = process.env.PARENT_EMAIL;
  if (!parentEmail) {
    console.warn('⚠️  PARENT_EMAIL not set in .env — skipping report email.');
    return { sent: false, error: 'PARENT_EMAIL not configured' };
  }

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const { emotionStats, escalationAlerts, totalEntries, recentHighIntensity } = reportData;

  // Build escalation alerts HTML
  let alertsHTML = '';
  if (escalationAlerts && escalationAlerts.length > 0) {
    alertsHTML = `
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:16px;margin:16px 0;border-radius:4px;">
        <h3 style="color:#dc2626;margin:0 0 8px 0;font-size:1.1rem;">🚨 Support Escalation Alerts</h3>
        <p style="margin:0 0 12px 0;color:#7f1d1d;">Children requiring immediate caregiver attention:</p>
        ${escalationAlerts.map(alert => `
          <div style="background:#fff;padding:8px;margin:4px 0;border-radius:4px;border-left:3px solid #dc2626;">
            <strong>${alert.childName}</strong>: ${alert.count} high-intensity episodes (past 7 days)
          </div>
        `).join('')}
      </div>
    `;
  } else {
    alertsHTML = `
      <div style="background:#ecfdf5;border-left:4px solid #059669;padding:16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;color:#047857;"><strong>✅ No escalation alerts this week.</strong></p>
      </div>
    `;
  }

  // Build emotion stats table
  const emotionTableHTML = emotionStats
    .map(stat => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px;text-align:left;">${stat.emotion}</td>
        <td style="padding:10px;text-align:center;"><strong>${stat.count}</strong></td>
        <td style="padding:10px;text-align:center;">${stat.avgIntensity}/10</td>
      </tr>
    `)
    .join('');

  // Build high-intensity entries list
  const highIntensityList = recentHighIntensity && recentHighIntensity.length > 0
    ? recentHighIntensity.slice(0, 5).map(entry => `
        <div style="background:#f9fafb;padding:8px;margin:4px 0;border-radius:4px;border-left:3px solid #f59e0b;">
          <strong>${entry.childName}</strong> — ${entry.emotion} (intensity: ${entry.intensity}/10)<br/>
          <small style="color:#6b7280;">${new Date(entry.occurredAt).toLocaleDateString('en-PH')}</small>
        </div>
      `).join('')
    : '<p style="color:#9ca3af;">No high-intensity entries this week.</p>';

  const mailOptions = {
    from: `"MoodTrack App" <${process.env.GMAIL_USER}>`,
    to: parentEmail,
    subject: `📊 MoodTrack Weekly Report - ${today}`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:32px 16px;background:#f9fafb;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);padding:24px;border-radius:12px;color:#fff;margin-bottom:24px;">
          <h1 style="margin:0 0 8px 0;font-size:1.8rem;">📊 MoodTrack Weekly Report</h1>
          <p style="margin:0;opacity:0.9;font-size:0.95rem;">${today}</p>
        </div>

        <!-- Escalation Alerts -->
        ${alertsHTML}

        <!-- Summary Stats -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0;">
          <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px;border-radius:4px;">
            <div style="color:#15803d;font-size:1.8rem;font-weight:bold;">${totalEntries}</div>
            <div style="color:#6b7280;font-size:0.9rem;">Total Entries Logged</div>
          </div>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:4px;">
            <div style="color:#b45309;font-size:1.8rem;font-weight:bold;">${recentHighIntensity ? recentHighIntensity.length : 0}</div>
            <div style="color:#6b7280;font-size:0.9rem;">High-Intensity (7 Days)</div>
          </div>
        </div>

        <!-- Emotion Statistics -->
        <section style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
          <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:1.2rem;">📈 Emotion Statistics</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;border-bottom:2px solid #d1d5db;">
                <th style="padding:10px;text-align:left;color:#374151;">Emotion</th>
                <th style="padding:10px;text-align:center;color:#374151;">Count</th>
                <th style="padding:10px;text-align:center;color:#374151;">Avg Intensity</th>
              </tr>
            </thead>
            <tbody>
              ${emotionTableHTML}
            </tbody>
          </table>
        </section>

        <!-- High-Intensity Entries -->
        <section style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
          <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:1.2rem;">⚠️ Recent High-Intensity Entries (7 Days)</h2>
          <div>
            ${highIntensityList}
          </div>
        </section>

        <!-- Call to Action -->
        <div style="background:#ede9fe;border-left:4px solid #7c3aed;padding:16px;border-radius:8px;margin:24px 0;">
          <p style="margin:0;color:#5b21b6;">
            <strong>💡 Tip:</strong> Log into the app to view detailed heatmaps, trends, and additional insights.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:0.85rem;">
          <p style="margin:0 0 8px 0;">This is an automated report from MoodTrack</p>
          <p style="margin:0;">Questions? Check the app dashboard or contact support.</p>
        </div>

      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Report email sent to ${parentEmail}`);
    return { sent: true, message: 'Report sent successfully' };
  } catch (err) {
    console.error('❌ Failed to send report email:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { startDailyReminder, triggerReminderNow, sendReportEmail };
