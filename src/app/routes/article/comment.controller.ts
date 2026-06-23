import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import { addComment, deleteComment, getCommentsByArticle } from './comment.service';

const router = Router();

/**
 * Get comments from an article
 * @auth optional
 * @route {GET} /articles/:slug/comments
 * @param slug slug of the article (based on the title)
 * @returns comments list of comments
 */
router.get(
  '/articles/:slug/comments',
  auth.optional,
  asyncHandler(async (req: Request, res: Response) => {
    const comments = await getCommentsByArticle(req.params.slug, req.auth?.user?.id);
    res.json({ comments });
  }),
);

/**
 * Add comment to article
 * @auth required
 * @route {POST} /articles/:slug/comments
 * @param slug slug of the article (based on the title)
 * @bodyparam body content of the comment
 * @returns comment created comment
 */
router.post(
  '/articles/:slug/comments',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const comment = await addComment(req.body.comment.body, req.params.slug, req.auth?.user?.id);
    res.json({ comment });
  }),
);

/**
 * Delete comment
 * @auth required
 * @route {DELETE} /articles/:slug/comments/:id
 * @param slug slug of the article (based on the title)
 * @param id id of the comment
 */
router.delete(
  '/articles/:slug/comments/:id',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    await deleteComment(Number(req.params.id), req.auth?.user?.id);
    res.status(200).json({});
  }),
);

export default router;
