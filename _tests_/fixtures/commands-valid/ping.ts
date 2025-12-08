export default {
  name: 'ping',
  description: 'Ping test',
  async execute(ctx: any) {
    return ctx.chatManager.sendMessage(ctx.channel, 'pong!');
  },
};
