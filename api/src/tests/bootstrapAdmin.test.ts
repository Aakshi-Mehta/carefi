import User from '../models/User';
import { ensureBootstrapAdmin } from '../services/bootstrapAdmin';

jest.mock('../models/User', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() },
}));

const userModelMock = User as unknown as { findOne: jest.Mock; create: jest.Mock };

describe('Production administrator bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates an admin once with a normalized email and hashed password', async () => {
    userModelMock.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    userModelMock.create.mockResolvedValue({});

    await ensureBootstrapAdmin({
      email: ' ADMIN@example.com ',
      password: 'a-long-random-bootstrap-password',
      name: 'Initial Admin',
    });

    expect(userModelMock.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'admin@example.com',
      name: 'Initial Admin',
      role: 'admin',
      passwordHash: expect.not.stringMatching('a-long-random-bootstrap-password'),
    }));
  });

  test('does not overwrite an existing admin or require bootstrap credentials', async () => {
    userModelMock.findOne.mockResolvedValue({ userId: 'USR-EXISTING' });

    await expect(ensureBootstrapAdmin({})).resolves.toBeUndefined();
    expect(userModelMock.create).not.toHaveBeenCalled();
  });

  test('rejects a short password before creating an admin', async () => {
    userModelMock.findOne.mockResolvedValueOnce(null);

    await expect(ensureBootstrapAdmin({
      email: 'admin@example.com',
      password: 'too-short',
      name: 'Admin',
    })).rejects.toThrow('at least 16 characters');
    expect(userModelMock.create).not.toHaveBeenCalled();
  });
});