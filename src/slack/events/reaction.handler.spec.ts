import { Test, TestingModule } from '@nestjs/testing';
import { ReactionHandler } from './reaction.handler';
import { SlackService } from '../slack.service';
import { BurritosService } from '../../burritos/burritos.service';
import { I18nService } from '../../i18n/i18n.service';

const mockSlackService = {
  getMessage: jest.fn(),
  postMessage: jest.fn(),
};

const mockBurritosService = {
  giveBurrito: jest.fn(),
};

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

function makeContext(overrides: Partial<{ text: string; messageAuthor: string }> = {}) {
  const response: any = {};
  response.status = jest.fn().mockReturnValue(response);
  response.send = jest.fn().mockReturnValue(response);

  mockSlackService.getMessage.mockResolvedValue({
    text: overrides.text ?? '',
    user: overrides.messageAuthor ?? 'U_AUTHOR',
  });

  return {
    event: { user: 'U_GIVER', item: { channel: 'C001', ts: '111' } },
    response,
  };
}

describe('ReactionHandler', () => {
  let handler: ReactionHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionHandler,
        { provide: SlackService, useValue: mockSlackService },
        { provide: BurritosService, useValue: mockBurritosService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    handler = module.get<ReactionHandler>(ReactionHandler);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canHandle', () => {
    it('should return true for reaction_added with burrito emoji', () => {
      expect(
        handler.canHandle('event_callback', { type: 'reaction_added', reaction: 'burrito' }),
      ).toBe(true);
    });

    it('should return false for other emojis', () => {
      expect(
        handler.canHandle('event_callback', { type: 'reaction_added', reaction: 'thumbsup' }),
      ).toBe(false);
    });

    it('should return false for non event_callback types', () => {
      expect(
        handler.canHandle('slash_command', { type: 'reaction_added', reaction: 'burrito' }),
      ).toBe(false);
    });
  });

  describe('execute', () => {
    it('should give burrito to the user mentioned in the reacted message', async () => {
      const context = makeContext({ text: 'great work <@U_MENTIONED>!', messageAuthor: 'U_AUTHOR' });
      mockBurritosService.giveBurrito.mockResolvedValue({});
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: 'U_GIVER',
        receiverId: 'U_MENTIONED',
      });
    });

    it('should give burrito to the message author when there is no @mention', async () => {
      const context = makeContext({ text: 'I did something great!', messageAuthor: 'U_AUTHOR' });
      mockBurritosService.giveBurrito.mockResolvedValue({});
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: 'U_GIVER',
        receiverId: 'U_AUTHOR',
      });
    });

    it('should post error message if giveBurrito throws', async () => {
      const context = makeContext({ text: '<@U_MENTIONED>' });
      mockBurritosService.giveBurrito.mockRejectedValue({ message: 'monthly limit reached' });
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isError: true }),
      );
    });
  });
});
