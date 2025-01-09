require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');

// Discord client ayarları
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
});

// Bot hazır olduğunda
client.on('ready', async () => {
    console.log('TrinsyBot is online!');

    // Slash komutu kaydetme
    const data = [
        {
            name: 'tokeninfo',
            description: 'OpenAI API tarafından kullanılan token bilgilerini gösterir',
        },
        {
            name: 'omer',
            description: 'Ömer İslamoğlu sosyal medya hesapları',
        },
    ];

    // Sunucu ID'si (Örnek: "629015691458248709")
    const guildId = '629015691458248709';
    const guild = client.guilds.cache.get(guildId);

    if (guild) {
        await guild.commands.set(data);
        console.log('Slash komutları kaydedildi.');
    } else {
        console.log(`Belirtilen ID ile sunucu bulunamadı: ${guildId}`);
    }
});

// Slash komutu isteği geldiğinde
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'tokeninfo') {
        await interaction.deferReply(); // Botun yanıt vermek için zamana ihtiyacı olduğunu gösterir

        // Örnek olarak basit iki mesajla OpenAI'ye istek yapıyoruz
        const messages = [
            { role: 'system', content: 'Bu bir test mesajıdır.' },
            { role: 'user', content: 'Merhaba, bot!' },
        ];

        // OpenAI API çağrısı
        const response = await openai.chat.completions
            .create({
                model: 'gpt-3.5-turbo',
                messages: messages,
            })
            .catch((error) => {
                console.error('OpenAI Error:\n', error);
                interaction.editReply('OpenAI API bağlantısında bir sorun oluştu.');
                return null;
            });

        // Eğer yanıt gelmediyse
        if (!response) return;

        // Yanıtta kullanılan token bilgileri
        const totalTokens = response.usage?.total_tokens;
        const promptTokens = response.usage?.prompt_tokens;
        const completionTokens = response.usage?.completion_tokens;

        // Yoksa (örneğin usage gelmediyse) fallback olarak bir uyarı
        if (totalTokens === undefined) {
            await interaction.editReply('Token bilgisi alınamadı. OpenAI yanıtında "usage" alanı yok.');
            return;
        }

        // Yanıtı düzenle
        await interaction.editReply(`
**Toplam kullanılan token**: ${totalTokens}
**İstek sırasında kullanılan token**: ${promptTokens}
**Yanıt sırasında kullanılan token**: ${completionTokens}
        `);
    }
    
    if (interaction.commandName === 'omer') {
        await interaction.reply(`
**Ömer İslamoğlu Sosyal Medya Hesapları**

- **:Github: GitHub:** [@trinsyca](https://github.com/trinsyca)
- **Instagram:** [@trinsyca](https://instagram.com/trinsyca)
- **Twitter:** [@trinsyca](https://twitter.com/trinsyca)
- **LinkedIn:** [in/trinsyca](https://linkedin.com/in/trinsyca)
        `);
    }
});

// Mesaj geldiğinde GPT'ye danışma
const IGNORE_PREFIX = '!';
const CHANNELS = ['1326793797950246922'];
const MAX_TOKENS = 4096; // GPT-3.5-turbo'nun üst limiti

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

client.on('messageCreate', async (message) => {
    // 1) Botun kendisi veya komut prefix ile başlayan mesajları yok say
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;

    // 2) Sadece belirli kanal veya @mention
    if (!CHANNELS.includes(message.channel.id) && !message.mentions.users.has(client.user.id)) return;

    // Yazıyor... gösterimi
    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    // Konuşma dizisi
    let conversation = [];

    // İlk olarak sistem mesajı ekliyoruz
    conversation.push({
        role: 'system',
        content: 'Sana nasıl yardımcı olabilirim kral?',
    });

    // Son 30 mesajı çek
    let prevMessages = await message.channel.messages.fetch({ limit: 30 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        // Eğer başka bir bot ve bu bot değilse
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        if (msg.content.startsWith(IGNORE_PREFIX)) return;
        if (!msg.content.trim()) return; // Boş mesaj

        // Kullanıcı adında boşluk veya özel karakter varsa temizle
        const username = msg.author.username
            .replace(/\s+/g, '_')
            .replace(/[^\w\s]/gi, '');

        if (msg.author.id === client.user.id) {
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content,
            });
        } else {
            conversation.push({
                role: 'user',
                name: username,
                content: msg.content,
            });
        }
    });

    // Token sayısı hesaplama (basit yaklaşımla kelime sayımı)
    function calculateTokens(conversation) {
        return conversation.reduce(
            (total, msg) => total + msg.content.split(' ').length,
            0
        );
    }

    // Token sınıra yaklaşırsa en eski mesajları kaldır
    while (calculateTokens(conversation) > MAX_TOKENS - 500) {
        conversation.shift();
    }

    // OpenAI API isteği
    let response;
    try {
        response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: conversation,
        });
    } catch (error) {
        console.error('OpenAI Error:\n', error);
    }

    clearInterval(sendTypingInterval);

    if (!response || !response.choices || response.choices.length === 0) {
        message.reply('OpenAI bağlantısında bir sorun yaşıyorum. Lütfen daha sonra tekrar dene.');
        return;
    }

    // Yanıtı gönder
    message.reply(response.choices[0].message.content);
});

// Son olarak botu başlat
client.login(process.env.TOKEN);
