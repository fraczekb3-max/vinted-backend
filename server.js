const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const GEMINI_API_KEY = 'AQ.Ab8RN6LPZvZpFue7nwSHHX5HlJxMfdPpx9mm-zBc1ZHwqeovkQ';

// Lista modeli do prób: najpierw główny, potem zapasowy (fallback)
const MODELS = ['gemini-3.5-flash', 'gemini-1.5-flash'];

// Pomocnicza funkcja opóźnienia
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry(contents) {
  let lastError = null;

  for (const model of MODELS) {
    // Dla każdego modelu wykonujemy do 3 prób z krótką przerwą
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok || data.error) {
          const errorMsg = data.error ? data.error.message : 'Błąd API Google';
          // Sprawdzamy czy to błąd przeciążenia (high demand / overloaded / 429)
          const isOverloaded = errorMsg.toLowerCase().includes('demand') || 
                               errorMsg.toLowerCase().includes('overloaded') || 
                               errorMsg.toLowerCase().includes('rate') ||
                               apiResponse.status === 429;

          if (isOverloaded && attempt < 3) {
            // Jeśli przeciążenie, czekamy chwilę (np. 1.5s, potem 3s) i ponawiamy próbę na tym samym modelu
            console.warn(`Model ${model} przeciążony (próba ${attempt}/3). Ponawianie za chwilę...`);
            await sleep(attempt * 1500);
            continue;
          } else {
            throw new Error(errorMsg);
          }
        }

        // Jeśli sukces, zwracamy dane
        return data;

      } catch (err) {
        lastError = err;
        // Jeśli błąd dotyczy sieci lub limitów, przerywamy pętle prób dla tego modelu i idziemy do zapasowego modelu
        if (attempt === 3) {
          console.warn(`Model ${model} wyczerpał próby. Przełączam na kolejny model...`);
        } else {
          await sleep(1000);
        }
      }
    }
  }

  throw lastError || new Error('Wszystkie modele AI są obecnie niedostępne.');
}

app.post('/api/generate', async (req, res) => {
  const { platform, images, promptCorrection } = req.body;

  try {
    const targetPlatform = platform ? platform.toUpperCase() : 'VINTED';
    let contents = [];

    if (promptCorrection) {
      const promptText = `Jesteś profesjonalnym copywriterem i ekspertem ds. wyceny e-commerce. Platforma: ${targetPlatform}. ${promptCorrection} Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu json). Obiekt musi zawierać dokładnie cztery pola: "title", "description", "suggestedPrice", "quickSalePrice".`;
      contents = [{ parts: [{ text: promptText }] }];
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć przedmiotu.' });
      }

      const promptText = `Przeanalizuj załączone zdjęcia przedmiotu dla platformy ${targetPlatform}. Oceń jego stan i rynkową wartość. Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu json), zawierający dokładnie cztery pola: 
      - "title": krótki, atrakcyjny tytuł ogłoszenia
      - "description": profesjonalny opis ze stanem przedmiotu i hashtagami
      - "suggestedPrice": normalna, rynkowa cena (np. "60 PLN")
      - "quickSalePrice": niższa cena do szybkiej sprzedaży (np. "45 PLN")`;

      const parts = [{ text: promptText }];
      
      images.forEach(img => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        });
      });

      contents = [{ parts: parts }];
    }

    // Wywołanie z automatycznym retry i zmianą modeli
    const data = await callGeminiWithRetry(contents);

    let rawText = data.candidates[0].content.parts[0].text.trim();
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
