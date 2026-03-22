// controllers/moodController.js
// ─── CONTROLLER (C in MVC) ────────────────────────────────────────────────────

const Mood = require('../models/Mood');
const NEGATIVE_EMOTIONS = ['Sadness', 'Anger', 'Fear', 'Disgust'];

function getAlertLevel(intensity, emotion) {
  if (!NEGATIVE_EMOTIONS.includes(emotion)) return { level:'normal', label:'Within Normal Range', color:'#10b981' };
  if (intensity >= 8) return { level:'critical', label:'Immediate Attention Required', color:'#ef4444' };
  if (intensity >= 6) return { level:'warning',  label:'Monitor Closely',              color:'#f59e0b' };
  return                      { level:'normal',   label:'Within Normal Range',          color:'#10b981' };
}

function groupByEmotion(moods) {
  return moods.reduce((acc, m) => {
    acc[m.emotion] = acc[m.emotion] || { count:0, totalIntensity:0 };
    acc[m.emotion].count++;
    acc[m.emotion].totalIntensity += m.intensity;
    return acc;
  }, {});
}

// ── Build heatmap data: last 7 days × emotion ─────────────────────────────────
function buildHeatmap(moods) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    days.push(d);
  }

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const heatmap = {};

  days.forEach(day => {
    const label = DAY_LABELS[day.getDay()];
    heatmap[label] = {};
  });

  const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate()-6); sevenAgo.setHours(0,0,0,0);

  moods.filter(m => new Date(m.occurredAt) >= sevenAgo).forEach(m => {
    const d     = new Date(m.occurredAt);
    const label = DAY_LABELS[d.getDay()];
    if (!heatmap[label]) heatmap[label] = {};
    heatmap[label][m.emotion] = (heatmap[label][m.emotion] || 0) + 1;
  });

  return heatmap;
}

// ── INDEX ─────────────────────────────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const { childName, emotion, recordedBy } = req.query;
    const filter = {};
    if (childName)  filter.childName  = new RegExp(childName, 'i');
    if (emotion)    filter.emotion    = new RegExp(emotion, 'i');
    if (recordedBy) filter.recordedBy = recordedBy;
    const moods = await Mood.find(filter).sort({ occurredAt:-1 });
    res.render('moods/index', { moods, query: req.query });
  } catch(err) { res.status(500).render('error',{ message:err.message }); }
};

exports.newForm = (req, res) => res.render('moods/new', { error:null });

// ── CREATE ────────────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { childName, emotion, intensity, triggerDescription, recordedBy, occurredAt } = req.body;
    await new Mood({
      childName, emotion,
      intensity: Number(intensity),
      triggerDescription, recordedBy,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date()
    }).save();
    res.redirect('/moods');
  } catch(err) { res.status(400).render('moods/new',{ error:err.message }); }
};

// ── SHOW ──────────────────────────────────────────────────────────────────────
exports.show = async (req, res) => {
  try {
    const mood = await Mood.findById(req.params.id);
    if (!mood) return res.status(404).render('error',{ message:'Entry not found' });
    res.render('moods/show',{ mood, alert: getAlertLevel(mood.intensity, mood.emotion) });
  } catch(err) { res.status(500).render('error',{ message:err.message }); }
};

// ── EDIT ──────────────────────────────────────────────────────────────────────
exports.editForm = async (req, res) => {
  try {
    const mood = await Mood.findById(req.params.id);
    if (!mood) return res.status(404).render('error',{ message:'Entry not found' });
    res.render('moods/edit',{ mood, error:null });
  } catch(err) { res.status(500).render('error',{ message:err.message }); }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { childName, emotion, intensity, triggerDescription, recordedBy, occurredAt } = req.body;
    await Mood.findByIdAndUpdate(req.params.id,{
      childName, emotion, intensity:Number(intensity),
      triggerDescription, recordedBy,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined
    },{ new:true, runValidators:true });
    res.redirect(`/moods/${req.params.id}`);
  } catch(err) {
    const mood = await Mood.findById(req.params.id);
    res.status(400).render('moods/edit',{ mood, error:err.message });
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
exports.delete = async (req, res) => {
  try {
    await Mood.findByIdAndDelete(req.params.id);
    res.redirect('/moods');
  } catch(err) { res.status(500).render('error',{ message:err.message }); }
};

// ── REPORT ────────────────────────────────────────────────────────────────────
exports.report = async (req, res) => {
  try {
    const moods = await Mood.find().sort({ occurredAt:-1 });

    // Decision 1: Emotion stats for charts
    const byEmotion = groupByEmotion(moods);
    const emotionStats = Object.entries(byEmotion).map(([emotion, data]) => ({
      emotion,
      count: data.count,
      avgIntensity: (data.totalIntensity / data.count).toFixed(1)
    })).sort((a,b) => b.count - a.count);

    // Decision 2: Escalation
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
    const recentHighIntensity = moods.filter(
      m => m.intensity >= 7 && new Date(m.occurredAt) >= sevenDaysAgo 
      && NEGATIVE_EMOTIONS.includes(m.emotion)
    );
    const escMap = recentHighIntensity.reduce((acc,m) => {
      acc[m.childName] = (acc[m.childName]||0)+1; return acc;
    },{});
    const escalationAlerts = Object.entries(escMap)
      .filter(([,c]) => c>=2)
      .map(([childName,count]) => ({ childName, count }));

    // Chart data
    const chartData = {
      labels:        emotionStats.map(e => e.emotion),
      counts:        emotionStats.map(e => e.count),
      avgIntensities:emotionStats.map(e => parseFloat(e.avgIntensity))
    };

    // Heatmap data
    const heatmapData = buildHeatmap(moods);

    res.render('moods/report',{
      totalEntries: moods.length,
      emotionStats,
      escalationAlerts,
      recentHighIntensity,
      chartData:   JSON.stringify(chartData),
      heatmapData: JSON.stringify(heatmapData)
    });
  } catch(err) { res.status(500).render('error',{ message:err.message }); }
};
