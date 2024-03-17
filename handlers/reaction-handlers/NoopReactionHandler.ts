import { IReactionHandler } from "./_IReactionHandler";
export class NoopReactionHandler implements IReactionHandler {
  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }
  protected processReaction(): Promise<void> {
    return Promise.resolve();
  }
  async handle(reaction, user) {
    return;
  }
}
