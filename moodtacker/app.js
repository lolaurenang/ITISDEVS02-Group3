require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const methodOverride = require('method-override');
const path         = require('path');

const moodRoutes   = require('./routes/moodRoutes');
const { startDailyReminder, triggerReminderNow } = require('./utils/mailer');

const app      = express();
const PORT     = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/moodtracker';

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    startDailyReminder(); // start email scheduler after DB is ready
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/moods', moodRoutes);

// ─── Test Email Route (visit /test-email in browser to trigger manually) ──────
app.get('/test-email', async (req, res) => {
  const result = await triggerReminderNow();
  res.json(result);
});

app.get('/', (req, res) => res.redirect('/moods'));

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📧 Test email: http://localhost:${PORT}/test-email`);
});
