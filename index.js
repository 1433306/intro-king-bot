const http = require('http');
http.createServer((req, res) => { res.write("Bot Aktif!"); res.end(); }).listen(process.env.PORT || 10000);

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

// Botun izinlerini (Intentleri) ayarlıyoruz
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Slash (/) komutunu tanımlıyoruz
const commands = [
    new SlashCommandBuilder()
        .setName('intro')
        .setDescription('Odaya girdiğinde çalacak müziği ayarlar.')
        .addStringOption(option => option.setName('link').setDescription('YouTube Video Linki').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`>>> Bot Giriş Yaptı: ${client.user.tag}`);
    } catch (e) { console.error("Komut yüklenirken hata oluştu:", e); }
});

// /intro komutu kullanıldığında çalışacak kısım
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'intro') {
        const url = interaction.options.getString('link');
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return interaction.reply({ content: "❌ Lütfen geçerli bir YouTube linki ver!", ephemeral: true });
        }
        
        let introlar = {};
        if (fs.existsSync('./introlar.json')) {
            introlar = JSON.parse(fs.readFileSync('./introlar.json', 'utf8'));
        }
        
        introlar[interaction.user.id] = url;
        fs.writeFileSync('./introlar.json', JSON.stringify(introlar, null, 2));
        
        await interaction.reply(`✅ Harika! İntron kaydedildi. Artık odaya girdiğinde bu çalacak: ${url}`);
    }
});

// Birisi ses kanalına girdiğinde çalışacak kısım
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Sadece birisi odaya katıldığında tetiklenir
    if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
        if (!fs.existsSync('./introlar.json')) return;
        
        const introlar = JSON.parse(fs.readFileSync('./introlar.json', 'utf8'));
        const userIntro = introlar[newState.member.id];

        if (userIntro) {
            console.log(`${newState.member.user.tag} için intro çalınıyor...`);
            try {
                const connection = joinVoiceChannel({
                    channelId: newState.channelId,
                    guildId: newState.guild.id,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                });

                // YouTube ses akışını hazırlıyoruz
                const stream = await play.stream(userIntro, { discordPlayerCompatibility: true });
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                const player = createAudioPlayer({
                    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
                });
                
                player.play(resource);
                connection.subscribe(player);
                
                // Müzik bittiğinde bot odadan çıkar
                player.on(AudioPlayerStatus.Idle, () => {
                    setTimeout(() => connection.destroy(), 1000);
                });

                player.on('error', error => console.error("Çalma Hatası:", error));

            } catch (e) {
                console.error("Ses bağlantı hatası:", e);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);