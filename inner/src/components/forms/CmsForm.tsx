'use client';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
    className?: string;
    onSubmitted?: () => void;
}

const CmsForm: React.FC<CmsFormProps> = ({
    form,
    conversion,
    heading,
    hiddenSubforms,
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
    // not validated, not submitted.
    const fields = useMemo(
        () =>
            (form.fields ?? []).filter((f) => {
                if (!isSubform(f)) return true;
                const sub = typeof f.form === 'object' && f.form ? f.form : null;
                return !sub || !hidden.has(sub.title.trim().toLowerCase());
            }),
        [form.fields, hidden]
    );
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
            const toggle = (opt: string, on: boolean) =>
                setValue(
                    field.name,
                    on ? [...picked, opt] : picked.filter((v) => v !== opt)
                );
            return (
                <fieldset key={key} className="lp-field lp-checkgroup">
                    <legend className="lp-label">
                        {star(field)}
                        {fieldLabel}
                    </legend>
                    {field.description && (
                        <p className="lp-field__hint">{field.description}</p>
                    )}
                    <div className="lp-checkgroup__options">
                        {(field.options ?? []).map((opt) => (
                            <label key={opt.value} className="lp-checkbox">
                                <input
                                    type="checkbox"
                                    name={`${field.name}[]`}
                                    value={opt.value}
                                    checked={picked.includes(opt.value)}
                                    onChange={(e) => toggle(opt.value, e.target.checked)}
                                />
                                <span className="lp-label">{renderLabelText(opt.label)}</span>
                            </label>
                        ))}
                    </div>
                    {field.required && picked.length === 0 && (
                        <p className="lp-field__hint lp-field__hint--req">
                            {t.forms.chooseAtLeastOne}
                        </p>
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
            {fields.map((field, i) => renderField(field, `f-${i}`))}
            <button
                className="lp-submit"
                type="submit"
                disabled={!formValid || submitting}
                onMouseDown={handleSubmit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSubmit();
                }}
            >
                {submitting
                    ? t.forms.submitting
                    : form.submitButtonLabel || t.forms.send}
            </button>
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
