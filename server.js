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
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let response;

    const targetPlatform = platform ? platform.toUpperCase() : 'VINTED';
    const userPriceInfo = price && price.trim() !== '' 
      ? `Użytkownik wpisał własną cenę: ${price} PLN. Oceń czy ta cena nie jest zawyżona lub zaniżona w stosunku do realnej wartości rynkowej ze zdjęć.` 
      : `Użytkownik nie podał ceny – musisz ją sam wycenić.`;

    if (promptCorrection) {
      const prompt = `Jesteś profesjonalnym copywriterem i ekspertem ds. wyceny e-commerce. 
      Platforma: ${targetPlatform}.
      ${promptCorrection}
      
      Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu ```json). Obiekt musi zawierać dokładnie cztery pola:
      1. "title" (tytuł ogłoszenia)
      2. "description" (opis z hashtagami)
      3. "suggestedPrice" (normalna, rynkowa cena, np. "50 PLN")
      4. "quickSalePrice" (niższa cena do szybkiej sprzedaży, np. "35 PLN")
      5. "priceFeedback" (krótki komentarz AI do ceny, np. informacja czy cena wpisana przez użytkownika jest OK, czy za wysoka i dlaczego)`;

      response = await model.generateContent(prompt);
    } else {
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'Nie wybrano żadnych zdjęć przedmiotu.' });
      }

      const imageParts = images.map(img => ({
        inlineData: { data: img.base64, mimeType: img.mimeType }
      }));

      const prompt = `Przeanalizuj załączone zdjęcia przedmiotu dla platformy ${targetPlatform}.${userPriceInfo}
      
      Zwróć wynik WYŁĄCZNIE jako czysty obiekt JSON (bez znaczników markdown typu ```json), zawierający dokładnie pięć pól:
      - "title": krótki, atrakcyjny tytuł
      - "description": profesjonalny opis ze stanem przedmiotu i hashtagami
      - "suggestedPrice": normalna, rynkowa cena (np. "60 PLN")
      - "quickSalePrice": cena do szybkiej sprzedaży (nieco niższa, żeby poszło od ręki, np. "45 PLN")
      - "priceFeedback": jeśli użytkownik podał cenę, oceń ją (np. "Twoja cena jest za wysoka jak na ten stan, rynkowo wart jest max 50 PLN"). Jeśli użytkownik nic nie podał, napisz np. "Oto optymalna wycena rynkowa."`;

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer API uruchomiony na porcie ${PORT}`));
