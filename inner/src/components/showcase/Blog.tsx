'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCmsCollection, mediaUrl } from '../../api';
import { CmsBlogPost } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import ClosingCta from './ClosingCta';
import './landing.css';

const BLOG_PARAMS = { depth: '2' };

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
} as const;

const formatDate = (iso: string, locale: string) =>
    new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

interface PostCardProps {
    post: CmsBlogPost;
    onOpen: (slug: string) => void;
    locale: string;
    index: number;
}

const PostCard: React.FC<PostCardProps> = ({ post, onOpen, locale, index }) => {
    const imgSrc = mediaUrl(post.featuredImage ?? null, 'card');
    const author =
        post.author && typeof post.author !== 'number' ? post.author : null;
    const project =
        post.project && typeof post.project !== 'number' ? post.project : null;

    return (
        <motion.div
            className="lp-post"
            onClick={() => onOpen(post.slug)}
            {...reveal}
            transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3) }}
        >
            {imgSrc && (
                <div className="lp-post__thumb">
                    <img
                        src={imgSrc}
                        alt={post.featuredImage?.alt ?? post.title}
                    />
                </div>
            )}
            <div className="lp-post__body">
                <h2 className="lp-post__title">{post.title}</h2>
                <div className="lp-post__meta">
                    {author && <span>by {author.name}</span>}
                    <span>{formatDate(post.publishedAt, locale)}</span>
                    {project && (
                        <span className="proj">Re: {project.title}</span>
                    )}
                </div>
                <p className="lp-post__excerpt">{post.excerpt}</p>
                {post.tags && post.tags.length > 0 && (
                    <div className="lp-pills">
                        {post.tags.map((tg) => (
                            <span key={tg.tag} className="lp-pill">
                                {tg.tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const Blog: React.FC<{ posts?: CmsBlogPost[] | null }> = (props) => {
    const { data: posts, loading } = useCmsCollection<CmsBlogPost>(
        'blog-posts',
        BLOG_PARAMS,
        props.posts
    );
    const router = useRouter();
    const { t, locale } = useLanguage();

    const [search, setSearch] = useState('');
    const [activeTag, setActiveTag] = useState<string | null>(null);

    const allTags = Array.from(
        new Set(
            (posts ?? []).flatMap((p) => (p.tags ?? []).map((tg) => tg.tag))
        )
    ).sort();

    const filtered = (posts ?? [])
        .filter(
            (p) => !activeTag || (p.tags ?? []).some((tg) => tg.tag === activeTag)
        )
        .filter((p) => {
            if (!search) return true;
            const q = search.toLowerCase();
            const authorName =
                p.author && typeof p.author !== 'number' ? p.author.name : '';
            return (
                p.title.toLowerCase().includes(q) ||
                p.excerpt.toLowerCase().includes(q) ||
                authorName.toLowerCase().includes(q)
            );
        })
        .sort(
            (a, b) =>
                new Date(b.publishedAt).getTime() -
                new Date(a.publishedAt).getTime()
        );

    return (
        <div className="lp">
            <div className="lp-page">
            <div className="lp-inner">
                <motion.div
                    className="lp-page__head"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <p className="lp-kicker">{t.blog.subtitle}</p>
                    <h1 className="lp-page__title">{t.blog.title}</h1>
                </motion.div>

                {loading ? (
                    <p className="lp-loading">Loading…</p>
                ) : (
                    <>
                        <div className="lp-blog-controls">
                            <input
                                type="text"
                                className="lp-search"
                                placeholder={t.blog.searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {allTags.length > 0 && (
                                <div className="lp-tags">
                                    <button
                                        className={
                                            'lp-tag-btn' +
                                            (activeTag === null
                                                ? ' lp-tag-btn--active'
                                                : '')
                                        }
                                        onClick={() => setActiveTag(null)}
                                    >
                                        {t.blog.all}
                                    </button>
                                    {allTags.map((tag) => (
                                        <button
                                            key={tag}
                                            className={
                                                'lp-tag-btn' +
                                                (activeTag === tag
                                                    ? ' lp-tag-btn--active'
                                                    : '')
                                            }
                                            onClick={() =>
                                                setActiveTag(
                                                    activeTag === tag
                                                        ? null
                                                        : tag
                                                )
                                            }
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="lp-posts">
                            {filtered.map((post, i) => (
                                <PostCard
                                    key={post.id}
                                    post={post}
                                    index={i}
                                    onOpen={(slug) => router.push(`/blog/${slug}`)}
                                    locale={locale}
                                />
                            ))}
                            {filtered.length === 0 && (
                                <p className="lp-empty">{t.blog.noPosts}</p>
                            )}
                        </div>
                    </>
                )}
            </div>
            </div>
            <ClosingCta />
        </div>
    );
};

export default Blog;
