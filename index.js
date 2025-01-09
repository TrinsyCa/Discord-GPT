require('dotenv/config');
const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: [
        'Guilds',
        'GuildMembers',
        'GuildMessages',
        'MessageContent',
    ],
});

client.on('ready', () => {
    console.log('TrinsyBot is online!');
});

const IGNORE_PREFIX = '!';
const CHANNELS = ['1326793797950246922'];
const MAX_TOKENS = 4096; // ChatGPT 3.5-Turbo: 4096 Token

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;

    if (!CHANNELS.includes(message.channel.id) && !message.mentions.users.has(client.user.id)) return;

    await message.channel.sendTyping();

    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    let conversation = [];

    conversation.push({
        role: 'system',
        content: 'Sana nasıl yardımcı olabilirim kral?',
    });

    let prevMessages = await message.channel.messages.fetch({ limit: 30 });

    prevMessages.forEach((msg) => {
        if(msg.author.bot && msg.author.id !== client.user.id) return;
        if(msg.content.startsWith(IGNORE_PREFIX)) return;
        if (!msg.content.trim()) return;

        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        if(msg.author.id === client.user.id) {
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content,
            });

            return;
        }

        conversation.push({
            role: 'user',
            name: username,
            content: msg.content,
        });
    });

    function calculateTokens(conversation) {
        return conversation.reduce((total, msg) => total + msg.content.split(' ').length, 0);
    }

    while (calculateTokens(conversation) > MAX_TOKENS - 500) {
        conversation.shift(); // En eski mesajı kaldır
    }

    const response = await openai.chat.completions
    .create({
        model: 'gpt-3.5-turbo',
        messages:conversation,
    })
    .catch((error) => {
        console.error('OpenAI Error:\n', error);
    });

    clearInterval(sendTypingInterval);

    if (!response || !response.choices || response.choices.length === 0) {
        message.reply('OpenAI bağlantısında bir sorun yaşıyorum. Lütfen daha sonra tekrar dene.');
        return;
    }
    
    message.reply(response.choices[0].message.content);
});

client.login(process.env.TOKEN);

// Slash Commands

client.on('ready', async () => {
    console.log('TrinsyBot is online!');

    const data = [
        {
            name: 'tokeninfo',
            description: 'OpenAI API tarafından kullanılan token bilgilerini gösterir',
        },
    ];

    const guild = client.guilds.cache.get('629015691458248709'); // Server ID
    if (guild) {
        await guild.commands.set(data);
        console.log('Slash komutları kaydedildi.');
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'tokeninfo') {
        await interaction.deferReply(); // Botun yanıt verirken biraz zaman alacağını belirtir

        const messages = [
            { role: 'system', content: 'Bu bir test mesajıdır.' },
            { role: 'user', content: 'Merhaba, bot!' },
        ];

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

        if (!response) return;

        const totalTokens = response.usage.total_tokens;
        const promptTokens = response.usage.prompt_tokens;
        const completionTokens = response.usage.completion_tokens;

        await interaction.editReply(`
Toplam kullanılan token: **${totalTokens}**
İstek sırasında kullanılan token: **${promptTokens}**
Yanıt sırasında kullanılan token: **${completionTokens}**
        `);
    }
});