import { Test, TestingModule } from '@nestjs/testing';
import { MessageHandler, SYSTEM_USER_ID } from './message.handler';
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

function makeResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('MessageHandler', () => {
  let handler: MessageHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageHandler,
        { provide: SlackService, useValue: mockSlackService },
        { provide: BurritosService, useValue: mockBurritosService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    handler = module.get<MessageHandler>(MessageHandler);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canHandle', () => {
    it('should return true for a non-bot message containing :burrito:', () => {
      const event = { type: 'message', text: 'great job :burrito:' };
      expect(handler.canHandle('event_callback', event)).toBe(true);
    });

    it('should return false for bot messages', () => {
      const event = { type: 'message', text: ':burrito:', bot_id: 'B123' };
      expect(handler.canHandle('event_callback', event)).toBe(false);
    });

    it('should return false if message does not contain :burrito:', () => {
      const event = { type: 'message', text: 'hello world' };
      expect(handler.canHandle('event_callback', event)).toBe(false);
    });

    it('should return false for non event_callback types', () => {
      const event = { type: 'message', text: ':burrito:' };
      expect(handler.canHandle('slash_command', event)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should give burrito to mentioned user', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: 'great work <@U999> :burrito:',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito.mockResolvedValue({});
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: 'U123',
        receiverId: 'U999',
      });
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'burrito.givenInChannel',
        { giverId: 'U123', receiverId: 'U999' },
      );
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it('should give burrito to message author (via SYSTEM) when there is no @mention', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: 'I love burritos :burrito:',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito.mockResolvedValue({});
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: SYSTEM_USER_ID,
        receiverId: 'U123',
      });
      expect(mockI18nService.translate).toHaveBeenCalledWith('burrito.selfGiven', {
        receiverId: 'U123',
      });
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it('should post error message if giveBurrito throws when mentioning a user', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: '<@U999> :burrito:',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito.mockRejectedValue({
        message: 'You have reached your monthly limit',
      });
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isError: true }),
      );
    });

    it('should give burritos to all mentioned users and post givenMultiple', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: 'great work <@U001> and <@U002> :burrito:',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito.mockResolvedValue({});
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockBurritosService.giveBurrito).toHaveBeenCalledTimes(2);
      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: 'U123',
        receiverId: 'U001',
      });
      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: 'U123',
        receiverId: 'U002',
      });
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'burrito.givenMultiple',
        expect.objectContaining({ giverId: 'U123', count: 2 }),
      );
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it('should deduplicate mentions and give only one burrito per user', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: '<@U001> :burrito: <@U001>',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito.mockResolvedValue({});
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockBurritosService.giveBurrito).toHaveBeenCalledTimes(1);
      expect(mockBurritosService.giveBurrito).toHaveBeenCalledWith({
        giverId: 'U123',
        receiverId: 'U001',
      });
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'burrito.givenInChannel',
        { giverId: 'U123', receiverId: 'U001' },
      );
    });

    it('should post errors for failed recipients but still give burritos to successful ones', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: '<@U001> <@U002> :burrito:',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ message: 'Monthly limit reached' });
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockSlackService.postMessage).toHaveBeenCalledTimes(2);
      // One error message for the failed recipient
      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isError: true }),
      );
      // One success message for the successful recipient (no isError)
      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.not.objectContaining({ isError: true }),
      );
    });

    it('should post error message if giveBurrito throws when no mention', async () => {
      const response = makeResponse();
      const context = {
        event: {
          text: ':burrito: for myself',
          user: 'U123',
          channel: 'C001',
          ts: '12345',
        },
        response,
      };

      mockBurritosService.giveBurrito.mockRejectedValue({
        message: 'Some error',
      });
      mockSlackService.postMessage.mockResolvedValue({});

      await handler.execute(context as any);

      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isError: true }),
      );
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });
});
