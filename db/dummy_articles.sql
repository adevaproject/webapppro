-- db/dummy_articles.sql

-- Hapus data jika ada (opsional, untuk testing berulang)
-- DELETE FROM articles WHERE slug LIKE 'dummy-%'; 

-- Artikel 1: Bisnis
INSERT INTO articles (slug, title, excerpt, content, category, status, published_at, meta_title) VALUES
('dummy-strategi-bisnis-2025', 
'Strategi Bisnis Online Paling Ampuh untuk Tahun 2025', 
'Pelajari 5 taktik wajib untuk mendominasi pasar digital.', 
'Konten detail tentang SEO, Social Media Marketing, dan Email Marketing...', 
'bisnis', 'published', DATETIME('now', '-5 day'), 
'Strategi Bisnis 2025 | WebApp Pro');

-- Artikel 2: Bisnis
INSERT INTO articles (slug, title, excerpt, content, category, status, published_at, meta_title) VALUES
('dummy-memulai-startup-dari-nol', 
'Panduan Lengkap Memulai Startup dari Nol Tanpa Modal Besar', 
'Langkah-langkah praktis untuk membangun pondasi bisnis teknologi.', 
'Mencakup ide validasi, MVP, dan mencari pendanaan awal...', 
'bisnis', 'published', DATETIME('now', '-3 day'), 
'Memulai Startup | WebApp Pro');

-- Artikel 3: Teknologi
INSERT INTO articles (slug, title, excerpt, content, category, status, published_at, meta_title) VALUES
('dummy-review-hono-workers-d1', 
'Review Jujur Hono, Cloudflare Workers, dan D1: Kombinasi Terbaik?', 
'Kami mengulas kelebihan dan kekurangan menggunakan stack serverless ini.', 
'Performa, biaya, dan kemudahan deployment menjadi fokus utama review...', 
'teknologi', 'published', DATETIME('now', '-2 day'), 
'Review Hono D1 | WebApp Pro');

-- Artikel 4: Draft (Tidak akan muncul di endpoint publik)
INSERT INTO articles (slug, title, excerpt, content, category, status) VALUES
('dummy-postingan-masih-draft', 
'Ide Postingan yang Masih dalam Tahap Konsep', 
'Ini adalah contoh data yang statusnya masih draft.', 
'Konten ini hanya bisa dilihat melalui endpoint admin.', 
'personal', 'draft');