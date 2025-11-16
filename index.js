// index.js - basic scaffold for TrueManga backend (Railway)
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Optional firebase-admin init if SERVICE_ACCOUNT provided
let admin = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase admin initialized');
    }
  } catch (e) {
    console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
  }
}

// simple signing helper for proxy URLs
const SIGNING_SECRET = process.env.SIGNING_SECRET || 'changeme';
function signUrl(url) {
  return crypto.createHmac('sha256', SIGNING_SECRET).update(url).digest('hex');
}
function verifySig(url, sig) {
  try {
    const expected = signUrl(url);
    return expected === sig;
  } catch (e) {
    return false;
  }
}

// --- Health
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'TrueManga backend scaffold' });
});

// --- Proxy file endpoint (secure via signature)
// Usage: /proxy/file?url=<encodedURL>&sig=<signature>
app.get('/proxy/file', async (req, res) => {
  const { url, sig } = req.query;
  if (!url || !sig) return res.status(400).send('missing url or sig');

  if (!verifySig(url, sig)) return res.status(403).send('invalid signature');

  try {
    const r = await axios.get(url, { responseType: 'stream', timeout: 15000 });
    res.setHeader('Cache-Control', 'public, max-age=86400');
    r.data.pipe(res);
  } catch (err) {
    console.error('proxy error', err.message || err);
    res.status(502).send('failed to fetch');
  }
});

// --- Views endpoint (basic)
// Body: { user_id, item_type, item_id }
app.post('/views', async (req, res) => {
  const { user_id, item_type, item_id } = req.body;
  if (!user_id || !item_type || !item_id) return res.status(400).json({ error: 'missing params' });

  // NOTE: real implementation must check last view timestamp per user+item and award coins etc.
  // Here we simply acknowledge the view and (for scaffolding) return no coins.
  // If firebase-admin is available you can implement transactional increments there.
  res.json({ view_recorded: true, coins_awarded: 0 });
});

// --- Purchase endpoint (scaffold)
// Body: { buyer_id, chapter_id, price_cents, creator_id }
// IMPORTANT: This is a scaffold. Full atomic transaction requires Firestore / server logic.
app.post('/purchase', async (req, res) => {
  const { buyer_id, chapter_id, price_cents, creator_id } = req.body;
  if (!buyer_id || !chapter_id || !price_cents || !creator_id) {
    return res.status(400).json({ error: 'missing params' });
  }

  if (!admin) {
    return res.status(501).json({ error: 'Firebase not configured on server. Set FIREBASE_SERVICE_ACCOUNT_JSON to enable real purchases.' });
  }

  // Example firebase transaction pseudo-code (uncomment & implement when ready):
  // const db = admin.firestore();
  // await db.runTransaction(async tx => {
  //   const buyerRef = db.doc(`users/${buyer_id}`);
  //   const creatorRef = db.doc(`users/${creator_id}`);
  //   const buyerSnap = await tx.get(buyerRef);
  //   const buyerBal = buyerSnap.data().coin_balance;
  //   if (buyerBal < price_cents) throw new Error('INSUFFICIENT');
  //   const creatorAmount = Math.floor(price_cents * 0.75);
  //   tx.update(buyerRef, { coin_balance: buyerBal - price_cents });
  //   tx.update(creatorRef, { coin_balance: admin.firestore.FieldValue.increment(creatorAmount) });
  //   // write transactions docs...
  // });

  res.json({ success: false, message: 'Purchase endpoint scaffold. Connect Firebase and implement transaction logic.' });
});

const PORT = process.env.PORT || process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TrueManga backend scaffold running on port ${PORT}`);
  console.log(`PROXY SIGNING_SECRET present: ${!!process.env.SIGNING_SECRET}`);
});
