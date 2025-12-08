export default {
  name: 'ok',
  description: 'Valid command in invalid folder',
  async execute(ctx: any) {
    return ctx.chatManager && ctx.chatManager.sendMessage(ctx.channel, 'ok');
  }
};
