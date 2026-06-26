import prismaMock from '../prisma-mock';
import {
  followUser,
  getProfile,
  unfollowUser,
} from '../../app/routes/profile/profile.service';

const prismaUserMock = prismaMock.user as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
};

const mockUserFindUnique = (value: unknown) => {
  prismaUserMock.findUnique.mockResolvedValue(value);
};

const mockUserUpdate = (value: unknown) => {
  prismaUserMock.update.mockResolvedValue(value);
};

describe('ProfileService', () => {
  describe('getProfile', () => {
    test('should return a following property', async () => {
      // Given
      const username = 'RealWorld';
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
        followedBy: [],
      };

      // When
      mockUserFindUnique(mockedResponse);

      // Then
      await expect(getProfile(username, id)).resolves.toHaveProperty(
        'following'
      );
    });

    test('should throw an error if no user is found', async () => {
      // Given
      const username = 'RealWorld';
      const id = 123;

      // When
      mockUserFindUnique(null);

      // Then
      await expect(getProfile(username, id)).rejects.toThrowError();
    });
  });

  describe('followUser', () => {
    test('shoud return a following property', async () => {
      // Given
      const usernamePayload = 'AnotherUser';
      const id = 123;

      const mockedAuthUser = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
        followedBy: [],
      };

      const mockedResponse = {
        id: 123,
        username: 'AnotherUser',
        email: 'another@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
        followedBy: [],
      };

      // When
      mockUserFindUnique(mockedAuthUser);
      mockUserUpdate(mockedResponse);

      // Then
      await expect(followUser(usernamePayload, id)).resolves.toHaveProperty(
        'following'
      );
    });

    test('shoud throw an error if no user is found', async () => {
      // Given
      const usernamePayload = 'AnotherUser';
      const id = 123;

      // When
      mockUserFindUnique(null);

      // Then
      await expect(followUser(usernamePayload, id)).rejects.toThrowError();
    });
  });

  describe('unfollowUser', () => {
    test('shoud return a following property', async () => {
      // Given
      const usernamePayload = 'AnotherUser';
      const id = 123;

      const mockedAuthUser = {
        id: 123,
        username: 'RealWorld',
        email: 'realworld@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
        followedBy: [],
      };

      const mockedResponse = {
        id: 123,
        username: 'AnotherUser',
        email: 'another@me',
        password: '1234',
        bio: null,
        image: null,
        token: '',
        demo: false,
        followedBy: [],
      };

      // When
      mockUserFindUnique(mockedAuthUser);
      mockUserUpdate(mockedResponse);

      // Then
      await expect(unfollowUser(usernamePayload, id)).resolves.toHaveProperty(
        'following'
      );
    });

    test('shoud throw an error if no user is found', async () => {
      // Given
      const usernamePayload = 'AnotherUser';
      const id = 123;

      // When
      mockUserFindUnique(null);

      // Then
      await expect(unfollowUser(usernamePayload, id)).rejects.toThrowError();
    });
  });
});
