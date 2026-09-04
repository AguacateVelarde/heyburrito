import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UnprocessableEntityException } from '@nestjs/common';
import { BurritosService } from './burritos.service';
import { Burrito } from './schemas/burrito.schema';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../config/config.service';
import { I18nService } from '../i18n/i18n.service';

const mockBurritoModel = {
  create: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
};

const mockUsersService = {
  findOrCreate: jest.fn(),
  updateStats: jest.fn(),
  getLeaderboard: jest.fn(),
};

const mockConfigService = {
  monthlyBurritoLimit: 0,
  isLeaderboardEnabled: true,
};

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

describe('BurritosService', () => {
  let service: BurritosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BurritosService,
        { provide: getModelToken(Burrito.name), useValue: mockBurritoModel },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<BurritosService>(BurritosService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('giveBurrito', () => {
    it('should throw UnprocessableEntityException when giver and receiver are the same', async () => {
      await expect(
        service.giveBurrito({ giverId: 'U1', receiverId: 'U1' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'burrito.giveBurrito.self',
      );
    });

    it('should throw when monthly limit is exceeded', async () => {
      mockConfigService.monthlyBurritoLimit = 5;
      mockBurritoModel.countDocuments.mockResolvedValue(5);

      await expect(
        service.giveBurrito({ giverId: 'U1', receiverId: 'U2' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'burrito.giveBurrito.limit',
        { monthlyLimit: 5 },
      );

      mockConfigService.monthlyBurritoLimit = 0;
    });

    it('should not check limit when monthlyBurritoLimit is 0', async () => {
      mockConfigService.monthlyBurritoLimit = 0;
      const mockBurrito = { giverId: 'U1', receiverId: 'U2' };
      mockBurritoModel.create.mockResolvedValue(mockBurrito);
      mockUsersService.findOrCreate.mockResolvedValue({ slackId: 'U1' });
      mockUsersService.updateStats.mockResolvedValue(undefined);

      await service.giveBurrito({ giverId: 'U1', receiverId: 'U2' });

      expect(mockBurritoModel.countDocuments).not.toHaveBeenCalled();
    });

    it('should create burrito and update stats for both giver and receiver', async () => {
      const mockBurrito = { giverId: 'U1', receiverId: 'U2' };
      mockBurritoModel.create.mockResolvedValue(mockBurrito);
      mockUsersService.findOrCreate.mockResolvedValue({ slackId: 'U1' });
      mockUsersService.updateStats.mockResolvedValue(undefined);

      const result = await service.giveBurrito({
        giverId: 'U1',
        receiverId: 'U2',
        message: 'great work!',
      });

      expect(mockBurritoModel.create).toHaveBeenCalledWith({
        giverId: 'U1',
        receiverId: 'U2',
        message: 'great work!',
      });
      expect(mockUsersService.findOrCreate).toHaveBeenCalledTimes(2);
      expect(mockUsersService.updateStats).toHaveBeenCalledWith(
        expect.anything(),
        'burritosGiven',
      );
      expect(mockUsersService.updateStats).toHaveBeenCalledWith(
        expect.anything(),
        'burritosReceived',
      );
      expect(result).toBe(mockBurrito);
    });

    it('should allow giving from SYSTEM user to a real user', async () => {
      const mockBurrito = { giverId: 'SYSTEM', receiverId: 'U1' };
      mockBurritoModel.create.mockResolvedValue(mockBurrito);
      mockUsersService.findOrCreate.mockResolvedValue({ slackId: 'U1' });
      mockUsersService.updateStats.mockResolvedValue(undefined);

      const result = await service.giveBurrito({
        giverId: 'SYSTEM',
        receiverId: 'U1',
      });

      expect(result).toBe(mockBurrito);
    });
  });

  describe('getDailyCounts', () => {
    afterEach(() => jest.useRealTimers());

    it('returns one entry per day and fills the gaps with zeros', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T15:00:00Z'));
      mockBurritoModel.aggregate.mockResolvedValue([
        { _id: '2026-03-08', count: 4 },
        { _id: '2026-03-10', count: 2 },
      ]);

      const result = await service.getDailyCounts(5);

      expect(result).toEqual([
        { date: '2026-03-06', count: 0 },
        { date: '2026-03-07', count: 0 },
        { date: '2026-03-08', count: 4 },
        { date: '2026-03-09', count: 0 },
        { date: '2026-03-10', count: 2 },
      ]);
    });

    it('only aggregates from the start of the window', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T15:00:00Z'));
      mockBurritoModel.aggregate.mockResolvedValue([]);

      await service.getDailyCounts(30);

      const [[stage]] = mockBurritoModel.aggregate.mock.calls;
      expect(stage[0].$match.createdAt.$gte.toISOString()).toBe(
        '2026-02-09T00:00:00.000Z',
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should throw when leaderboard is disabled', async () => {
      mockConfigService.isLeaderboardEnabled = false;

      await expect(service.getLeaderboard()).rejects.toThrow(
        UnprocessableEntityException,
      );

      mockConfigService.isLeaderboardEnabled = true;
    });

    it('should return leaderboard when enabled', async () => {
      const mockLeaderboard = [{ slackId: 'U1', burritosReceived: 5 }];
      mockUsersService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await service.getLeaderboard();

      expect(result).toBe(mockLeaderboard);
    });
  });
});
