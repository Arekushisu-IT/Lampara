const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');

const router = express.Router();

// All community routes require player authentication
router.use(verifyToken);

// ============================================================
// GET /api/community/feed — Paginated community feed
// ============================================================
router.get('/feed', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 50);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);
    const playerId = req.user.id;

    const [posts] = await pool.query(`
      SELECT
        cp.id,
        cp.content,
        cp.likes_count,
        cp.comments_count,
        cp.created_at,
        p.id AS author_id,
        p.name AS author_name,
        p.username AS author_username,
        p.chapter AS author_chapter,
        EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = cp.id AND pl.player_id = ?) AS liked_by_me
      FROM community_posts cp
      JOIN players p ON cp.player_id = p.id
      WHERE p.status = 'active'
      ORDER BY cp.created_at DESC
      LIMIT ? OFFSET ?
    `, [playerId, parsedLimit, parsedOffset]);

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM community_posts cp JOIN players p ON cp.player_id = p.id WHERE p.status = ?',
      ['active']
    );

    res.json({
      success: true,
      posts: posts.map(p => ({
        ...p,
        liked_by_me: !!p.liked_by_me
      })),
      pagination: { limit: parsedLimit, offset: parsedOffset, total }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/community/posts — Create a new post
// ============================================================
router.post('/posts', async (req, res, next) => {
  try {
    const { content } = req.body;
    const playerId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const trimmed = content.trim();
    if (trimmed.length > 1000) {
      return res.status(400).json({ error: 'Post must be under 1000 characters' });
    }

    const [result] = await pool.query(
      'INSERT INTO community_posts (player_id, content) VALUES (?, ?)',
      [playerId, trimmed]
    );

    // Fetch the created post with author info
    const [[post]] = await pool.query(`
      SELECT cp.id, cp.content, cp.likes_count, cp.comments_count, cp.created_at,
             p.id AS author_id, p.name AS author_name, p.username AS author_username, p.chapter AS author_chapter
      FROM community_posts cp JOIN players p ON cp.player_id = p.id
      WHERE cp.id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, post: { ...post, liked_by_me: false } });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/community/posts/:id/like — Toggle like
// ============================================================
router.post('/posts/:id/like', async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id);
    const playerId = req.user.id;

    // Check post exists
    const [[post]] = await pool.query('SELECT id, player_id FROM community_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Check if already liked
    const [existing] = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = ? AND player_id = ?',
      [postId, playerId]
    );

    let liked;
    if (existing.length > 0) {
      // Unlike
      await pool.query('DELETE FROM post_likes WHERE post_id = ? AND player_id = ?', [postId, playerId]);
      await pool.query('UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?', [postId]);
      liked = false;
    } else {
      // Like
      await pool.query('INSERT INTO post_likes (post_id, player_id) VALUES (?, ?)', [postId, playerId]);
      await pool.query('UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);
      liked = true;

      // Send notification to post owner (don't notify self)
      if (Number(post.player_id) !== Number(playerId)) {
        const [[liker]] = await pool.query('SELECT name FROM players WHERE id = ?', [playerId]);
        await pool.query(
          'INSERT INTO notifications (player_id, type, message, reference_id) VALUES (?, ?, ?, ?)',
          [post.player_id, 'like', `${liker.name} liked your post`, postId]
        );
      }
    }

    const [[updated]] = await pool.query('SELECT likes_count FROM community_posts WHERE id = ?', [postId]);

    res.json({ success: true, liked, likes_count: updated.likes_count });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/community/posts/:id/comments — Get comments
// ============================================================
router.get('/posts/:id/comments', async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id);

    const [comments] = await pool.query(`
      SELECT pc.id, pc.content, pc.created_at,
             p.id AS author_id, p.name AS author_name, p.username AS author_username
      FROM post_comments pc
      JOIN players p ON pc.player_id = p.id
      WHERE pc.post_id = ?
      ORDER BY pc.created_at ASC
    `, [postId]);

    res.json({ success: true, comments });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/community/posts/:id/comments — Add comment
// ============================================================
router.post('/posts/:id/comments', async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id);
    const playerId = req.user.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const trimmed = content.trim();
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'Comment must be under 500 characters' });
    }

    // Check post exists
    const [[post]] = await pool.query('SELECT id, player_id FROM community_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const [result] = await pool.query(
      'INSERT INTO post_comments (post_id, player_id, content) VALUES (?, ?, ?)',
      [postId, playerId, trimmed]
    );

    // Update comments count
    await pool.query('UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = ?', [postId]);

    // Send notification to post owner (don't notify self)
    if (Number(post.player_id) !== Number(playerId)) {
      const [[commenter]] = await pool.query('SELECT name FROM players WHERE id = ?', [playerId]);
      await pool.query(
        'INSERT INTO notifications (player_id, type, message, reference_id) VALUES (?, ?, ?, ?)',
        [post.player_id, 'comment', `${commenter.name} commented on your post`, postId]
      );
    }

    // Fetch created comment with author info
    const [[comment]] = await pool.query(`
      SELECT pc.id, pc.content, pc.created_at,
             p.id AS author_id, p.name AS author_name, p.username AS author_username
      FROM post_comments pc JOIN players p ON pc.player_id = p.id
      WHERE pc.id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, comment });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DELETE /api/community/posts/:id — Delete own post
// ============================================================
router.delete('/posts/:id', async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id);
    const playerId = req.user.id;

    const [[post]] = await pool.query('SELECT id, player_id FROM community_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Only owner or admin can delete
    if (Number(post.player_id) !== Number(playerId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await pool.query('DELETE FROM community_posts WHERE id = ?', [postId]);

    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/community/posts/player/:playerId — Get player posts
// ============================================================
router.get('/posts/player/:playerId', async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.playerId);
    const playerId = req.user.id;

    const [posts] = await pool.query(`
      SELECT cp.id, cp.content, cp.likes_count, cp.comments_count, cp.created_at,
             p.id AS author_id, p.name AS author_name, p.username AS author_username, p.chapter AS author_chapter,
             EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = cp.id AND pl.player_id = ?) AS liked_by_me
      FROM community_posts cp JOIN players p ON cp.player_id = p.id
      WHERE cp.player_id = ?
      ORDER BY cp.created_at DESC
      LIMIT 50
    `, [playerId, targetId]);

    res.json({
      success: true,
      posts: posts.map(p => ({ ...p, liked_by_me: !!p.liked_by_me }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
