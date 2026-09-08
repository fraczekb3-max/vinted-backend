const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    SlashCommandBuilder, 
    REST, 
    Routes,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
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

// Pamięć na dodane paczki (widoczna na stronie WWW)
const texturePacks = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint dla strony WWW
app.get('/api/packs', (req, res) => {
    res.json(texturePacks);
});

// Rejestracja komendy /dodaj
const commands = [
    new SlashCommandBuilder()
        .setName('dodaj')
        .setDescription('Dodaj nowy texture pack przez formularz')
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

// Obsługa komendy i formularza
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'dodaj') {
        try {
            const memberRoles = interaction.member.roles.cache || interaction.member.roles;
            const hasRole = typeof memberRoles.has === 'function' 
                ? memberRoles.has(process.env.DISCORD_ROLE_ID_TXT) 
                : memberRoles.includes(process.env.DISCORD_ROLE_ID_TXT);
            
            if (!hasRole) {
                return interaction.reply({ 
                    content: '❌ Nie posiadasz rangi **txt**, aby dodawać paczki!', 
                    ephemeral: true 
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('txt_modal')
                .setTitle('Dodaj Texture Pack (Xenon TxT)');

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
                .setPlaceholder('np. Anarchia.GG')
                .setRequired(true);

            const modeInput = new TextInputBuilder()
                .setCustomId('mode')
                .setLabel('Tryb gry / Rip')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('np. BoxPvP / Custom')
                .setRequired(true);

            const versionInput = new TextInputBuilder()
                .setCustomId('version')
                .setLabel('Wersja Minecraft')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('np. 1.8.9 / 1.16 - 1.21')
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('desc')
                .setLabel('Krótki opis paczki')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Napisz coś o paczce...')
                .setRequired(true);

            const imageInput = new TextInputBuilder()
                .setCustomId('image')
                .setLabel('Link do zdjęcia (URL)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://...')
                .setRequired(true);

            const linkInput = new TextInputBuilder()
                .setCustomId('link')
                .setLabel('Link do pobrania (Mediafire)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://www.mediafire.com/file/...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(serverInput),
                new ActionRowBuilder().addComponents(modeInput),
                new ActionRowBuilder().addComponents(versionInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(imageInput),
                new ActionRowBuilder().addComponents(linkInput)
            );

            await interaction.showModal(modal);
        } catch (err) {
            console.error('Błąd przy obsłudze komendy /dodaj:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas uruchamiania formularza.', ephemeral: true }).catch(() => {});
            }
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'txt_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const server = interaction.fields.getTextInputValue('server');
        const mode = interaction.fields.getTextInputValue('mode');
        const version = interaction.fields.getTextInputValue('version');
        const desc = interaction.fields.getTextInputValue('desc');
        const image = interaction.fields.getTextInputValue('image');
        const link = interaction.fields.getTextInputValue('link');

        const authorName = interaction.user.username;
        const authorAvatar = interaction.user.displayAvatarURL();

        texturePacks.push({
            title,
            server,
            mode,
            version,
            desc,
            image,
            link,
            authorName,
            authorAvatar,
            date: new Date().toLocaleDateString('pl-PL')
        });

        const embed = new EmbedBuilder()
            .setColor(0x9370DB)
            .setTitle(`📦 Nowy Texture Pack: ${title}`)
            .setDescription(desc)
            .addFields(
                { name: '🌐 Serwer', value: server, inline: true },
                { name: '⚔️ Tryb / Rip', value: mode, inline: true },
                { name: '⚙️ Wersja', value: version, inline: true },
                { name: '👤 Autor', value: authorName, inline: true }
            )
            .setImage(image)
            .setFooter({ text: 'Xenon TxT • System zarządzania paczkami', iconURL: authorAvatar })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Pobierz z Mediafire')
                .setStyle(ButtonStyle.Link)
                .setURL(link)
        );

        await interaction.reply({ 
            content: `✅ Paczka **${title}** została pomyślnie dodana do bazy i na stronę!`, 
            embeds: [embed],
            components: [row],
            ephemeral: false 
        });
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serwer i Bot działają na porcie ${PORT}`));
