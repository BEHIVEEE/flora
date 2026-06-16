import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { dashboard as dashConfig } from '../config/index.js';
import { ALL_QUEUES } from '../queues/index.js';
import { getStats } from './statsService.js';
import logger from '../logger/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Bull Board UI at /queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/queues');
createBullBoard({
  queues: ALL_QUEUES.map(q => new BullMQAdapter(q)),
  serverAdapter,
});
app.use('/queues', serverAdapter.getRouter());

// Stats API
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Brand aliases API
app.get('/api/aliases', async (req, res) => {
  const { query } = await import('../db/pool.js');
  const rows = await query('SELECT * FROM brand_aliases ORDER BY alias');
  res.json(rows);
});

app.post('/api/aliases', async (req, res) => {
  const { alias, brand } = req.body;
  if (!alias || !brand) return res.status(400).json({ error: 'alias and brand required' });
  const { query, batchInsert } = await import('../db/pool.js');
  const { invalidateAliasCache } = await import('../normalizer/index.js');
  await batchInsert('brand_aliases', ['alias', 'brand'], [[alias.toLowerCase(), brand.toLowerCase()]], {
    onDuplicateUpdate: ['brand'],
  });
  invalidateAliasCache();
  res.json({ ok: true });
});

app.delete('/api/aliases/:alias', async (req, res) => {
  const { query } = await import('../db/pool.js');
  const { invalidateAliasCache } = await import('../normalizer/index.js');
  await query('DELETE FROM brand_aliases WHERE alias=?', [req.params.alias]);
  invalidateAliasCache();
  res.json({ ok: true });
});

// Match audit endpoint
app.get('/api/matches', async (req, res) => {
  const { query } = await import('../db/pool.js');
  const { status, method, page = 1 } = req.query;
  const limit = 50;
  const offset = (Number(page) - 1) * limit;
  const wheres = [];
  const params = [];
  if (status) { wheres.push('status=?'); params.push(status); }
  if (method) { wheres.push('match_method=?'); params.push(method); }
  const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
  const rows = await query(`SELECT * FROM match_audit ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM match_audit ${where}`, params);
  res.json({ rows, total, page: Number(page) });
});

// Manual review accept/reject
app.post('/api/matches/:id/accept', async (req, res) => {
  const { query } = await import('../db/pool.js');
  await query(
    `UPDATE match_audit SET status='accepted', reviewer=?, reviewed_at=NOW() WHERE id=?`,
    [req.body.reviewer || 'admin', req.params.id]
  );
  res.json({ ok: true });
});

app.post('/api/matches/:id/decline', async (req, res) => {
  const { query } = await import('../db/pool.js');
  await query(
    `UPDATE match_audit SET status='declined', reviewer=?, reviewed_at=NOW() WHERE id=?`,
    [req.body.reviewer || 'admin', req.params.id]
  );
  res.json({ ok: true });
});

// Real-time stats push every 5 seconds
io.on('connection', socket => {
  logger.info('Dashboard client connected');
  const interval = setInterval(async () => {
    const stats = await getStats().catch(() => null);
    if (stats) socket.emit('stats', stats);
  }, 5000);
  socket.on('disconnect', () => clearInterval(interval));
});

httpServer.listen(dashConfig.port, () => {
  logger.info(`Dashboard running at http://localhost:${dashConfig.port}`);
  logger.info(`Bull Board at http://localhost:${dashConfig.port}/queues`);
});

export default app;
