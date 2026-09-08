const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    SlashCommandBuilder, 
    REST, 
    Routes 
} = require('discord.js');
const express = require('express');
const path = require('path');

const app = express();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// Pamięć na dodane paczki (widoczna na stronie)
const texturePacks = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint dostarczający listę paczek na stronę WWW
app.get('/api/packs', (req, res) => {
    res.json(texturePacks);
});

// Rejestracja komendy /dodaj w Discordzie
const commands = [
    new SlashCommandBuilder()
        .setName('dodaj')
        .setDescription('Otwiera formularz dodawania nowej paczki texture pack')
];

client.on('ready', async () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.DISCORD_GUILD_ID),
            { body: commands }
        );
        console.log('Pomyślnie zarejestrowano komendę /dodaj!');
    } catch (err) {
        console.error('Błąd rejestracji komendy:', err);
    }
});

// Obsługa komendy /dodaj oraz wysłanego formularza (Modal)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'dodaj') {
        const hasRole = interaction.member.roles.cache.has(process.env.DISCORD_ROLE_ID_TXT);
        
        if (!hasRole) {
            return interaction.reply({ 
                content: '❌ Nie posiadasz rangi **txt**, aby dodawać paczki!', 
                ephemeral: true 
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('txt_modal')
            .setTitle('Dodaj Texture Pack');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Nazwa paczki')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. Purple Fade 64x')
            .setRequired(true);

        const serverInput = new TextInputBuilder()
            .setCustomId('server')
            .setLabel('Serwer / Kategoria')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Anarchia.GG / MineSerwer / Inny')
            .setRequired(true);

        const modeInput = new TextInputBuilder()
            .setCustomId('mode')
            .setLabel('Tryb gry')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('BoxPvP / SkyPvP / Anarchia / Inny')
            .setRequired(true);

        const versionInput = new TextInputBuilder()
            .setCustomId('version')
            .setLabel('Wersja Minecraft')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. 1.8.9 lub 1.16 - 1.21')
            .setRequired(true);

        const linkInput = new TextInputBuilder()
            .setCustomId('link')
            .setLabel('Link do pobrania (MediaFire / GDrive)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(serverInput),
            new ActionRowBuilder().addComponents(modeInput),
            new ActionRowBuilder().addComponents(versionInput),
            new ActionRowBuilder().addComponents(linkInput)
        );

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'txt_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const server = interaction.fields.getTextInputValue('server');
        const mode = interaction.fields.getTextInputValue('mode');
        const version = interaction.fields.getTextInputValue('version');
        const link = interaction.fields.getTextInputValue('link');

        const authorName = interaction.user.username;
        const authorAvatar = interaction.user.displayAvatarURL();

        texturePacks.push({
            title,
            server,
            mode,
            version,
            link,
            authorName,
            authorAvatar,
            date: new Date().toLocaleDateString('pl-PL')
        });

        await interaction.reply({ 
            content: `✅ Paczka **${title}** została pomyślnie dodana!`, 
            ephemeral: true 
        });
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serwer i Bot działają na porcie ${PORT}`));
