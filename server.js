const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const GEMINI_API_KEY = 'AQ.Ab8RN6LPZvZpFue7nwSHHX5HlJxMfdPpx9mm-zBc1ZHwqeovkQ';

app.post('/api/generate', async (req, res) => {
  const { platform, images, promptCorrection } = req.body;

  try {
    const targetPlatform = platform ? platform.toUpperCase() : 'VINTED';
    let contents = [];

    if (promptCorrection) {
      const promptText = `Jesteś niezwykle precyzyjnym ekspertem ds. wyceny e-commerce i copywritingu. Platforma: ${targetPlatform}. ${promptCorrection} Zwróć szczególną uwagę na rzetelność cenową – unikaj błędów w wycenach i dokładnie opisz przedmiot. Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu json). Obiekt musi zawierać dokładnie cztery pola: "title", "description", "suggestedPrice", "quickSalePrice".`;
      contents = [{ parts: [{ text: promptText }] }];
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć przedmiotu.' });
      }

      const promptText = `Przeanalizuj niezwykle dokładnie załączone zdjęcia przedmiotu dla platformy ${targetPlatform}. Masz obowiązek solidnie zweryfikować rynkową wartość przedmiotu, aby wyeliminować jakiekolwiek błędy cenowe. Sprawdź jego stan, markę, model i realną wartość w internecie. Opisz go w pełni profesjonalnie. 
      Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu json), zawierający dokładnie cztery pola: 
      - "title": krótki, chwytliwy tytuł ogłoszenia
      - "description": dokładny, rzetelny opis ze stanem przedmiotu i hashtagami
      - "suggestedPrice": sprawdzona, uczciwa cena rynkowa (np. "60 PLN")
      - "quickSalePrice": cena gwarantująca błyskawiczną sprzedaż (np. "45 PLN")`;

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

    // Sprawdzony, klasyczny model
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok || data.error) {
      throw new Error(data.error ? data.error.message : 'Błąd API Google');
    }

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
