const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const GEMINI_API_KEY = 'AQ.Ab8RN6LPZvZpFue7nwSHHX5HlJxMfdPpx9mm-zBc1ZHwqeovkQ';
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

app.post('/api/generate', async (req, res) => {
  const { platform, price, images, promptCorrection } = req.body;

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.6-flash' });
    let response;

    const targetPlatform = platform ? platform.toUpperCase() : 'VINTED';
    const priceInstruction = price && price.trim() !== '' 
      ? `Użyj dokładnie podanej ceny: ${price}.` 
      : `Przeanalizuj przedmiot i oszacuj jego realną, rynkową cenę w PLN (podaj np. '45 PLN' lub przedział '40-50 PLN').`;

    if (promptCorrection) {
      const prompt = `Jesteś genialnym i profesjonalnym copywriterem e-commerce. 
      Platforma docelowa: ${targetPlatform}.${promptCorrection}
      
      Zwróć wynik WYŁĄCZNIE w czystym formacie JSON (bez bloków markdown ```json ... ```, tylko surowy JSON) zawierający dokładnie trzy pola:
      1. "title" (krótki, chwytliwy, optymalizowany pod wyszukiwarki tytuł ogłoszenia)
      2. "description" (pełny, estetyczny opis z odpowiednimi hashtagami)
      3. "suggestedPrice" (oszacowana lub potwierdzona cena przedmiotu, np. "50 PLN")`;

      response = await model.generateContent(prompt);
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć przedmiotu.' });
      }

      const imageParts = images.map(img => ({
        inlineData: { data: img.base64, mimeType: img.mimeType }
      }));

      const prompt = `Przeanalizuj załączone zdjęcia przedmiotu. Przygotuj profesjonalne ogłoszenie na platformę ${targetPlatform}.
      Zasada dotycząca ceny: ${priceInstruction}
      
      Zwróć wynik WYŁĄCZNIE w czystym formacie JSON (bez znaczników markdown typu ```json, zacznij bezpośrednio od { i skończ na }), zawierający dokładnie trzy pola:
      - "title": krótki, atrakcyjny tytuł
      - "description": profesjonalny opis z cechami przedmiotu, stanem oraz dopasowanymi hashtagami
      - "suggestedPrice": sugerowana lub podana cena (np. "60 PLN")`;

      response = await model.generateContent([prompt, ...imageParts]);
    }

    let rawText = response.response.text().trim();
    // Bezpieczne czyszczenie ewentualnych znaczników formatowania kodu przez AI
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Wyciągnij czysty obiekt JSON w razie dodatkowych śmieci tekstowych
    const jsonStartIndex = rawText.indexOf('{');
    const jsonEndIndex = rawText.lastIndexOf('}');
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      rawText = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    const parsedJson = JSON.parse(rawText);
    res.json(parsedJson);

  } catch (err) {
    console.error('Błąd silnika AI:', err);
    res.status(500).json({ error: 'Wystąpił błąd podczas generowania treści: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer API uruchomiony na porcie ${PORT}`));

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
