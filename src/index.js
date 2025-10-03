// src/index.js

import { Hono } from 'hono'
const app = new Hono()

// ===================================
// Middleware API Key (untuk endpoint admin)
// ===================================
/**
 * Middleware untuk memverifikasi API Key.
 * API Key diharapkan ada di Header: X-API-Key.
 * @param {import('hono').Context} c
 * @param {import('hono').Next} next
 */
const authMiddleware = async (c, next) => {
  const env = c.env;
  
  const apiKeyHeader = c.req.header('X-API-Key');
  
  if (!apiKeyHeader || apiKeyHeader !== env.WEBAPP_APIKEY) {
    return c.json({ 
      success: false, 
      message: 'Unauthorized: Invalid or missing X-API-Key in header' 
    }, 401);
  }
  
  await next();
};

/**
 * Utility: Membuat excerpt dari konten markdown.
 * @param {string} content - Konten artikel (Markdown).
 * @returns {string} Potongan 150 karakter pertama.
 */
const createExcerpt = (content) => {
    if (!content) return null;
    // Hapus karakter markdown dasar seperti #, *, -, >, [, ]
    const cleanText = content.replace(/[\#\*\-\>\[\]\n]/g, '').trim();
    // Ambil 150 karakter pertama
    return cleanText.substring(0, 150) + (cleanText.length > 150 ? '...' : '');
};


// ===================================
// Endpoint Publik: Articles
// ===================================

/**
 * Endpoint: GET /api/articles
 * Daftar artikel dengan pagination dan filter
 * Query: page, size, category
 */
app.get('/api/articles', async (c) => {
  /** @type {Env} */
  const env = c.env
  const { searchParams } = c.req.url ? new URL(c.req.url) : { searchParams: new URLSearchParams() }
  
  const page = parseInt(searchParams.get('page')) || 1
  const size = parseInt(searchParams.get('size')) || 10
  const category = searchParams.get('category')
  
  const offset = (page - 1) * size
  
  let query = `
    SELECT id, slug, title, excerpt, featured_image, category, author, published_at, created_at, updated_at 
    FROM articles 
    WHERE status = 'published'
  `
  const params = []

  if (category) {
    query += ' AND category = ?'
    params.push(category)
  }
  
  query += `
    ORDER BY published_at DESC 
    LIMIT ? 
    OFFSET ?
  `
  params.push(size, offset)
  
  try {
    const { results } = await env.DB.prepare(query).bind(...params).all()
    
    // Hitung total artikel (untuk total_pages)
    let countQuery = `SELECT COUNT(id) as total FROM articles WHERE status = 'published'`
    const countParams = []
    if (category) {
      countQuery += ' AND category = ?'
      countParams.push(category)
    }
    
    const { results: countResults } = await env.DB.prepare(countQuery).bind(...countParams).all()
    const totalArticles = countResults[0].total
    const totalPages = Math.ceil(totalArticles / size)
    
    return c.json({
      success: true,
      data: results,
      pagination: {
        page: page,
        size: size,
        total_items: totalArticles,
        total_pages: totalPages,
        category: category || null
      }
    })
  } catch (error) {
    console.error('Error fetching articles:', error)
    return c.json({ success: false, message: 'Failed to fetch articles' }, 500)
  }
})

/**
 * Endpoint: GET /api/articles/:slug
 * Detail artikel berdasarkan slug
 * Note: Mengembalikan FULL content
 */
app.get('/api/articles/:slug', async (c) => {
  /** @type {Env} */
  const env = c.env
  const slug = c.req.param('slug')
  
  try {
    const query = `
      SELECT * FROM articles 
      WHERE slug = ? AND status = 'published' 
      LIMIT 1
    `
    const { results } = await env.DB.prepare(query).bind(slug).all()

    if (results.length === 0) {
      return c.json({ success: false, message: 'Article not found or not published' }, 404)
    }
    
    return c.json({ success: true, data: results[0] })
  } catch (error) {
    console.error('Error fetching article by slug:', error)
    return c.json({ success: false, message: 'Failed to fetch article' }, 500)
  }
})

// ===================================
// Endpoint Admin Group (CRUD)
// Path: /api/admin/articles
// ===================================
const adminArticles = new Hono()
adminArticles.use(authMiddleware) // Terapkan API Key Middleware untuk semua endpoint di group ini

/**
 * Endpoint: POST /api/admin/articles
 * Menambah artikel baru (ADD).
 * Body: { slug, title, content, ... }
 */
adminArticles.post('/articles', async (c) => {
  /** @type {Env} */
  const env = c.env
  let body;
  try {
    // Payload dari Apps Script sudah disederhanakan
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON payload received.' }, 400);
  }
  
  const { slug, title, content, featured_image, category, author, status, meta_title, meta_description } = body
  
  // 1. Validasi
  if (!slug || !title || !content) {
    return c.json({ success: false, message: 'Validation failed: slug, title, and content are required.' }, 400)
  }
  
  // 2. Data Otomatis & Derived
  const published_at = (status && status.toLowerCase() === 'published') ? new Date().toISOString() : null
  const excerpt = createExcerpt(content) // EXCERPT diambil dari content
  const currentTimestamp = new Date().toISOString()

  try {
    const query = `
      INSERT INTO articles (slug, title, excerpt, content, featured_image, category, author, status, published_at, meta_title, meta_description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    await env.DB.prepare(query).bind(
      slug, 
      title, 
      excerpt, // Nilai EXCERPT
      content, 
      featured_image || null, 
      category || null, 
      author || 'Admin', 
      status || 'draft', 
      published_at, 
      meta_title || null, 
      meta_description || null,
      currentTimestamp,
      currentTimestamp
    ).run()
    
    return c.json({ success: true, message: 'Article added successfully', slug })
  } catch (error) {
    console.error('Error adding article:', error)
    if (error.message && error.message.includes('UNIQUE constraint failed: articles.slug')) {
       return c.json({ success: false, message: `Failed to add article: SLUG '${slug}' already exists.` }, 409)
    }
    return c.json({ success: false, message: `Error adding article: ${error.message}` }, 500)
  }
})

/**
 * Endpoint: PUT /api/admin/articles
 * Mengubah artikel (UPDATE). Slug diambil dari Body.
 * Body: { slug, title, content, ... }
 */
adminArticles.put('/articles', async (c) => {
  /** @type {Env} */
  const env = c.env
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON payload received.' }, 400);
  }

  const { slug, title, content, featured_image, category, author, status, meta_title, meta_description } = body
  const targetSlug = slug // Ambil slug dari body untuk UPDATE

  if (!targetSlug) {
    return c.json({ success: false, message: 'Missing required field: slug in body for update' }, 400)
  }

  // Ambil data artikel yang sudah ada untuk cek `published_at`
  const existingArticle = await env.DB.prepare('SELECT status, published_at FROM articles WHERE slug = ?').bind(targetSlug).first()
  if (!existingArticle) {
    return c.json({ success: false, message: 'Article not found' }, 404)
  }

  let updateParams = []
  let setClauses = []

  // Tentukan status baru (jika ada di body)
  const newStatus = (status && status.toLowerCase()) || existingArticle.status;
  
  // === LOGIKA PUBLISHED_AT ===
  let publishedAtValue = existingArticle.published_at;
  
  if (newStatus === 'published' && !existingArticle.published_at) {
    // Jika status diubah ke 'published' DAN belum pernah dipublikasikan, set tanggal sekarang
    publishedAtValue = new Date().toISOString()
  } else if (newStatus !== 'published' && existingArticle.published_at) {
    // Jika status diubah dari published ke draft/lainnya, reset tanggal
    publishedAtValue = null
  }
  
  setClauses.push('published_at = ?')
  updateParams.push(publishedAtValue)
  
  // === LOGIKA EXCERPT (Di-derive dari CONTENT jika CONTENT berubah) ===
  let excerptValue = existingArticle.excerpt;
  if (content !== undefined) {
      excerptValue = createExcerpt(content);
      setClauses.push('excerpt = ?')
      updateParams.push(excerptValue)
  }
  
  // Siapkan kolom dan parameter untuk update
  const fields = { title, content, featured_image, category, author, status: newStatus, meta_title, meta_description }
  
  for (const [key, value] of Object.entries(fields)) {
    // Kita skip slug karena digunakan di WHERE clause, dan kita skip content/excerpt/published_at karena sudah di-handle di atas
    if (value !== undefined && key !== 'content') {
      setClauses.push(`${key} = ?`)
      updateParams.push(value)
    }
  }
  
  // Tambahkan CONTENT jika ada perubahan
  if (content !== undefined) {
      setClauses.push('content = ?')
      updateParams.push(content)
  }


  if (setClauses.length <= 1) { // 1 karena published_at selalu masuk
    return c.json({ success: false, message: 'No valid fields provided for update' }, 400)
  }
  
  setClauses.push('updated_at = CURRENT_TIMESTAMP')
  
  const query = `
    UPDATE articles 
    SET ${setClauses.join(', ')} 
    WHERE slug = ?
  `
  updateParams.push(targetSlug)

  try {
    const result = await env.DB.prepare(query).bind(...updateParams).run()
    
    if (result.changes === 0) {
      return c.json({ success: false, message: 'Article not found or no changes applied' }, 404)
    }
    
    return c.json({ success: true, message: 'Article updated successfully', slug: targetSlug })
  } catch (error) {
    console.error('Error updating article:', error)
    return c.json({ success: false, message: `Failed to update article: ${error.message}` }, 500)
  }
})

/**
 * Endpoint: DELETE /api/admin/articles
 * Menghapus artikel (DELETE). Slug diambil dari Body.
 * Body: { slug, ... }
 */
adminArticles.delete('/articles', async (c) => {
  /** @type {Env} */
  const env = c.env
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON payload received.' }, 400);
  }
  
  const { slug } = body // Ambil slug dari body
  
  if (!slug) {
      return c.json({ success: false, message: 'Missing required field: slug in body for delete' }, 400)
  }
  
  try {
    const query = `DELETE FROM articles WHERE slug = ?`
    const result = await env.DB.prepare(query).bind(slug).run()
    
    if (result.changes === 0) {
      return c.json({ success: false, message: 'Article not found' }, 404)
    }
    
    return c.json({ success: true, message: 'Article deleted successfully', slug })
  } catch (error) {
    console.error('Error deleting article:', error)
    return c.json({ success: false, message: 'Failed to delete article' }, 500)
  }
})


// ===================================
// Grouping Routes dan Export
// ===================================

// Rute ADMIN sekarang menuju /api/admin/articles/{POST/PUT/DELETE}
app.route('/api/admin', adminArticles) // Di sini route di-group

app.get('/api/settings', async (c) => {
  /** @type {Env} */
  const env = c.env
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all()
    
    // Konversi array menjadi objek { key: value }
    const settingsObject = results.reduce((acc, item) => {
      acc[item.key] = item.value
      return acc
    }, {})
    
    return c.json({ success: true, data: settingsObject })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return c.json({ success: false, message: 'Failed to fetch settings' }, 500)
  }
})

app.notFound((c) => {
  return c.json({ success: false, message: 'API Endpoint not found' }, 404)
})

export default app

export * from './index'
