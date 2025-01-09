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

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 10000, // 10 Saniye zaman aşımı
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
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        if(msg.author.bot && msg.author.id !== client.user.id) return;
        if(msg.content.startsWith(IGNORE_PREFIX)) return;

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

    const response = openai.chat.completions
    .create({
        model: 'gpt-3.5-turbo',
        messages:conversation,
    })
    .catch((error) => {
        console.error('OpenAI Error:\n', error);
    });

    clearInterval(sendTypingInterval);

    if(!response) {
        message.reply('OpenAI bağlantısında bir sorun yaşıyorum. Lütfen daha sonra tekrar dene.');
        return;
    }

    message.reply(response.choices[0].message.content);
});

client.login(process.env.TOKEN);