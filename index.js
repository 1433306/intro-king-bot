const http = require('http');
http.createServer((req, res) => {
  res.write("Bot aktif!");
  res.end();
}).listen(process.env.PORT || 8080);
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildVoiceStates, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// --- AYARLAR ---
const TOKEN = 'MTQ2MDc3NTc2NjExNDY5NzM1OA.G4lcY3.UGsEs0bWh_oLJhb17ae8W1d27nplpXe2WWu6lk'; 
const PREFIX = '!';
const VARSAYILAN_SURE = 15; // Şarkının kaç saniye çalacağını buradan ayarlayabilirsin
// ---------------

client.on('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı! Botun ruhu şu an aktif.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Komut: !introekle [YouTube Linki]
    if (message.content.startsWith(PREFIX + 'introekle')) {
        const args = message.content.split(' ');
        const link = args[1];
        
        if (!link || !play.yt_validate(link)) {
            return message.reply('Lütfen geçerli bir YouTube linki ekle! Örn: !introekle https://youtube.com/watch?v=...');
        }

        let data = JSON.parse(fs.readFileSync('./introlar.json', 'utf8'));
        data[message.author.id] = link;
        fs.writeFileSync('./introlar.json', JSON.stringify(data, null, 2));

        message.reply(`Giriş şarkın başarıyla kaydedildi! Bir ses kanalına girdiğinde ${VARSAYILAN_SURE} saniye boyunca çalacak.`);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Birisi bir ses kanalına katıldığında çalışır
    if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
        let data = JSON.parse(fs.readFileSync('./introlar.json', 'utf8'));
        const userIntro = data[newState.member.id];

        if (userIntro) {
            try {
                const connection = joinVoiceChannel({
                    channelId: newState.channelId,
                    guildId: newState.guild.id,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                });

                let source = await play.stream(userIntro);
                const resource = createAudioResource(source.stream, { inputType: source.type });
                const player = createAudioPlayer();

                player.play(resource);
                connection.subscribe(player);

                // Belirlenen süre sonunda bot kanaldan çıkar
                const timer = setTimeout(() => {
                    if (connection.state.status !== 'destroyed') connection.destroy();
                }, VARSAYILAN_SURE * 1000);

                player.on(AudioPlayerStatus.Idle, () => {
                    clearTimeout(timer);
                    if (connection.state.status !== 'destroyed') connection.destroy();
                });
            } catch (err) {
                console.error("Ses çalma hatası:", err);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);