import React from 'react';
import { LexicalNode, LexicalRichText } from '../api';

// Lexical text-format bitmask flags.
const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_STRIKETHROUGH = 4;
const IS_UNDERLINE = 8;
const IS_CODE = 16;

const renderText = (node: LexicalNode, key: React.Key): React.ReactNode => {
    const text = node.text ?? '';
    const format = typeof node.format === 'number' ? node.format : 0;

    let element: React.ReactNode = text;
    if (format & IS_CODE) element = <code key={key}>{element}</code>;
    if (format & IS_BOLD) element = <b key={key}>{element}</b>;
    if (format & IS_ITALIC) element = <i key={key}>{element}</i>;
    if (format & IS_UNDERLINE) element = <u key={key}>{element}</u>;
    if (format & IS_STRIKETHROUGH) element = <s key={key}>{element}</s>;

    return <React.Fragment key={key}>{element}</React.Fragment>;
};

const renderChildren = (node: LexicalNode): React.ReactNode =>
    (node.children ?? []).map((child, i) => renderNode(child, i));

const renderNode = (node: LexicalNode, key: React.Key): React.ReactNode => {
    switch (node.type) {
        case 'text':
            return renderText(node, key);
        case 'linebreak':
            return <br key={key} />;
        case 'paragraph':
            return <p key={key}>{renderChildren(node)}</p>;
        case 'heading': {
            const Tag = (node.tag as keyof JSX.IntrinsicElements) || 'h2';
            return <Tag key={key}>{renderChildren(node)}</Tag>;
        }
        case 'horizontalrule':
            return <hr key={key} style={styles.divider} />;
        // `autolink` is what the editor creates when a URL or email address is
        // typed straight into the text; same shape, same rendering.
        case 'autolink':
        case 'link': {
            const url = node.fields?.url ?? '#';
            const newTab = node.fields?.newTab;
            return (
                <a
                    key={key}
                    href={url}
                    {...(newTab
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                >
                    {renderChildren(node)}
                </a>
            );
        }
        case 'list': {
            const Tag = node.tag === 'ol' ? 'ol' : 'ul';
            return <Tag key={key}>{renderChildren(node)}</Tag>;
        }
        case 'listitem':
            return <li key={key}>{renderChildren(node)}</li>;
        default:
            // Unknown node types: render their children so content is never dropped.
            return node.children ? (
                <React.Fragment key={key}>
                    {renderChildren(node)}
                </React.Fragment>
            ) : null;
    }
};

interface RichTextProps {
    content?: LexicalRichText | null;
    /**
     * Optional wrapper class. Without it the nodes are returned bare, as before,
     * so existing callers (form confirmations, field messages) are unaffected.
     * Long-form documents pass `lp-prose` to get real paragraph and heading
     * rhythm — see the note on that class in `landing.css`.
     */
    className?: string;
}

const RichText: React.FC<RichTextProps> = ({ content, className }) => {
    if (!content?.root?.children) return null;
    const nodes = content.root.children.map((node, i) => renderNode(node, i));
    return className ? <div className={className}>{nodes}</div> : <>{nodes}</>;
};

const styles: StyleSheetCSS = {
    divider: {
        width: '100%',
        border: 'none',
        borderTop: '1px solid #888',
    },
};

export default RichText;
