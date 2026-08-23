const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const SUPABASE_URL = 'https://wcmmkplijtkvdtrqozwh.supabase.co';
const SUPABASE_KEY = 'sb_secret_NbCNf-sfKuIC-SFlmvmpUg_uaFFIHrh'; 
const GEMINI_API_KEY = 'AQ.Ab8RN6LPZvZpFue7nwSHHX5HlJxMfdPpx9mm-zBc1ZHwqeovkQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

function generateCode(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${prefix}-${rand}`;
}

// ==========================================
// 1. OBSŁUGA LOGOWANIA (ADMIN + ZWYKŁY KOD)
// ==========================================
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;

  // Sprawdzanie czy to kod administratora
  if (code === 'ADMIN') {
    return res.json({ valid: true, type: 'admin' });
  }

  // Sprawdzanie zwykłego kodu w bazie Supabase
  const { data, error } = await supabase
    .from('access_codes')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .single();

  if (error || !data) {
    return res.status(400).json({ valid: false, message: 'Nieprawidłowy kod.' });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return res.status(403).json({ valid: false, message: 'Dostęp wygasł.' });
  }

  res.json({ valid: true, type: data.type });
});

// ==========================================
// 2. GENEROWANIE KODÓW Z PANELU ADMINA
// ==========================================
app.post('/api/admin/generate-code', async (req, res) => {
  const { adminKey, duration } = req.body;

  if (adminKey !== 'ADMIN') {
    return res.status(403).json({ error: 'Brak uprawnień.' });
  }

  try {
    const randomCode = 'VINTED-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Opcjonalnie zapis do bazy (jeśli chcesz, żeby generowane kody trafiały do bazy):
    // await supabase.from('access_codes').insert([{ code: randomCode, type: 'monthly' }]);

    res.json({ code: randomCode });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera podczas generowania kodu.' });
  }
});

// ==========================================
// 3. OBSŁUGA PŁATNOŚCI SIMPAY (IPN)
// ==========================================
app.post('/api/simpay-ipn', async (req, res) => {
  const { status, amount } = req.body;

  if (status === 'ORDER_PAYED' || status === 'completed') {
    const isLifetime = parseFloat(amount) >= 10;
    const prefix = isLifetime ? 'LIFE' : '30D';
    const newCode = generateCode(prefix);

    let expiresAt = null;
    if (!isLifetime) {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      expiresAt = date.toISOString();
    }

    await supabase.from('access_codes').insert([
      { code: newCode, type: isLifetime ? 'lifetime' : 'monthly', expires_at: expiresAt }
    ]);
  }

  res.send('OK');
});

// ==========================================
// 4. GENEROWANIE OPISÓW PRZEZ GEMINI AI
// ==========================================
app.post('/api/generate', async (req, res) => {
  const { code, platform, images } = req.body;

  const { data } = await supabase.from('access_codes').select('*').eq('code', code).single();
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) {
    return res.status(401).json({ error: 'Brak aktywnego dostępu.' });
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const imageParts = images.map(img => ({
      inlineData: { data: img.base64, mimeType: img.mimeType }
    }));

    const response = await model.generateContent([
      `Przeanalizuj te zdjęcia dla platformy: ${platform.toUpperCase()}`,
      ...imageParts
    ]);

    let rawText = response.response.text().trim();
    if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    if (rawText.startsWith('```')) rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();

    res.json(JSON.parse(rawText));
  } catch (err) {
    res.status(500).json({ error: 'Błąd AI.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
