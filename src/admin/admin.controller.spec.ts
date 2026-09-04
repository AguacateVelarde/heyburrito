// AuthService pulls in @nestjs/jwt -> jsonwebtoken -> buffer-equal-constant-time,
// which reads the `SlowBuffer` export removed in Node 24+. Stubbing the module
// keeps this spec runnable on any Node version; nothing here needs real signing.
jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
  JwtModule: class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';

const mockAdminService = {
  getDashboard: jest.fn(),
  getTransactions: jest.fn(),
  getUpcomingBirthdays: jest.fn(),
};

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('validates the credentials before issuing a token', async () => {
      mockAuthService.validateUser.mockResolvedValue({ username: 'admin' });
      mockAuthService.login.mockResolvedValue({ access_token: 'jwt' });

      const result = await controller.login({
        username: 'admin',
        password: 'secret',
      });

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'admin',
        'secret',
      );
      expect(mockAuthService.login).toHaveBeenCalledWith({ username: 'admin' });
      expect(result).toEqual({ access_token: 'jwt' });
    });

    it('never issues a token when the credentials are rejected', async () => {
      mockAuthService.validateUser.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login({ username: 'admin', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  describe('getTransactions', () => {
    it('defaults to a 50 row page', async () => {
      await controller.getTransactions();

      expect(mockAdminService.getTransactions).toHaveBeenCalledWith({
        limit: 50,
        skip: 0,
      });
    });

    it('caps the page size', async () => {
      await controller.getTransactions('100000', '10');

      expect(mockAdminService.getTransactions).toHaveBeenCalledWith({
        limit: 200,
        skip: 10,
      });
    });

    it('falls back to the defaults for junk input', async () => {
      await controller.getTransactions('abc', '-5');

      expect(mockAdminService.getTransactions).toHaveBeenCalledWith({
        limit: 50,
        skip: 0,
      });
    });
  });

  describe('getUpcomingBirthdays', () => {
    it('defaults to five and caps at fifty', async () => {
      await controller.getUpcomingBirthdays();
      expect(mockAdminService.getUpcomingBirthdays).toHaveBeenCalledWith(5);

      await controller.getUpcomingBirthdays('999');
      expect(mockAdminService.getUpcomingBirthdays).toHaveBeenCalledWith(50);
    });
  });
});
