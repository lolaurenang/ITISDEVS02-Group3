// controllers/moodController.js
// ─── CONTROLLER (C in MVC) ────────────────────────────────────────────────────
// Handles all business logic: CRUD operations, report generation, and
// management decision support (escalation detection, trend analysis).

const Mood = require('../models/Mood');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Determine alert level based on intensity for Support Escalation decision
function getAlertLevel(intensity) {
  if (intensity >= 8) return { level: 'critical', label: 'Immediate Attention Required', color: '#ef4444' };
  if (intensity >= 6) return { level: 'warning', label: 'Monitor Closely', color: '#f59e0b' };
  return { level: 'normal', label: 'Within Normal Range', color: '#10b981' };
}

// Group mood entries by emotion for report generation
function groupByEmotion(moods) {
  return moods.reduce((acc, m) => {
    acc[m.emotion] = acc[m.emotion] || { count: 0, totalIntensity: 0, entries: [] };
    acc[m.emotion].count++;
    acc[m.emotion].totalIntensity += m.intensity;
    acc[m.emotion].entries.push(m);
    return acc;
  }, {});
}

// ── INDEX — List all mood entries ─────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const { childName, emotion, recordedBy } = req.query;
    const filter = {};
    if (childName)  filter.childName  = new RegExp(childName, 'i');
    if (emotion)    filter.emotion    = new RegExp(emotion, 'i');
    if (recordedBy) filter.recordedBy = recordedBy;

    const moods = await Mood.find(filter).sort({ occurredAt: -1 });
    res.render('moods/index', { moods, query: req.query });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── NEW — Show form to log a new mood ─────────────────────────────────────────
exports.newForm = (req, res) => {
  res.render('moods/new', { error: null });
};

// ── CREATE — Save a new mood entry ────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { childName, emotion, intensity, triggerDescription, recordedBy, occurredAt } = req.body;
    const mood = new Mood({
      childName,
      emotion,
      intensity: Number(intensity),
      triggerDescription,
      recordedBy,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date()
    });
    await mood.save();
    res.redirect('/moods');
  } catch (err) {
    res.status(400).render('moods/new', { error: err.message });
  }
};

// ── SHOW — View a single mood entry ──────────────────────────────────────────
exports.show = async (req, res) => {
  try {
    const mood = await Mood.findById(req.params.id);
    if (!mood) return res.status(404).render('error', { message: 'Entry not found' });
    const alert = getAlertLevel(mood.intensity);
    res.render('moods/show', { mood, alert });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── EDIT — Show edit form ─────────────────────────────────────────────────────
exports.editForm = async (req, res) => {
  try {
    const mood = await Mood.findById(req.params.id);
    if (!mood) return res.status(404).render('error', { message: 'Entry not found' });
    res.render('moods/edit', { mood, error: null });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── UPDATE — Save edits ───────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { childName, emotion, intensity, triggerDescription, recordedBy, occurredAt } = req.body;
    await Mood.findByIdAndUpdate(req.params.id, {
      childName,
      emotion,
      intensity: Number(intensity),
      triggerDescription,
      recordedBy,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined
    }, { new: true, runValidators: true });
    res.redirect(`/moods/${req.params.id}`);
  } catch (err) {
    const mood = await Mood.findById(req.params.id);
    res.status(400).render('moods/edit', { mood, error: err.message });
  }
};

// ── DELETE — Remove an entry ──────────────────────────────────────────────────
exports.delete = async (req, res) => {
  try {
    await Mood.findByIdAndDelete(req.params.id);
    res.redirect('/moods');
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── REPORT — Management Decision Support ─────────────────────────────────────
// Supports two key decisions from the proposal:
//   1. Report Generation  → trend analysis per child/emotion
//   2. Support Escalation → flags high-intensity recurring distress
exports.report = async (req, res) => {
  try {
    const moods = await Mood.find().sort({ occurredAt: -1 });

    // ── Decision 1: Report Generation ────────────────────────────────────────
    const byEmotion = groupByEmotion(moods);
    const emotionStats = Object.entries(byEmotion).map(([emotion, data]) => ({
      emotion,
      count: data.count,
      avgIntensity: (data.totalIntensity / data.count).toFixed(1)
    })).sort((a, b) => b.count - a.count);

    // ── Decision 2: Support Escalation ───────────────────────────────────────
    // Flag children with 2+ high-intensity (≥7) entries in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentHighIntensity = moods.filter(
      m => m.intensity >= 7 && new Date(m.occurredAt) >= sevenDaysAgo
    );
    const escalationMap = recentHighIntensity.reduce((acc, m) => {
      acc[m.childName] = (acc[m.childName] || 0) + 1;
      return acc;
    }, {});
    const escalationAlerts = Object.entries(escalationMap)
      .filter(([, count]) => count >= 2)
      .map(([childName, count]) => ({ childName, count }));

    // ── Chart data (passed to frontend JS) ───────────────────────────────────
    const chartData = {
      labels: emotionStats.map(e => e.emotion),
      counts: emotionStats.map(e => e.count),
      avgIntensities: emotionStats.map(e => parseFloat(e.avgIntensity))
    };

    res.render('moods/report', {
      totalEntries: moods.length,
      emotionStats,
      escalationAlerts,
      chartData: JSON.stringify(chartData),
      recentHighIntensity
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};
