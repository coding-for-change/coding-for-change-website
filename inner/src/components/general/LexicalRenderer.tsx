import React from 'react';
import { LexicalNode, LexicalDocument } from '../../api/types';
import { mediaUrl } from '../../api';

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

function renderText(node: LexicalNode, key: string): React.ReactNode {
    const text = node.text ?? '';
    // format is a bitmask; the shared LexicalNode type allows string|number, so coerce.
    const fmt = typeof node.format === 'number' ? node.format : 0;
    let el: React.ReactNode = text;
    if (fmt & FORMAT_CODE) {
        el = (
            <code key={key} style={{ fontFamily: 'monospace', backgroundColor: '#e8e8e8', padding: '1px 4px', border: '1px solid #c0c0c0', fontSize: '0.9em' }}>
                {text}
            </code>
        );
        return el;
    }
    if (fmt & FORMAT_BOLD) el = <strong>{el}</strong>;
    if (fmt & FORMAT_ITALIC) el = <em>{el}</em>;
    if (fmt & FORMAT_STRIKETHROUGH) el = <del>{el}</del>;
    if (fmt & FORMAT_UNDERLINE) el = <u>{el}</u>;
    return <span key={key}>{el}</span>;
}

function renderNode(node: LexicalNode, key: string): React.ReactNode {
    const children = (node.children ?? []).map((child, i) => renderNode(child, `${key}-${i}`));

    switch (node.type) {
        case 'root':
            return (
                <div key={key} style={{ flexDirection: 'column' }}>
                    {children}
                </div>
            );
        case 'paragraph':
            return <p key={key} style={{ marginBottom: 16, marginTop: 0 }}>{children}</p>;
        case 'heading': {
            const Tag = (node.tag ?? 'h2') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            return <Tag key={key}>{children}</Tag>;
        }
        case 'text':
            return renderText(node, key);
        case 'linebreak':
            return <br key={key} />;
        case 'link': {
            const href = node.fields?.url ?? (node as any).url ?? '#';
            return (
                <a key={key} href={href} target={node.fields?.newTab ? '_blank' : undefined} rel="noreferrer" style={{ color: '#0000a3' }}>
                    {children}
                </a>
            );
        }
        case 'list': {
            const Tag = node.listType === 'number' ? 'ol' : 'ul';
            return <Tag key={key} style={{ paddingLeft: 24, marginBottom: 16 }}>{children}</Tag>;
        }
        case 'listitem':
            return <li key={key} style={{ marginBottom: 4 }}>{children}</li>;
        case 'quote':
            return (
                <blockquote key={key} style={{ borderLeft: '3px solid #808080', paddingLeft: 16, marginLeft: 0, fontStyle: 'italic', color: '#555', marginBottom: 16 }}>
                    {children}
                </blockquote>
            );
        case 'horizontalrule':
            return <hr key={key} style={{ border: 'none', borderTop: '1px solid #888', margin: '16px 0', width: '100%' }} />;
        case 'upload': {
            const val = node.value;
            if (!val?.url) return null;
            const src = val.url.startsWith('http') ? val.url : mediaUrl(val as any, 'large');
            if (val.mimeType?.startsWith('video/')) {
                return (
                    <video key={key} controls style={{ maxWidth: '100%', marginBottom: 16 }}>
                        <source src={src ?? undefined} type={val.mimeType} />
                    </video>
                );
            }
            return (
                <img key={key} src={src ?? undefined} alt={val.alt ?? ''} style={{ maxWidth: '100%', marginBottom: 16, display: 'block' }} />
            );
        }
        default:
            return children.length > 0 ? <React.Fragment key={key}>{children}</React.Fragment> : null;
    }
}

interface LexicalRendererProps {
    doc: LexicalDocument;
    style?: React.CSSProperties;
}

const LexicalRenderer: React.FC<LexicalRendererProps> = ({ doc, style }) => {
    if (!doc?.root) return null;
    const children = (doc.root.children ?? []).map((node, i) => renderNode(node, String(i)));
    return (
        <div style={{ flexDirection: 'column', ...style }}>
            {children}
        </div>
    );
};

export default LexicalRenderer;
