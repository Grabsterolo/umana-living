import { GITHUB_USER, GITHUB_REPO, ARTICLES_BRANCH } from '../config/site.js';
import { parseArticleMarkdown } from './articles-parser.js';

export async function fetchAllArticlesFromRepo() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/articulos?ref=${ARTICLES_BRANCH}`
  );
  if (!res.ok) throw new Error('No se pudo conectar');
  const files = await res.json();
  if (!Array.isArray(files)) throw new Error('Respuesta inesperada del API');
  const mdFiles = files.filter((f) => f.name.endsWith('.md'));
  if (!mdFiles.length) return [];

  const articles = await Promise.all(
    mdFiles.map(async (f) => {
      const r = await fetch(f.download_url);
      const text = await r.text();
      return parseArticleMarkdown(text, f.name);
    })
  );
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  return articles;
}
