import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import {
  createArticle,
  deleteArticle,
  getArticle,
  getArticles,
  getFeed,
  updateArticle,
} from './article.service';

const router = Router();

/**
 * Get paginated articles
 * @auth optional
 * @route {GET} /articles
 * @queryparam offset number of articles dismissed from the first one
 * @queryparam limit number of articles returned
 * @queryparam tag
 * @queryparam author
 * @queryparam favorited
 * @returns articles: list of articles
 */
router.get(
  '/articles',
  auth.optional,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getArticles(req.query, req.auth?.user?.id);
    res.json(result);
  }),
);

/**
 * Get paginated feed articles
 * @auth required
 * @route {GET} /articles/feed
 * @returns articles list of articles
 */
router.get(
  '/articles/feed',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getFeed(
      Number(req.query.offset),
      Number(req.query.limit),
      req.auth?.user?.id,
    );
    res.json(result);
  }),
);

/**
 * Create article
 * @route {POST} /articles
 * @bodyparam  title
 * @bodyparam  description
 * @bodyparam  body
 * @bodyparam  tagList list of tags
 * @returns article created article
 */
router.post(
  '/articles',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await createArticle(req.body.article, req.auth?.user?.id);
    res.status(201).json({ article });
  }),
);

/**
 * Get unique article
 * @auth optional
 * @route {GET} /article/:slug
 * @param slug slug of the article (based on the title)
 * @returns article
 */
router.get(
  '/articles/:slug',
  auth.optional,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await getArticle(req.params.slug, req.auth?.user?.id);
    res.json({ article });
  }),
);

/**
 * Update article
 * @auth required
 * @route {PUT} /articles/:slug
 * @param slug slug of the article (based on the title)
 * @bodyparam title new title
 * @bodyparam description new description
 * @bodyparam body new content
 * @returns article updated article
 */
router.put(
  '/articles/:slug',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await updateArticle(req.body.article, req.params.slug, req.auth?.user?.id);
    res.json({ article });
  }),
);

/**
 * Delete article
 * @auth required
 * @route {DELETE} /article/:id
 * @param slug slug of the article
 */
router.delete(
  '/articles/:slug',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    await deleteArticle(req.params.slug, req.auth?.user!.id);
    res.sendStatus(204);
  }),
);

export default router;
