const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Brak kodu autoryzacyjnego.');

    try {
        // 1. Pobieranie tokenu dostępu
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `https://${req.get('host')}/api/auth/callback`
        }));

        const accessToken = tokenRes.data.access_token;

        // 2. Pobieranie danych użytkownika
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${accessToken}` }
        });

        const user = userRes.data;

        // 3. Pobieranie członka z serwera przez bota
        const memberRes = await axios.get(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`, {
            headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });

        const hasRole = memberRes.data.roles.includes(process.env.DISCORD_ROLE_ID_TXT);

        if (!hasRole) {
            return res.redirect('/?status=no_role');
        }

        const avatarUrl = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';

        res.redirect(`/?status=success&user=${encodeURIComponent(user.username)}&avatar=${encodeURIComponent(avatarUrl)}`);

    } catch (err) {
        console.error('BŁĄD OAUTH2 / DISCORD:', err.response ? err.response.data : err.message);
        res.redirect('/?status=no_role');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
