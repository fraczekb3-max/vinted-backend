const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Endpoint logowania
app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Brak kodu');

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/callback`
        }));

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const memberRes = await axios.get(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userRes.data.id}`, {
            headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });

        const hasRole = memberRes.data.roles.includes(process.env.DISCORD_ROLE_ID_TXT);

        if (!hasRole) {
            return res.send('<h1>❌ Błąd</h1><p>Nie posiadasz permisji (brak rangi txt), aby dodawać paczki!</p>');
        }

        res.send(`<h1>✅ Zalogowano jako ${userRes.data.username}</h1><p>Masz rangę txt! Dostęp do dodawania paczek odblokowany.</p>`);
    } catch (err) {
        res.status(500).send('Błąd autoryzacji z Discordem.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
