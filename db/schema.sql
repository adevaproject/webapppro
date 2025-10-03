DROP TABLE IF EXISTS articles;
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  featured_image TEXT,
  category TEXT,
  author TEXT DEFAULT 'Admin',
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  meta_title TEXT,
  meta_description TEXT
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published ON articles(published_at);
CREATE INDEX idx_articles_category ON articles(category);


DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);


DROP TABLE IF EXISTS leadmagnets;
CREATE TABLE leadmagnets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  image TEXT,
  status TEXT,
  autores TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);