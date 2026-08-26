export type DocArticleMeta = {
  slug: string;
  title: string;
  description: string;
  section: string;
  order: number;
};

export type DocArticle = DocArticleMeta & {
  content: string;
};

export type DocSection = {
  section: string;
  order: number;
  articles: DocArticleMeta[];
};
