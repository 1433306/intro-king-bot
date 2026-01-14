const http = require('http');
http.createServer((req, res) => { res.write("Bot Aktif!"); res.end(); }).listen(process.env.PORT || 10000);

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('intro')
        .setDescription('Odaya girdiğinde çalacak müziği ayarlar.')
        .addStringOption(option => option.setName('link').setDescription('YouTube Linki').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`Bot Giriş Yaptı: ${client.user.tag}`);
    } catch (e) { console.error("Komut yükleme hatası:", e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'intro') {
        const url = interaction.options.getString('link');
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) return interaction.reply("Geçerli bir YouTube linki ver!");
        
        let introlar = {};
        if (fs.existsSync('./introlar.json')) introlar = JSON.parse(fs.readFileSync('./introlar.json'));
        introlar[interaction.user.id] = url;
        fs.writeFileSync('./introlar.json', JSON.stringify(introlar, null, 2));
        
        await interaction.reply(`✅ İntron kaydedildi: ${url}`);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
        if (!fs.existsSync('./introlar.json')) return;
        const introlar = JSON.parse(fs.readFileSync('./introlar.json'));
        const userIntro = introlar[newState.member.id];

        if (userIntro) {
            try {
                const connection = joinVoiceChannel({
                    channelId: newState.channelId,
                    guildId: newState.guild.id,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                });

                const stream = await play.stream(userIntro);
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
                
                player.play(resource);
                connection.subscribe(player);
                
                player.on(AudioPlayerStatus.Idle, () => connection.destroy());
            } catch (e) { console.error("Ses çalınamadı:", e); }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);