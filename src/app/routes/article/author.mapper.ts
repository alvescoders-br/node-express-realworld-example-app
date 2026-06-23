export interface AuthorMapperInput {
  username: string;
  bio: string | null;
  image: string | null;
  followedBy: Array<{ id: number }>;
}

const authorMapper = (author: AuthorMapperInput, id?: number) => ({
  username: author.username,
  bio: author.bio,
  image: author.image,
  following: id
    ? author.followedBy.some((followingUser) => followingUser.id === id)
    : false,
});

export default authorMapper;
