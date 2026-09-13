/** Payload CMS media object (populated upload field) */
export interface CmsMedia {
    id: number;
    url: string;
    alt: string;
    filename: string;
    mimeType: string;
    filesize: number;
    width?: number;
    height?: number;
}

/** GET /api/team-groups — teams shown as sections on the Team page. */
export interface CmsTeamGroup {
    id: number;
    name: string;
    logo?: CmsMedia | null;
    order: number;
}

/** GET /api/team */
export interface CmsTeamMember {
    id: number;
    name: string;
    role: string;
    category?: 'member' | 'adviser';
    image?: CmsMedia | null;
    bio: string;
    links?: { label: string; url: string; id?: string }[];
    // Companies this person worked at (populated at depth >= 2). Logos shown
    // on hover. May be IDs if fetched at insufficient depth.
    companies?: (CmsCompany | number)[] | null;
    // Team assignments (populated at depth >= 1). When any member has these,
    // the Team page groups people by team; `role` overrides the main role for
    // that team (falls back to `role` when blank).
    teamMemberships?: {
        team?: CmsTeamGroup | number | null;
        role?: string | null;
        id?: string;
    }[] | null;
}

/** GET /api/events */
export interface CmsEvent {
    id: number;
    title: string;
    date: string;
    time: string;
    location: string;
    description: string;
    type: 'Hackathon' | 'Workshop' | 'Info-session' | 'Social';
    isUpcoming: boolean;
    link?: { label?: string; url?: string };
}

/** GET /api/projects */
export interface CmsProject {
    id: number;
    title: string;
    ngoPartner: string;
    description: string;
    image?: CmsMedia | null;
    technologies?: { name: string; id?: string }[];
    status: 'active' | 'completed' | 'recruiting';
    links?: { label: string; url: string; id?: string }[];
    // `slug` drives the /projects/<slug> detail page; `featured` marks the
    // flagship for a differentiated treatment on the projects list.
    slug?: string | null;
    featured?: boolean | null;
    // Who works on the project. Project-level, so a project can carry its team
    // without a case study — this is what the Team page reads.
    team?: CmsProjectTeamRow[] | null;
    // Case-study head.
    impactHeadline?: string | null;
    impact?: string | null;
    // Case-study body — freely-orderable content blocks, rendered in order.
    layout?: CmsCaseStudyBlock[] | null;
}

/** One person on a project, with the role they hold on it. */
export interface CmsProjectTeamRow {
    /** Populated at depth >= 1; may be an ID at insufficient depth. */
    member?: CmsTeamMember | number | null;
    /** Role on this project; falls back to the member's main role. */
    role?: string | null;
    id?: string | null;
}

/** A shared { image, caption } item used by gallery blocks. */
export interface CmsGalleryImage {
    image?: CmsMedia | null;
    caption?: string | null;
    id?: string | null;
}

export interface CmsTextBlock {
    blockType: 'text';
    id?: string | null;
    heading?: string | null;
    body: string;
}

export interface CmsQuoteBlock {
    blockType: 'quote';
    id?: string | null;
    text: string;
    author?: string | null;
    role?: string | null;
}

export interface CmsGalleryBlock {
    blockType: 'gallery';
    id?: string | null;
    heading?: string | null;
    /**
     * How the images are presented: `stage` stands product shots on a shared
     * tinted ground (the default — device mock-ups were the original use), while
     * `photos` lays photographs out in an edge-to-edge grid.
     */
    layout?: 'stage' | 'photos' | null;
    images?: CmsGalleryImage[] | null;
}

/** A product demo: a screen recording uploaded through the CMS. */
export interface CmsDemoBlock {
    blockType: 'demo';
    id?: string | null;
    heading?: string | null;
    video?: CmsMedia | null;
    /** Still frame shown before playback. */
    poster?: CmsMedia | null;
    caption?: string | null;
}

/** An ordered list of milestones. */
export interface CmsTimelineBlock {
    blockType: 'timeline';
    id?: string | null;
    heading?: string | null;
    points?: {
        /** Shown inside the circle; falls back to the point's position. */
        marker?: string | null;
        /** Small badge above the title (e.g. "March 2026" or "Week 2"). */
        timing?: string | null;
        title: string;
        subtitle?: string | null;
        /** Set 'current' on the phase the project is in — the frontend derives done/upcoming for the rest. */
        state?: 'done' | 'current' | 'upcoming' | null;
        /** Optional screenshot / mock-up shown with this step. */
        image?: CmsMedia | null;
        id?: string | null;
    }[] | null;
}

/** The teammates involved, with per-project roles. */
export interface CmsTeamBlock {
    blockType: 'team';
    id?: string | null;
    heading?: string | null;
    /** Empty means "show the project's own `team`". */
    members?: CmsProjectTeamRow[] | null;
}

export interface CmsFaqBlock {
    blockType: 'faq';
    id?: string | null;
    items?: { question: string; answer: string; id?: string | null }[] | null;
}

/** A block in a project's freely-orderable case-study `layout`. */
export type CmsCaseStudyBlock =
    | CmsTextBlock
    | CmsQuoteBlock
    | CmsGalleryBlock
    | CmsDemoBlock
    | CmsTimelineBlock
    | CmsTeamBlock
    | CmsFaqBlock;

/** GET /api/sponsor-tiers — CMS-managed sponsor tiers (Platinum, Gold, …). */
export interface CmsSponsorTier {
    id: number;
    label: string;
    order: number;
}

/** GET /api/sponsors */
export interface CmsSponsor {
    id: number;
    name: string;
    logo?: CmsMedia | null;
    url?: string;
    /** CMS-managed tier (populated at depth >= 1). */
    tierRef?: CmsSponsorTier | number | null;
    /** Deprecated fixed tier — fallback when `tierRef` isn't set. */
    tier?: 'platinum' | 'gold' | 'silver' | 'bronze' | 'partner' | null;
    description?: string;
}

/** GET /api/companies — companies our team members have worked at */
export interface CmsCompany {
    id: number;
    name: string;
    logo?: CmsMedia | null;
    url?: string;
}

/** GET /api/faq */
export interface CmsFaqItem {
    id: number;
    question: string;
    answer: string;
    category?: 'general' | 'membership' | 'projects' | 'technical';
}

/** GET /api/globals/site-config */
export interface CmsSiteConfig {
    clubName: string;
    tagline: string;
    description: string;
    email: string;
    socialLinks?: { platform: string; url: string; id?: string }[];
    copyrightText?: string;
    windowTitle?: string;
    bookingUrl?: string;
    teamHeroImage?: CmsMedia | null;
    /** Club headcount for the Team page — typed in, not counted off `team`. */
    memberCount?: string | null;
    stats?: { value: string; label: string; id?: string }[];
}

/** A node in a Payload lexical rich-text tree. */
export interface LexicalNode {
    type: string;
    version?: number;
    children?: LexicalNode[];
    // text node
    text?: string;
    format?: number | string;
    // heading node
    tag?: string;
    // link node
    fields?: { url?: string; newTab?: boolean; linkType?: string };
    // list node
    listType?: string;
    // upload node
    value?: { url?: string; alt?: string; mimeType?: string } | null;
    [key: string]: unknown;
}

/** Payload lexical rich-text field value. */
export interface LexicalRichText {
    root: LexicalNode;
}

/** Alias — same shape as LexicalRichText. */
export type LexicalDocument = LexicalRichText;

/** GET /api/globals/legal */
export interface CmsLegal {
    impressum: LexicalRichText;
    privacyPolicy: LexicalRichText;
}

/** GET /api/blog-posts?depth=2 */
export interface CmsBlogPost {
    id: number;
    title: string;
    slug: string;
    publishedAt: string;
    excerpt: string;
    featuredImage?: CmsMedia | null;
    tags?: { tag: string; id?: string }[];
    author?: CmsTeamMember | null;
    project?: CmsProject | null;
    content: LexicalDocument;
}

/** GET /api/globals/membership */
export interface CmsMembership {
    title: string;
    description: string;
    heroImage?: CmsMedia | null;
    benefits?: { text: string; id?: string }[];
    requirements?: { text: string; id?: string }[];
    /** Cross-disciplinary "Ways to contribute" cards (Engineering, Consulting, …). */
    tracks?: { title: string; description: string; id?: string }[];
    contactEmail: string;
}

/** GET /api/globals/partner — the "Partner with us / For NGOs" page content. */
export interface CmsPartner {
    title?: string | null;
    intro?: string | null;
    heroImage?: CmsMedia | null;
    valueProps?: { title: string; description: string; id?: string }[] | null;
    process?: { title: string; description: string; id?: string }[] | null;
    commitment?: string | null;
    ctaHeading?: string | null;
    ctaText?: string | null;
    contactEmail?: string | null;
}

/** GET /api/globals/about — About page content (frontend falls back to i18n). */
export interface CmsAbout {
    kicker?: string | null;
    title?: string | null;
    lead?: string | null;
    story?: { text: string; id?: string }[] | null;
    valuesTitle?: string | null;
    values?: { title: string; text: string; id?: string }[] | null;
    teamTeaser?: string | null;
    teamCta?: string | null;
}

/** GET /api/globals/homepage — homepage section copy (falls back to i18n). */
export interface CmsHomepage {
    heroKicker?: string | null;
    heroCtaPrimary?: string | null;
    heroCtaSecondary?: string | null;
    heroScrollHint?: string | null;
    heroImage?: CmsMedia | null;
    aboutKicker?: string | null;
    aboutOneLiner?: string | null;
    aboutPitch?: string | null;
    stats?: { value: string; label: string; id?: string }[] | null;
    steps?: {
        title: string;
        text: string;
        /** Small badge above the title (e.g. "Week 0", "≈ 2 weeks in"). */
        timing?: string | null;
        /** Optional button on this step; href defaults to the page's booking section. */
        ctaLabel?: string | null;
        ctaHref?: string | null;
        id?: string;
    }[] | null;
    processKicker?: string | null;
    processHeading?: string | null;
    processIntro?: string | null;
    projectsSubtitle?: string | null;
    projectsTitle?: string | null;
    projectsIntro?: string | null;
    eventsSubtitle?: string | null;
    eventsTitle?: string | null;
    eventsIntro?: string | null;
    sponsorsSubtitle?: string | null;
    sponsorsTitle?: string | null;
    sponsorsIntro?: string | null;
    qaSubtitle?: string | null;
    qaTitle?: string | null;
    qaIntro?: string | null;
    threedKicker?: string | null;
    threedTitle?: string | null;
    threedText?: string | null;
    threedCta?: string | null;
    ctaHeading?: string | null;
    ctaText?: string | null;
    ctaJoin?: string | null;
    ctaContact?: string | null;
}

export type CmsFormField =
    | {
          blockType: 'text';
          name: string;
          label?: string | null;
          required?: boolean | null;
          defaultValue?: string | null;
          width?: number | null;
      }
    | {
          blockType: 'textarea';
          name: string;
          label?: string | null;
          required?: boolean | null;
          defaultValue?: string | null;
          width?: number | null;
      }
    | {
          blockType: 'email';
          name: string;
          label?: string | null;
          required?: boolean | null;
          width?: number | null;
      }
    | {
          blockType: 'number';
          name: string;
          label?: string | null;
          required?: boolean | null;
          defaultValue?: number | null;
          width?: number | null;
      }
    | {
          blockType: 'checkbox';
          name: string;
          label?: string | null;
          required?: boolean | null;
          defaultValue?: boolean | null;
          width?: number | null;
      }
    | {
          blockType: 'select';
          name: string;
          label?: string | null;
          required?: boolean | null;
          defaultValue?: string | null;
          placeholder?: string | null;
          options?: { label: string; value: string; id?: string }[] | null;
          width?: number | null;
      }
    | {
          blockType: 'message';
          message?: LexicalRichText | null;
      }
    /** PDF stored privately in `applicant-files`; the submission carries the id. */
    | {
          blockType: 'upload';
          name: string;
          label?: string | null;
          required?: boolean | null;
          description?: string | null;
          width?: number | null;
      }
    /** Multi-select rendered as one checkbox per option. */
    | {
          blockType: 'checkboxGroup';
          name: string;
          label?: string | null;
          required?: boolean | null;
          description?: string | null;
          options?: { label: string; value: string; id?: string }[] | null;
          width?: number | null;
      }
    /**
     * A checkbox that reveals another form's questions inline and, when ticked,
     * creates a separate submission of that form on submit.
     */
    | {
          blockType: 'subform';
          name: string;
          label?: string | null;
          form: number | CmsForm;
          description?: string | null;
          linkLabel?: string | null;
          linkUrl?: string | null;
      };

/** POST /api/applicant-files — a privately stored applicant document. */
export interface CmsApplicantFile {
    id: number;
    filename?: string | null;
    filesize?: number | null;
    mimeType?: string | null;
    kind?: string | null;
}

/** GET /api/globals/tech-tour — the Munich TechTour event page. */
export interface CmsTechTourEvent {
    id?: string;
    company: string;
    date: string;
    title?: string | null;
    time?: string | null;
    location?: string | null;
    description?: string | null;
    logo?: CmsMedia | null;
    website?: string | null;
    status?: 'confirmed' | 'tentative' | 'tba' | null;
}

export interface CmsTechTour {
    kicker?: string | null;
    title?: string | null;
    intro?: string | null;
    heroImage?: CmsMedia | null;
    registrationOpen?: boolean | null;
    registrationDeadline?: string | null;
    events?: CmsTechTourEvent[] | null;
    highlights?: { title: string; text: string; id?: string }[] | null;
    commitment?: string | null;
    formHeading?: string | null;
    closedMessage?: string | null;
}

/** GET /api/forms — a form-builder form schema (rendered dynamically). */
export interface CmsForm {
    id: number;
    title: string;
    fields?: CmsFormField[] | null;
    submitButtonLabel?: string | null;
    confirmationType?: 'message' | 'redirect' | null;
    confirmationMessage?: LexicalRichText | null;
    redirect?: { url: string } | null;
}
