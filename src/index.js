// src/index.js

import { Hono } from 'hono'
const app = new Hono()

// ===================================
// Middleware API Key (untuk endpoint admin)
// ===================================
/**
 * Middleware untuk memverifikasi API Key.
 * API Key diharapkan ada di body request sebagai { apiKey: '...' }
 * @param {import('hono').Context} c
 * @param {import('hono').Next} next
 */
const authMiddleware = async (c, next) => {
  /** @type {Env} */
  const env = c.env
  const apiKeyBody = await c.req.json().catch(() => ({}))
  
  if (!apiKeyBody.apiKey || apiKeyBody.apiKey !== env.WEBAPP_APIKEY) {
    return c.json({ success: false, message: 'Unauthorized: Invalid or missing API Key' }, 401)
  }
  
  // Lanjut ke handler
  await next()
}


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
    SELECT * FROM articles 
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
 * Endpoint: GET /api/articles/:slug-post
 * Detail artikel berdasarkan slug
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
// Endpoint Admin: Articles (dilindungi API Key)
// ===================================
const adminArticles = new Hono()
adminArticles.use(authMiddleware) // Terapkan API Key Middleware untuk semua endpoint di group ini

/**
 * Endpoint: POST /api/admin/articles/add
 * Menambah artikel baru.
 * Body: { apiKey: '...', slug, title, content, ... }
 */
adminArticles.post('/add', async (c) => {
  /** @type {Env} */
  const env = c.env
  const body = await c.req.json()
  const { slug, title, excerpt, content, featured_image, category, author, status, meta_title, meta_description } = body
  
  if (!slug || !title || !content) {
    return c.json({ success: false, message: 'Missing required fields: slug, title, content' }, 400)
  }
  
  const published_at = (status === 'published' && !body.published_at) ? new Date().toISOString() : (body.published_at || null)

  try {
    const query = `
      INSERT INTO articles (slug, title, excerpt, content, featured_image, category, author, status, published_at, meta_title, meta_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    await env.DB.prepare(query).bind(
      slug, title, excerpt, content, featured_image, 
      category, author || 'Admin', status || 'draft', published_at, 
      meta_title, meta_description
    ).run()
    
    return c.json({ success: true, message: 'Article added successfully', slug })
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed: articles.slug')) {
       return c.json({ success: false, message: 'Slug already exists' }, 409)
    }
    console.error('Error adding article:', error)
    return c.json({ success: false, message: 'Failed to add article' }, 500)
  }
})

/**
 * Endpoint: PUT /api/admin/articles/put/:slug
 * Mengubah artikel berdasarkan slug.
 * Body: { apiKey: '...', title, content, ... }
 */
adminArticles.put('/put/:slug', async (c) => {
  /** @type {Env} */
  const env = c.env
  const targetSlug = c.req.param('slug')
  const body = await c.req.json()
  
  // Ambil hanya kolom yang relevan untuk update
  const { title, excerpt, content, featured_image, category, author, status, meta_title, meta_description } = body

  if (!title && !content) {
    return c.json({ success: false, message: 'No fields to update provided' }, 400)
  }

  // Tentukan published_at. Jika status diubah jadi 'published' dan belum ada tanggal publish, set sekarang.
  let published_at_clause = ''
  let published_at_value = null
  let updateParams = []
  let setClauses = []

  // Ambil data artikel yang sudah ada untuk cek `published_at`
  const existingArticle = await env.DB.prepare('SELECT status, published_at FROM articles WHERE slug = ?').bind(targetSlug).first()
  if (!existingArticle) {
    return c.json({ success: false, message: 'Article not found' }, 404)
  }

  const newStatus = status || existingArticle.status;
  
  if (newStatus === 'published' && !existingArticle.published_at) {
    published_at_value = new Date().toISOString()
    setClauses.push('published_at = ?')
    updateParams.push(published_at_value)
  } else if (newStatus !== 'published' && existingArticle.published_at) {
    // Jika status diubah dari published ke draft/lainnya, reset published_at
    setClauses.push('published_at = ?')
    updateParams.push(null) 
  }

  // Siapkan kolom dan parameter untuk update
  const fields = { title, excerpt, content, featured_image, category, author, status, meta_title, meta_description }
  
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`)
      updateParams.push(value)
    }
  }

  if (setClauses.length === 0) {
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
    return c.json({ success: false, message: 'Failed to update article' }, 500)
  }
})

/**
 * Endpoint: DELETE /api/admin/articles/delete/:slug
 * Menghapus artikel berdasarkan slug
 * Body: { apiKey: '...' }
 */
adminArticles.delete('/delete/:slug', async (c) => {
  /** @type {Env} */
  const env = c.env
  const slug = c.req.param('slug')
  
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

app.route('/api/admin/articles', adminArticles)

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