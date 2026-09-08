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

const texturePacks = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/packs', (req, res) => {
    res.json(texturePacks);
});

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

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'dodaj') {
        const modal = new ModalBuilder()
            .setCustomId('txt_modal')
            .setTitle('Dodaj Texture Pack');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Nazwa paczki')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const versionInput = new TextInputBuilder()
            .setCustomId('version')
            .setLabel('Wersja Minecraft')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const imageInput = new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Link do zdjęcia (URL)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const linkInput = new TextInputBuilder()
            .setCustomId('link')
            .setLabel('Link do pobrania (Mediafire)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(versionInput),
            new ActionRowBuilder().addComponents(imageInput),
            new ActionRowBuilder().addComponents(linkInput)
        );

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'txt_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const version = interaction.fields.getTextInputValue('version');
        const image = interaction.fields.getTextInputValue('image');
        const link = interaction.fields.getTextInputValue('link');

        const authorName = interaction.user.username;
        const authorAvatar = interaction.user.displayAvatarURL();

        texturePacks.push({
            title,
            version,
            image,
            link,
            authorName,
            authorAvatar,
            date: new Date().toLocaleDateString('pl-PL')
        });

        const embed = new EmbedBuilder()
            .setColor(0x9370DB)
            .setTitle(`📦 Nowy Texture Pack: ${title}`)
            .addFields(
                { name: '⚙️ Wersja', value: version, inline: true },
                { name: '👤 Autor', value: authorName, inline: true }
            )
            .setImage(image)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Pobierz z Mediafire')
                .setStyle(ButtonStyle.Link)
                .setURL(link)
        );

        await interaction.reply({ 
            content: `✅ Paczka **${title}** została dodana!`, 
            embeds: [embed],
            components: [row]
        });
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serwer i Bot działają na porcie ${PORT}`));
