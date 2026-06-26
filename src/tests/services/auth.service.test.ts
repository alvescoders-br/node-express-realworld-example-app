import * as bcrypt from 'bcryptjs';
import prismaMock from '../prisma-mock';
import {
  createUser,
  getCurrentUser,
  login,
  updateUser,
} from '../../app/routes/auth/auth.service';

const prismaUserMock = prismaMock.user as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
};

const mockUserFindUnique = (value: unknown) => {
  prismaUserMock.findUnique.mockResolvedValue(value);
};

const mockUserCreate = (value: unknown) => {
  prismaUserMock.create.mockResolvedValue(value);
};

const mockUserUpdate = (value: unknown) => {
  prismaUserMock.update.mockResolvedValue(value);
};

describe('AuthService', () => {
  beforeEach(() => {
    mockUserFindUnique(null);
  });

  describe('createUser', () => {
    test('should create new user ', async () => {
      // Given
      const user = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
      };

      const mockedResponse = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
      };

      // When
      mockUserCreate(mockedResponse);

      // Then
      await expect(createUser(user)).resolves.toHaveProperty('token');
    });

    test('should throw an error when creating new user with empty username ', async () => {
      // Given
      const user = {
        id: 123,
        username: ' ',
        email: 'realworld@me',
        password: '1234',
      };

      // Then
      await expect(createUser(user)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { username: ["can't be blank"] } },
      });
    });

    test('should throw an error when creating new user with empty email ', async () => {
      // Given
      const user = {
        id: 123,
        username: 'RealWorld',
        email: '  ',
        password: '1234',
      };

      // Then
      await expect(createUser(user)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { email: ["can't be blank"] } },
      });
    });

    test('should throw an error when creating new user with empty password ', async () => {
      // Given
      const user = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: ' ',
      };

      // Then
      await expect(createUser(user)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { password: ["can't be blank"] } },
      });
    });

    test('should throw an exception when creating a new user with already existing user on same username ', async () => {
      // Given
      const user = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
      };

      const mockedExistingUser = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
      };

      // When
      mockUserFindUnique(mockedExistingUser);

      // Then
      await expect(createUser(user)).rejects.toMatchObject({
        errorCode: 422,
        response: {
          errors: {
            email: ['has already been taken'],
            username: ['has already been taken'],
          },
        },
      });
    });
  });

  describe('login', () => {
    test('should return a token', async () => {
      // Given
      const user = {
        email: 'realworld@me',
        password: '1234',
      };

      const hashedPassword = await bcrypt.hash(user.password, 10);

      const mockedResponse = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: hashedPassword,
        bio: null,
        image: null,
        token: '',
        demo: false,
      };

      // When
      mockUserFindUnique(mockedResponse);

      // Then
      await expect(login(user)).resolves.toHaveProperty('token');
    });

    test('should throw an error when the email is empty', async () => {
      // Given
      const user = {
        email: ' ',
        password: '1234',
      };

      // Then
      await expect(login(user)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { email: ["can't be blank"] } },
      });
    });

    test('should throw an error when the password is empty', async () => {
      // Given
      const user = {
        email: 'realworld@me',
        password: ' ',
      };

      // Then
      await expect(login(user)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { password: ["can't be blank"] } },
      });
    });

    test('should throw an error when no user is found', async () => {
      // Given
      const user = {
        email: 'realworld@me',
        password: '1234',
      };

      // When
      mockUserFindUnique(null);

      // Then
      await expect(login(user)).rejects.toMatchObject({
        errorCode: 403,
        response: { errors: { 'email or password': ['is invalid'] } },
      });
    });

    test('should throw an error if the password is wrong', async () => {
      // Given
      const user = {
        email: 'realworld@me',
        password: '1234',
      };

      const hashedPassword = await bcrypt.hash('4321', 10);

      const mockedResponse = {
        id: 123,
        username: 'Gerome',
        email: 'realworld@me',
        password: hashedPassword,
        bio: null,
        image: null,
        token: '',
        demo: false,
      };

      // When
      mockUserFindUnique(mockedResponse);

      // Then
      await expect(login(user)).rejects.toMatchObject({
        errorCode: 403,
        response: { errors: { 'email or password': ['is invalid'] } },
      });
    });
  });

  describe('getCurrentUser', () => {
    test('should return a token', async () => {
      // Given
      const id = 123;

      const mockedResponse = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
      };

      // When
      mockUserFindUnique(mockedResponse);

      // Then
      await expect(getCurrentUser(id)).resolves.toHaveProperty('token');
    });
  });

  describe('updateUser', () => {
    test('should return a token', async () => {
      // Given
      const user = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
      };

      const mockedResponse = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
      };

      // When
      mockUserUpdate(mockedResponse);

      // Then
      await expect(updateUser(user, user.id)).resolves.toHaveProperty('token');
    });
  });
});
