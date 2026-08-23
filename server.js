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
  const { platform, price, images, promptCorrection } = req.body;

  try {
    // Używamy sprawdzonego i wydajnego modelu flash
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let response;

    const targetPlatform = platform ? platform.toUpperCase() : 'VINTED';
    const priceInstruction = price && price.trim() !== '' 
      ? `Użyj dokładnie podanej ceny: ${price}.` 
      : `Przeanalizuj przedmiot i oszacuj jego realną, rynkową cenę w PLN (np. '45 PLN').`;

    if (promptCorrection) {
      const prompt = `Jesteś profesjonalnym copywriterem e-commerce. 
      Platforma docelowa: ${targetPlatform}.
      ${promptCorrection}
      
      Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON, bez żadnych znaczników markdown (nie używaj ```json ani ```). Obiekt musi zawierać dokładnie trzy pola:
      1. "title" (krótki, chwytliwy tytuł ogłoszenia)
      2. "description" (pełny opis z hashtagami)
      3. "suggestedPrice" (oszacowana lub potwierdzona cena, np. "50 PLN")`;

      response = await model.generateContent(prompt);
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć przedmiotu.' });
      }

      const imageParts = images.map(img => ({
        inlineData: { data: img.base64, mimeType: img.mimeType }
      }));

      const prompt = `Przeanalizuj załączone zdjęcia przedmiotu i przygotuj profesjonalne ogłoszenie na platformę ${targetPlatform}.
      Zasada dotycząca ceny: ${priceInstruction}
      
      Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON, bez żadnych znaczników markdown (nie używaj ```json ani ```). Obiekt musi zawierać dokładnie trzy pola:
      - "title": krótki, atrakcyjny tytuł
      - "description": profesjonalny opis ze stanem przedmiotu i hashtagami
      - "suggestedPrice": sugerowana lub podana cena (np. "60 PLN")`;

      response = await model.generateContent([prompt, ...imageParts]);
    }

    if (!response || !response.response) {
      throw new Error('Brak odpowiedzi od modelu AI.');
    }

    let rawText = response.response.text().trim();
    
    // Agresywne czyszczenie wszystkiego, co mogłoby popsuć JSON-a
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer API uruchomiony na porcie ${PORT}`));
