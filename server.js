const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const GEMINI_API_KEY = 'AQ.Ab8RN6LPZvZpFue7nwSHHX5HlJxMfdPpx9mm-zBc1ZHwqeovkQ';
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

app.post('/api/generate', async (req, res) => {
  const { platform, images, promptCorrection } = req.body;

  try {
    // Używamy stabilnego modelu gemini-1.5-flash ze starszą, pewną wersją SDK
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let response;

    const targetPlatform = platform ? platform.toUpperCase() : 'VINTED';

    if (promptCorrection) {
      const prompt = `Jesteś profesjonalnym copywriterem i ekspertem ds. wyceny e-commerce. Platforma: ${targetPlatform}. ${promptCorrection} Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu json). Obiekt musi zawierać dokładnie cztery pola: "title", "description", "suggestedPrice", "quickSalePrice".`;

      response = await model.generateContent(prompt);
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć przedmiotu.' });
      }

      const imageParts = images.map(img => ({
        inlineData: { data: img.base64, mimeType: img.mimeType }
      }));

      const prompt = `Przeanalizuj załączone zdjęcia przedmiotu dla platformy ${targetPlatform}. Oceń jego stan i rynkową wartość. Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu json), zawierający dokładnie cztery pola: 
      - "title": krótki, atrakcyjny tytuł ogłoszenia
      - "description": profesjonalny opis ze stanem przedmiotu i hashtagami
      - "suggestedPrice": normalna, rynkowa cena (np. "60 PLN")
      - "quickSalePrice": niższa cena do szybkiej sprzedaży (np. "45 PLN")`;

      response = await model.generateContent([prompt, ...imageParts]);
    }

    if (!response || !response.response) {
      throw new Error('Brak odpowiedzi od modelu AI.');
    }

    let rawText = response.response.text().trim();
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const jsonStartIndex = rawText.indexOf('{');
    const jsonEndIndex = rawText.lastIndexOf('}');
    
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      rawText = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    const parsedJson = JSON.parse(rawText);
    res.json(parsedJson);

  } catch (err) {
    console.error('Błąd silnika AI:', err);
    res.status(500).json({ error: 'Błąd serwera AI: ' + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
