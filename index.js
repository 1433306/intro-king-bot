const http = require('http');
http.createServer((req, res) => { res.write("Bot aktif!"); res.end(); }).listen(process.env.PORT || 8080);

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

const prefix = "!";

// Odaya girince çalma özelliği
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Birisi odaya girdi mi? (Bot değilse ve yeni bir kanala girdiyse)
    if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
        
        const introlar = JSON.parse(fs.readFileSync('./introlar.json', 'utf8'));
        const userIntro = introlar[newState.member.id];

        if (userIntro) {
            const connection = joinVoiceChannel({
                channelId: newState.channelId,
                guildId: newState.guild.id,
                adapterCreator: newState.guild.voiceAdapterCreator,
            });

            try {
                const stream = await play.stream(userIntro);
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                const player = createAudioPlayer();
                player.play(resource);
                connection.subscribe(player);
                
                // Müzik bitince odadan çıkması için (isteğe bağlı)
                player.on(AudioPlayerStatus.Idle, () => connection.destroy());
            } catch (e) { console.error("Çalma hatası:", e); }
        }
    }
});

// Komutlar
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // !intro https://youtube... (Müziğini kaydeder)
    if (command === 'intro') {
        const url = args[0];
        if (!url || !url.includes('youtube.com')) return message.reply("Lütfen geçerli bir YouTube linki ver!");
        
        const introlar = JSON.parse(fs.readFileSync('./introlar.json', 'utf8'));
        introlar[message.author.id] = url; // Senin ID'ne bu linki kaydetti
        
        fs.writeFileSync('./introlar.json', JSON.stringify(introlar, null, 2));
        message.reply("✅ İntron başarıyla kaydedildi! Artık odaya girdiğinde bu çalacak.");
    }
});

client.login(process.env.DISCORD_TOKEN);
