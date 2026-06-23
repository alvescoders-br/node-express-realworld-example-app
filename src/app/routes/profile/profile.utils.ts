import { User } from '../auth/user.model';
import { Profile } from './profile.model';

type ProfileMapperInput = Pick<User, 'username' | 'bio' | 'image'> & {
  followedBy: Pick<User, 'id'>[];
};

const profileMapper = (user: ProfileMapperInput, id: number | undefined): Profile => ({
  username: user.username,
  bio: user.bio,
  image: user.image,
  following: id
    ? user.followedBy.some((followingUser) => followingUser.id === id)
    : false,
});

export default profileMapper;
