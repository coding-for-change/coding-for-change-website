'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { submitForm, uploadApplicantFile } from '../../api';
import { UploadError } from '../../api/client';
import type { CmsApplicantFile, CmsForm as CmsFormDoc, CmsFormField } from '../../api';
import { getAttribution } from '../../lib/attribution';
import { trackConversion, trackFormStart } from '../../lib/analytics';
import { trackAdsConversion, type AdsConversionAction } from '../../lib/googleAds';
import { useLanguage } from '../../contexts/LanguageContext';
import RichText from '../RichText';
import '../showcase/landing.css';

/**
 * Renders a form-builder form from the CMS and submits it.
 *
 * Every question lives in the admin (Forms collection); this component only
 * knows the block types. Besides the plugin's own blocks it renders our three
 * additions from `inner/cms/src/lib/formBlocks.ts`:
 *
 * - `upload`        — a PDF (CV) uploaded to the private `applicant-files`
 *                     collection as soon as it is picked; the id rides along
 *                     on the submission's `files` relationship.
 * - `checkboxGroup` — a multi-select; the submission stores the ticked labels.
 * - `subform`       — a checkbox that reveals another form's questions inline
 *                     ("also apply for membership"). On submit that form gets
 *                     its own submission, so its answers land with the rest of
 *                     that form's submissions. Fields the parent already asks
 *                     (matched by name, e.g. `email`) are asked once and copied.
 *
 * Conversions: the parent and each submitted sub-form fire their own
 * `conversion` event and Google Ads action, named after the form title.
 */

const validateEmail = (email: string) => {
    const re =
        // eslint-disable-next-line
        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

/** Mirrors APPLICANT_FILE_MAX_BYTES in the CMS. */
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Checkbox labels may carry `[text](url)` links, so a consent box can point at
 * the privacy policy without the admin needing a separate message block:
 * "I agree to the processing of my data as described in the
 * [privacy policy](/privacy)." Links open in a new tab so the form is kept.
 */
const renderLabelText = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        parts.push(
            <a
                key={`${m.index}-${m[2]}`}
                href={m[2]}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-label__link"
            >
                {m[1]}
            </a>
        );
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : parts;
};

type Value = string | boolean | string[];
type Values = Record<string, Value>;

type InputField = Exclude<CmsFormField, { blockType: 'message' }>;
type SubformField = Extract<CmsFormField, { blockType: 'subform' }>;
type PlainInput = Exclude<InputField, { blockType: 'subform' }>;

const isInput = (f: CmsFormField): f is InputField => f.blockType !== 'message';
const isSubform = (f: CmsFormField): f is SubformField => f.blockType === 'subform';
const isPlainInput = (f: CmsFormField): f is PlainInput =>
    isInput(f) && !isSubform(f);

/** Analytics / Ads label for a form, from its title. */
export const conversionLabelFor = (title: string): string => {
    const t = title.trim().toLowerCase();
    if (t === 'application') return 'application';
    if (t === 'techtour') return 'techtour';
    if (t === 'contact') return 'contact';
    return t.replace(/[^a-z0-9]+/g, '_');
};

const ADS_ACTIONS: readonly AdsConversionAction[] = [
    'waitlist',
    'application',
    'techtour',
    'contact',
    'booking',
];
const isAdsAction = (label: string): label is AdsConversionAction =>
    (ADS_ACTIONS as readonly string[]).includes(label);

interface UploadState {
    file?: CmsApplicantFile;
    /** Local filename for display. */
    name?: string;
    uploading?: boolean;
    error?: string;
}

/**
 * Page-supplied rendering for one checkboxGroup's options, keyed by field name
 * in `checkboxGroups`. /techtour/apply uses it to draw each evening as a row
 * with the company's logo, its one-liner and the date, instead of a bare
 * checkbox — the answer sent to the CMS is unchanged either way.
 */
export interface CheckboxGroupOverride {
    /** Rich label for one option; falling back to the plain label when null. */
    renderOption?: (
        option: { label: string; value: string },
        index: number
    ) => React.ReactNode;
    /** Rendered under the options — e.g. the attendance ask that belongs here. */
    note?: React.ReactNode;
}

/**
 * A heading opened before a named question, so a long form reads as a couple
 * of parts rather than one run of fields. Opt-in: a form that passes none —
 * /join, /contact — renders exactly as it always did.
 */
export interface CmsFormSection {
    /** The field this section starts at, by name. Unknown names are ignored. */
    at: string;
    title: string;
    /** Optional line under the heading. */
    text?: string;
}

/**
 * Opt-in "save and finish later". Off unless a page passes it, so /join and
 * /contact keep storing nothing at all.
 *
 * Only what the visitor typed is kept, and only when they press the button —
 * never on a keystroke. Consent ticks, linked-form toggles and uploaded files
 * are deliberately left out: a consent box must be ticked deliberately each
 * time, and a file lives in the CMS already. The key is declared as § 25(2)
 * TDDDG storage in `lib/klaroConfig.ts` and allow-listed in
 * `scripts/consent-scan.mjs`.
 */
export interface CmsFormDraft {
    /** localStorage key the answers are parked under. */
    key: string;
    /** Copy for the save row, so this component carries no page wording. */
    labels: {
        save: string;
        saved: string;
        restored: string;
        clear: string;
        cleared: string;
        note: string;
    };
}

/** Answers we park: everything typed or picked, nothing consent-shaped. */
const DRAFTABLE = new Set(['text', 'email', 'textarea', 'number', 'select', 'checkboxGroup']);
/** A parked draft is forgotten after this long — it is personal data. */
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredDraft {
    v: 1;
    savedAt: number;
    values: Record<string, string | string[]>;
}

const readDraft = (key: string): StoredDraft | null => {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredDraft;
        if (parsed?.v !== 1 || typeof parsed.savedAt !== 'number') return null;
        if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
            window.localStorage.removeItem(key);
            return null;
        }
        return parsed;
    } catch {
        // Private mode, disabled storage, or something else wrote the key.
        return null;
    }
};

export interface CmsFormProps {
    form: CmsFormDoc;
    /** Analytics/Ads label; defaults from the form title. */
    conversion?: string;
    /** Optional heading rendered above the fields. */
    heading?: string;
    /**
     * Titles of linked forms (subform blocks) that must not be offered right
     * now — e.g. `['application']` on the TechTour page once membership
     * applications have closed. Matched case-insensitively.
     */
    hiddenSubforms?: string[];
    /** Rich rendering for named checkbox groups; see CheckboxGroupOverride. */
    checkboxGroups?: Record<string, CheckboxGroupOverride>;
    /**
     * Field names to pull to the front, in this order; everything else keeps
     * the order the CMS gives it. /techtour/apply asks which evenings first,
     * because that is the decision the page is about — the admin's order is
     * still what every other page renders.
     */
    fieldOrder?: string[];
    /** Headings to open before named questions; see CmsFormSection. */
    sections?: CmsFormSection[];
    /** Enables "save and finish later"; see CmsFormDraft. */
    draft?: CmsFormDraft;
    className?: string;
    onSubmitted?: () => void;
}

const CmsForm: React.FC<CmsFormProps> = ({
    form,
    conversion,
    heading,
    hiddenSubforms,
    checkboxGroups,
    fieldOrder,
    sections,
    draft,
    className,
    onSubmitted,
}) => {
    const { t } = useLanguage();
    const label = conversion ?? conversionLabelFor(form.title);
    const hidden = useMemo(
        () => new Set((hiddenSubforms ?? []).map((s) => s.trim().toLowerCase())),
        [hiddenSubforms]
    );

    const [values, setValues] = useState<Values>({});
    const [uploads, setUploads] = useState<Record<string, UploadState>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [sendError, setSendError] = useState(false);
    // Submissions that already went through, so a retry after a partial
    // failure does not create duplicates.
    const doneRef = useRef<Set<number>>(new Set());

    // A linked form whose round is closed is dropped entirely: not rendered,
    // not validated, not submitted. `fieldOrder` then pulls named questions to
    // the front; a name that isn't on this form is simply ignored, and without
    // the prop the CMS order is untouched.
    const fields = useMemo(() => {
        const kept = (form.fields ?? []).filter((f) => {
            if (!isSubform(f)) return true;
            const sub = typeof f.form === 'object' && f.form ? f.form : null;
            return !sub || !hidden.has(sub.title.trim().toLowerCase());
        });
        if (!fieldOrder?.length) return kept;
        const rank = (f: CmsFormField) => {
            const at = isInput(f) ? fieldOrder.indexOf(f.name) : -1;
            return at === -1 ? fieldOrder.length : at;
        };
        // Stable: everything the list doesn't name keeps its relative order.
        return kept
            .map((f, i) => ({ f, i, r: rank(f) }))
            .sort((a, b) => a.r - b.r || a.i - b.i)
            .map((e) => e.f);
    }, [form.fields, hidden, fieldOrder]);
    const parentNames = useMemo(
        () => new Set(fields.filter(isInput).map((f) => f.name)),
        [fields]
    );

    /** The linked form behind a subform block, when the API populated it. */
    const linkedForm = (f: SubformField): CmsFormDoc | null =>
        typeof f.form === 'object' && f.form ? f.form : null;

    /** Questions of a linked form that the parent does not already ask. */
    const subFields = useCallback(
        (sub: CmsFormDoc): CmsFormField[] =>
            (sub.fields ?? []).filter(
                (f) =>
                    f.blockType === 'message' ||
                    (isPlainInput(f) && !parentNames.has(f.name))
            ),
        [parentNames]
    );

    const setValue = (name: string, value: Value) =>
        setValues((prev) => ({ ...prev, [name]: value }));

    /**
     * Questions the visitor has actually engaged with.
     *
     * A required question is not a mistake until someone has had a go at it, so
     * nothing complains on first paint — the asterisk and the disabled send
     * button already say what is needed. A question is "touched" once it is
     * changed, or once focus leaves it (so clicking in, choosing nothing and
     * moving on does count). The submit button is disabled while the form is
     * invalid, so a submit attempt is not an event that can be observed here;
     * this is the signal that stands in for it.
     *
     * Only the checkbox group renders a validation message today — the other
     * field types show the required marker and nothing else — so this is the
     * single place it is read. It is keyed by field name so a second one would
     * behave the same way.
     */
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const markTouched = (name: string) =>
        setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
    /** Focus left the field entirely (not just moved between its controls). */
    const handleFieldBlur = (name: string) => (e: React.FocusEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        markTouched(name);
    };

    // ---- Save and finish later (only when `draft` is passed) ----
    const draftKey = draft?.key;
    const [draftState, setDraftState] = useState<'none' | 'restored' | 'saved' | 'cleared'>(
        'none'
    );
    /** Field names whose answers we are willing to park. */
    const draftable = useMemo(
        () =>
            new Set(
                fields
                    .filter(isPlainInput)
                    .filter((f) => DRAFTABLE.has(f.blockType))
                    .map((f) => f.name)
            ),
        [fields]
    );

    // Restore once, after mount: reading storage during render would differ
    // between the server pass and the browser and break hydration.
    //
    // The ref is what makes it *once*. `draftable` is derived from `fields`,
    // which is rebuilt whenever a caller passes a fresh `hiddenSubforms` array,
    // so without the guard this effect would re-run on every render — and since
    // it calls setValues with a new object each time, that is an endless
    // render loop. An empty field list means the form has not arrived yet, so
    // the guard trips only once there is something to restore into.
    const restoredRef = useRef(false);
    useEffect(() => {
        if (!draftKey || restoredRef.current || draftable.size === 0) return;
        restoredRef.current = true;
        const stored = readDraft(draftKey);
        if (!stored) return;
        const restored: Values = {};
        Object.entries(stored.values).forEach(([name, value]) => {
            if (!draftable.has(name)) return; // the form changed since
            if (Array.isArray(value) && value.every((v) => typeof v === 'string'))
                restored[name] = value;
            else if (typeof value === 'string') restored[name] = value;
        });
        if (Object.keys(restored).length === 0) return;
        // Anything already typed wins over the parked copy.
        setValues((prev) => ({ ...restored, ...prev }));
        setDraftState('restored');
    }, [draftKey, draftable]);

    const forgetDraft = useCallback(() => {
        if (!draftKey) return;
        try {
            window.localStorage.removeItem(draftKey);
        } catch {
            /* nothing stored, nothing to forget */
        }
    }, [draftKey]);

    const saveDraft = () => {
        if (!draftKey) return;
        const payload: StoredDraft['values'] = {};
        draftable.forEach((name) => {
            const value = values[name];
            if (Array.isArray(value)) {
                if (value.length > 0) payload[name] = value;
            } else if (typeof value === 'string' && value.trim() !== '') {
                payload[name] = value;
            }
        });
        if (Object.keys(payload).length === 0) return;
        try {
            window.localStorage.setItem(
                draftKey,
                JSON.stringify({ v: 1, savedAt: Date.now(), values: payload } satisfies StoredDraft)
            );
            setDraftState('saved');
        } catch {
            // Storage refused (private mode, quota). Saying nothing is better
            // than claiming a save that did not happen.
            setDraftState('none');
        }
    };

    const clearDraft = () => {
        forgetDraft();
        setDraftState('cleared');
    };

    const valueOf = (field: PlainInput): Value => {
        const v = values[field.name];
        if (v !== undefined) return v;
        if (field.blockType === 'checkbox') return field.defaultValue ?? false;
        if (field.blockType === 'checkboxGroup') return [];
        if (field.blockType === 'number')
            return field.defaultValue != null ? String(field.defaultValue) : '';
        if ('defaultValue' in field && field.defaultValue != null)
            return String(field.defaultValue);
        return '';
    };

    const isValid = (field: PlainInput): boolean => {
        const value = valueOf(field);
        switch (field.blockType) {
            case 'email': {
                const str = String(value);
                if (!str) return !field.required;
                return validateEmail(str);
            }
            case 'checkbox':
                return field.required ? value === true : true;
            case 'checkboxGroup':
                return field.required
                    ? Array.isArray(value) && value.length > 0
                    : true;
            case 'upload': {
                const up = uploads[field.name];
                if (up?.uploading) return false;
                return field.required ? Boolean(up?.file) : true;
            }
            default:
                if (!field.required) return true;
                return String(value).trim().length > 0;
        }
    };

    const activeSubforms = fields
        .filter(isSubform)
        .filter((f) => values[f.name] === true && linkedForm(f));

    const formValid =
        fields.filter(isPlainInput).every(isValid) &&
        activeSubforms.every((f) =>
            subFields(linkedForm(f)!).filter(isPlainInput).every(isValid)
        );

    /** One submission's `submissionData` + attached file ids. */
    const serialise = (list: CmsFormField[]) => {
        const data: { field: string; value: string }[] = [];
        const files: number[] = [];
        list.forEach((field) => {
            if (!isInput(field)) return;
            if (isSubform(field)) {
                data.push({
                    field: field.name,
                    value: values[field.name] === true ? 'true' : 'false',
                });
                return;
            }
            const value = valueOf(field);
            switch (field.blockType) {
                case 'checkbox':
                    data.push({ field: field.name, value: value === true ? 'true' : 'false' });
                    break;
                case 'checkboxGroup': {
                    const picked = Array.isArray(value) ? value : [];
                    const labels = (field.options ?? [])
                        .filter((o) => picked.includes(o.value))
                        .map((o) => o.label);
                    data.push({ field: field.name, value: labels.join(', ') });
                    break;
                }
                case 'upload': {
                    const up = uploads[field.name]?.file;
                    if (up) files.push(up.id);
                    data.push({ field: field.name, value: up?.filename ?? '' });
                    break;
                }
                default:
                    data.push({ field: field.name, value: String(value) });
            }
        });
        return { data, files };
    };

    const handleSubmit = async () => {
        if (!formValid || submitting) return;
        setSendError(false);
        setSubmitting(true);
        const attribution = getAttribution();
        // Parent first, then each ticked linked form.
        const jobs: { id: number; label: string; list: CmsFormField[] }[] = [
            { id: form.id, label, list: fields },
            ...activeSubforms.map((f) => {
                const sub = linkedForm(f)!;
                return {
                    id: sub.id,
                    label: conversionLabelFor(sub.title),
                    // Shared fields (asked once by the parent) are copied over.
                    list: [
                        ...subFields(sub),
                        ...fields.filter(
                            (pf) =>
                                isPlainInput(pf) &&
                                (sub.fields ?? []).some(
                                    (sf) => isInput(sf) && sf.name === pf.name
                                )
                        ),
                    ],
                };
            }),
        ];
        let failed = false;
        for (const job of jobs) {
            if (doneRef.current.has(job.id)) continue;
            try {
                const { data, files } = serialise(job.list);
                await submitForm(job.id, data, attribution, files);
                doneRef.current.add(job.id);
                trackConversion(job.label);
                if (isAdsAction(job.label)) trackAdsConversion(job.label);
            } catch {
                failed = true;
                break;
            }
        }
        setSubmitting(false);
        if (failed) {
            setSendError(true);
            return;
        }
        // The answers are with us now; the parked copy has done its job.
        forgetDraft();
        setSubmitted(true);
        onSubmitted?.();
    };

    // Funnel: `form_start` the first time any field gets focus.
    const started = useRef(false);
    const handleFocus = () => {
        if (started.current) return;
        started.current = true;
        trackFormStart(label);
    };

    const handleFile = async (field: Extract<PlainInput, { blockType: 'upload' }>, file: File | null) => {
        if (!file) return;
        const isPdf =
            file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!isPdf) {
            setUploads((p) => ({ ...p, [field.name]: { error: t.forms.uploadWrongType } }));
            return;
        }
        if (file.size > UPLOAD_MAX_BYTES) {
            setUploads((p) => ({ ...p, [field.name]: { error: t.forms.uploadTooLarge } }));
            return;
        }
        setUploads((p) => ({ ...p, [field.name]: { uploading: true, name: file.name } }));
        try {
            const doc = await uploadApplicantFile(file, field.name);
            setUploads((p) => ({ ...p, [field.name]: { file: doc, name: file.name } }));
        } catch (err) {
            const reason = err instanceof UploadError ? err.reason : 'failed';
            setUploads((p) => ({
                ...p,
                [field.name]: {
                    error:
                        reason === 'too-large'
                            ? t.forms.uploadTooLarge
                            : reason === 'wrong-type'
                            ? t.forms.uploadWrongType
                            : t.forms.uploadFailed,
                },
            }));
        }
    };

    // The marker stays on every required field, filled or not, so the form's
    // rules are readable at a glance rather than disappearing as you type.
    const star = (field: PlainInput) =>
        field.required ? <span className="lp-required">*</span> : null;

    const renderInput = (field: PlainInput, key: string) => {
        const value = valueOf(field);
        const fieldLabel = field.label || field.name;

        if (field.blockType === 'checkbox') {
            return (
                <label key={key} className="lp-checkbox">
                    <input
                        type="checkbox"
                        name={field.name}
                        checked={value === true}
                        onChange={(e) => setValue(field.name, e.target.checked)}
                    />
                    <span className="lp-label">
                        {star(field)}
                        {renderLabelText(fieldLabel)}
                    </span>
                </label>
            );
        }

        if (field.blockType === 'checkboxGroup') {
            const picked = Array.isArray(value) ? value : [];
            const toggle = (opt: string, on: boolean) => {
                markTouched(field.name);
                setValue(
                    field.name,
                    on ? [...picked, opt] : picked.filter((v) => v !== opt)
                );
            };
            const override = checkboxGroups?.[field.name];
            return (
                <fieldset
                    key={key}
                    className={`lp-field lp-checkgroup${
                        override ? ' lp-checkgroup--rich' : ''
                    }`}
                    onBlur={handleFieldBlur(field.name)}
                >
                    <legend className="lp-label">
                        {star(field)}
                        {fieldLabel}
                    </legend>
                    {field.description && (
                        <p className="lp-field__hint">{field.description}</p>
                    )}
                    <div className="lp-checkgroup__options">
                        {(field.options ?? []).map((opt, i) => {
                            const rich = override?.renderOption?.(opt, i) ?? null;
                            return (
                                <label
                                    key={opt.value}
                                    className={`lp-checkbox${rich ? ' lp-checkbox--rich' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        name={`${field.name}[]`}
                                        value={opt.value}
                                        checked={picked.includes(opt.value)}
                                        onChange={(e) => toggle(opt.value, e.target.checked)}
                                    />
                                    {rich ?? (
                                        <span className="lp-label">
                                            {renderLabelText(opt.label)}
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    {/* The error belongs to the options, so it sits with them
                        — above any note a page has attached. Without a note
                        (every other form) the order is unchanged. And it waits
                        for the visitor to have had a go at the question: see
                        `touched` above. */}
                    {field.required && picked.length === 0 && touched[field.name] && (
                        <p className="lp-field__hint lp-field__hint--req">
                            {t.forms.chooseAtLeastOne}
                        </p>
                    )}
                    {override?.note && (
                        <div className="lp-checkgroup__note">{override.note}</div>
                    )}
                </fieldset>
            );
        }

        if (field.blockType === 'upload') {
            const up = uploads[field.name] ?? {};
            return (
                <div key={key} className="lp-field lp-upload">
                    <span className="lp-label">
                        {star(field)}
                        {fieldLabel}
                    </span>
                    {up.file ? (
                        <div className="lp-upload__done">
                            <span className="lp-upload__name">
                                {up.name ?? up.file.filename}
                            </span>
                            <button
                                type="button"
                                className="lp-upload__remove"
                                onClick={() =>
                                    setUploads((p) => ({ ...p, [field.name]: {} }))
                                }
                            >
                                {t.forms.uploadRemove}
                            </button>
                        </div>
                    ) : (
                        <label
                            className={`lp-upload__drop${up.uploading ? ' is-busy' : ''}`}
                        >
                            <input
                                type="file"
                                accept="application/pdf,.pdf"
                                disabled={Boolean(up.uploading)}
                                onChange={(e) => {
                                    void handleFile(field, e.target.files?.[0] ?? null);
                                    e.target.value = '';
                                }}
                            />
                            <span className="lp-upload__btn">
                                {up.uploading ? t.forms.uploading : t.forms.uploadChoose}
                            </span>
                            <span className="lp-upload__hint">
                                {up.uploading && up.name
                                    ? up.name
                                    : field.description || t.forms.uploadHint}
                            </span>
                        </label>
                    )}
                    {up.error && <p className="lp-field__hint lp-field__hint--req">{up.error}</p>}
                </div>
            );
        }

        if (field.blockType === 'textarea') {
            return (
                <div className="lp-field" key={key}>
                    <span className="lp-label">
                        {star(field)}
                        {fieldLabel}
                    </span>
                    <textarea
                        className="lp-textarea"
                        name={field.name}
                        value={String(value)}
                        onChange={(e) => setValue(field.name, e.target.value)}
                    />
                </div>
            );
        }

        if (field.blockType === 'select') {
            return (
                <div className="lp-field" key={key}>
                    <span className="lp-label">
                        {star(field)}
                        {fieldLabel}
                    </span>
                    <select
                        className="lp-select"
                        name={field.name}
                        value={String(value)}
                        onChange={(e) => setValue(field.name, e.target.value)}
                    >
                        <option value="">{field.placeholder || '—'}</option>
                        {(field.options ?? []).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        return (
            <div className="lp-field" key={key}>
                <span className="lp-label">
                    {star(field)}
                    {fieldLabel}
                </span>
                <input
                    className="lp-input"
                    type={
                        field.blockType === 'email'
                            ? 'email'
                            : field.blockType === 'number'
                            ? 'number'
                            : 'text'
                    }
                    name={field.name}
                    value={String(value)}
                    onChange={(e) => setValue(field.name, e.target.value)}
                />
            </div>
        );
    };

    const renderField = (field: CmsFormField, key: string): React.ReactNode => {
        if (field.blockType === 'message') {
            return (
                <div key={key} className="lp-field lp-field--message">
                    <RichText content={field.message} />
                </div>
            );
        }
        if (isSubform(field)) {
            const sub = linkedForm(field);
            const on = values[field.name] === true;
            return (
                <div key={key} className={`lp-subform${on ? ' is-open' : ''}`}>
                    <div className="lp-subform__head">
                        <label className="lp-checkbox">
                            <input
                                type="checkbox"
                                name={field.name}
                                checked={on}
                                onChange={(e) => setValue(field.name, e.target.checked)}
                            />
                            <span className="lp-label">
                                {renderLabelText(field.label || field.name)}
                            </span>
                        </label>
                        {field.linkUrl && (
                            <a
                                className="lp-subform__link"
                                href={field.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t.forms.opensNewTab}
                            >
                                {field.linkLabel || field.linkUrl} ↗
                            </a>
                        )}
                    </div>
                    {field.description && (
                        <p className="lp-subform__desc">{field.description}</p>
                    )}
                    {on && sub && (
                        <motion.div
                            className="lp-subform__panel"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            {subFields(sub).map((sf, i) =>
                                renderField(sf, `${key}-${sub.id}-${i}`)
                            )}
                        </motion.div>
                    )}
                    {on && !sub && (
                        <p className="lp-field__hint lp-field__hint--req">
                            {t.forms.linkedUnavailable}
                        </p>
                    )}
                </div>
            );
        }
        return renderInput(field, key);
    };

    /** Sections by the field they open at. Empty unless a page asks for them. */
    const sectionAt = useMemo(() => {
        const map = new Map<string, CmsFormSection>();
        (sections ?? []).forEach((s) => map.set(s.at, s));
        return map;
    }, [sections]);

    const submitButton = (
        <button
            className="lp-submit"
            type="submit"
            disabled={!formValid || submitting}
            onMouseDown={handleSubmit}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSubmit();
            }}
        >
            {submitting ? t.forms.submitting : form.submitButtonLabel || t.forms.send}
        </button>
    );

    if (submitted) {
        return (
            <div className={`lp-cmsform${className ? ` ${className}` : ''}`}>
                {heading && (
                    <h3 className="lp-col__head" style={{ marginBottom: 16 }}>
                        {heading}
                    </h3>
                )}
                <div className="lp-field">
                    {form.confirmationMessage ? (
                        <RichText content={form.confirmationMessage} />
                    ) : (
                        <p>{t.forms.successFallback}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`lp-cmsform${className ? ` ${className}` : ''}`}
            onFocus={handleFocus}
        >
            {heading && (
                <h3 className="lp-col__head" style={{ marginBottom: 16 }}>
                    {heading}
                </h3>
            )}
            {fields.map((field, i) => {
                // A section opens immediately before the field it names; with
                // no sections the fragment renders nothing extra at all.
                const section = isInput(field) ? sectionAt.get(field.name) : undefined;
                return (
                    <React.Fragment key={`f-${i}`}>
                        {section && (
                            <div className="lp-formsection">
                                <h3 className="lp-formsection__title">{section.title}</h3>
                                {section.text && (
                                    <p className="lp-formsection__text">{section.text}</p>
                                )}
                            </div>
                        )}
                        {renderField(field, `f-${i}`)}
                    </React.Fragment>
                );
            })}
            {/* Without a draft this is the bare button it has always been —
                forms that don't opt in keep their exact markup. The draft row's
                styling lives with the page that does opt in, today only
                showcase/techtourApply.css. */}
            {draft ? (
                <div className="lp-actions">
                    {submitButton}
                    <button
                        className="lp-draft__save"
                        type="button"
                        onClick={saveDraft}
                        disabled={submitting}
                    >
                        {draft.labels.save}
                    </button>
                </div>
            ) : (
                submitButton
            )}
            {draft && (
                <p className="lp-draft__note">
                    {draftState === 'restored' && (
                        <span className="lp-draft__flag">{draft.labels.restored} </span>
                    )}
                    {draftState === 'saved' && (
                        <span className="lp-draft__flag">{draft.labels.saved}. </span>
                    )}
                    {draftState === 'cleared' && (
                        <span className="lp-draft__flag">{draft.labels.cleared} </span>
                    )}
                    {draft.labels.note}
                    {(draftState === 'restored' || draftState === 'saved') && (
                        <>
                            {' '}
                            <button
                                className="lp-draft__clear"
                                type="button"
                                onClick={clearDraft}
                            >
                                {draft.labels.clear}
                            </button>
                        </>
                    )}
                </p>
            )}
            <p className="lp-form-note">
                {sendError ? (
                    <span className="lp-required">{t.forms.sendError}</span>
                ) : (
                    <span>
                        <span className="lp-required">*</span> = {t.forms.required}
                    </span>
                )}
            </p>
        </div>
    );
};

export default CmsForm;
