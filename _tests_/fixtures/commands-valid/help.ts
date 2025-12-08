export default {
  name: 'help',
  description: 'List commands',
  aliases: ['commands'],
  async execute(ctx: any) {
    return ctx.chatManager.sendMessage(ctx.channel, 'help');
  }
};
