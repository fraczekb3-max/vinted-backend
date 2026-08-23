const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const GEMINI_API_KEY = 'AQ.Ab8RN6LPZvZpFue7nwSHHX5HlJxMfdPpx9mm-zBc1ZHwqeovkQ';
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

// ==========================================
// GENEROWANIE OPISÓW PRZEZ GEMINI AI
// ==========================================
app.post('/api/generate', async (req, res) => {
  const { platform, images, promptCorrection } = req.body;

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.6-flash' });
    let response;

    if (promptCorrection) {
      // Obsługa poprawek z mini-czatu
      const prompt = `Jesteś profesjonalnym copywriterem. ${promptCorrection}\n\nZwróć wynik WYNIKOWO w formacie JSON zawierającym dwa pola: "title" (krótki, chwytliwy tytuł ogłoszenia) oraz "description" (pełny opis). Nie dodawaj żadnego dodatkowego tekstu poza czystym obiektem JSON.`;
      response = await model.generateContent(prompt);
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć.' });
      }

      const imageParts = images.map(img => ({
        inlineData: { data: img.base64, mimeType: img.mimeType }
      }));

      const prompt = `Przeanalizuj te zdjęcia i przygotuj profesjonalny tytuł oraz opis przedmiotu na platformę ${platform ? platform.toUpperCase() : 'VINTED'}. 
      Zwróć wynik WYNIKOWO w formacie JSON zawierającym pola "title" (krótki, chwytliwy tytuł) oraz "description" (pełny opis z hashtagami). Nie dodawaj żadnego dodatkowego tekstu poza czystym obiektem JSON.`;

      response = await model.generateContent([prompt, ...imageParts]);
    }

    let rawText = response.response.text().trim();
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedJson = JSON.parse(rawText);
    res.json(parsedJson);
  } catch (err) {
    console.error('Szczegóły błędu AI:', err);
    res.status(500).json({ error: 'Błąd AI podczas generowania: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
