import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useBlogPost } from "../hooks.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";

export default function BlogPost() {
  const { slug } = useParams();
  const { post, loading, error } = useBlogPost(slug);

  // Map the post's SEO fields onto the shape usePageHead expects.
  const record = useMemo(() => post && {
    title: post.title,
    seo_title: post.seo_title,
    meta_description: post.seo_description || post.excerpt,
    seo_keywords: post.seo_keywords,
    og_image: post.og_image || post.cover_image,
    noindex: post.noindex,
  }, [post]);
  const jsonLd = useMemo(() => post && {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seo_description || post.excerpt,
    image: post.og_image || post.cover_image || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
  }, [post]);
  usePageHead(record, { type: "article", jsonLd });

  if (loading) return <Loading />;
  if (error) return <PageError error={error} />;

  return (
    <article>
      <header className="page-hero">
        <div className="container article-head">
          <p className="eyebrow gold">
            {post.published_at && new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="h-display">{post.title}</h1>
          {post.excerpt && <p className="lead">{post.excerpt}</p>}
        </div>
      </header>
      {post.cover_image && (
        <div className="container"><img className="article-cover" src={post.cover_image} alt="" /></div>
      )}
      <div className="container article-body">
        <ReactMarkdown>{post.body}</ReactMarkdown>
        <p className="back-link"><Link to="/blog" className="link-arrow">← All articles</Link></p>
      </div>
    </article>
  );
}
