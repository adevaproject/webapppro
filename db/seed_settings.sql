-- db/seed_settings.sql

INSERT INTO settings (key, value) VALUES
('site.title', 'WebApp Pro'),
('site.description', 'Blog tentang bisnis online'),
('site.language', 'id'),
('site.url', 'https://webapppro.com'),
('posts.per_page', '10'),
('social.facebook', 'https://fb.com/username'),
('social.instagram', 'https://ig.com/username'),
('social.twitter', 'https://twitter.com/username'),
('social.youtube', 'https://youtube.com/username'),
('social.linkedin', 'https://linkedin.com/username'),
('social.github', 'https://github.com/username'),
('social.footer', '2025 &copy; All Right Reserved'),
('seo.meta_author', 'WebApp Pro Team'),
('seo.meta_keywords', 'bisnis online, blog, tutorial'),
('seo.google_analytics', 'GA-XXXXXXXX'),
('seo.google_site_verification', 'xxxxxxxxxxxx'),
('seo.bing_verification', 'xxxxxxxxxxxx'),
('seo.structured_data', 'true'),
('contact.email', 'hello@webapppro.com'),
('contact.phone', '+62-XXX-XXXX-XXXX'),
('contact.address', 'Jakarta, Indonesia'),
('contact.business_hours', 'Senin-Jumat, 09:00-17:00')
ON CONFLICT(key) DO UPDATE SET value=excluded.value;