// routes/moodRoutes.js
// ─── ROUTES ───────────────────────────────────────────────────────────────────
// Maps HTTP verbs + URL paths to controller actions (RESTful convention).

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/moodController');

// Report (place before /:id routes to avoid conflict)
router.get('/report', ctrl.report);
router.post('/report/send', ctrl.sendReport);  // Send report to parent email

// CRUD
router.get('/',           ctrl.index);    // GET  /moods
router.get('/new',        ctrl.newForm);  // GET  /moods/new
router.post('/',          ctrl.create);   // POST /moods
router.get('/:id',        ctrl.show);     // GET  /moods/:id
router.get('/:id/edit',   ctrl.editForm); // GET  /moods/:id/edit
router.put('/:id',        ctrl.update);   // PUT  /moods/:id
router.delete('/:id',     ctrl.delete);   // DELETE /moods/:id

module.exports = router;
