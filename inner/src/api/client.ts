import type { Attribution } from '../lib/attribution';
import type { CmsApplicantFile } from './types';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export interface PaginatedResponse<T> {
    docs: T[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
    pagingCounter: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
}

export async function fetchCollection<T>(
    slug: string,
    params?: Record<string, string>
): Promise<T[]> {
    const query = new URLSearchParams({ limit: '100', ...params });
    const res = await fetch(`${API_BASE}/${slug}?${query}`);
    if (!res.ok) throw new Error(`Failed to fetch ${slug}: ${res.status}`);
    const data: PaginatedResponse<T> = await res.json();
    return data.docs;
}

export async function fetchGlobal<T>(slug: string, params?: Record<string, string>): Promise<T> {
    const query = new URLSearchParams(params);
    const qs = query.toString();
    const res = await fetch(`${API_BASE}/globals/${slug}${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error(`Failed to fetch global ${slug}: ${res.status}`);
    return res.json();
}

export interface FormSubmissionValue {
    field: string;
    value: string;
}


/**
 * Create a form-builder submission. `files` are ids returned by
 * `uploadApplicantFile`; they land in the submission's `files` relationship so
 * an admin can open the CV from the submission.
 */
export async function submitForm(
    formId: number,
    submissionData: FormSubmissionValue[],
    attribution?: Attribution | null,
    files?: number[]
): Promise<void> {
    const res = await fetch(`${API_BASE}/form-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            form: formId,
            submissionData,
            ...(files?.length ? { files } : {}),
            ...(attribution ? { attribution } : {}),
        }),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Failed to submit form: ${res.status} ${detail}`);
    }
}

/**
 * Add an email to the membership waitlist ("notify me when applications open").
 * Persists to the `waitlist-signups` collection (public create; admin-only read).
 */
export async function submitWaitlist(
    email: string,
    locale?: string,
    attribution?: Attribution | null
): Promise<void> {
    const res = await fetch(`${API_BASE}/waitlist-signups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            locale,
            ...(attribution ? { attribution } : {}),
        }),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Failed to join waitlist: ${res.status} ${detail}`);
    }
}

/** Thrown by `uploadApplicantFile` so the form can show a specific message. */
export class UploadError extends Error {
    constructor(
        message: string,
        public readonly reason: 'too-large' | 'wrong-type' | 'failed'
    ) {
        super(message);
    }
}

/**
 * Upload an applicant document (PDF) to the private `applicant-files`
 * collection. Anonymous create is allowed; only admins can read it back. The
 * returned id is attached to the form submission via `submitForm(..., files)`.
 */
export async function uploadApplicantFile(
    file: File,
    kind: string
): Promise<CmsApplicantFile> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('_payload', JSON.stringify({ kind }));
    const res = await fetch(`${API_BASE}/applicant-files`, {
        method: 'POST',
        body,
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        if (res.status === 413) throw new UploadError(detail, 'too-large');
        if (res.status === 400 && /mime|type/i.test(detail))
            throw new UploadError(detail, 'wrong-type');
        throw new UploadError(`Upload failed: ${res.status} ${detail}`, 'failed');
    }
    const data = (await res.json()) as { doc: CmsApplicantFile };
    return data.doc;
}

export function mediaUrl(
    media: { url?: string | null } | null | undefined
): string | null {
    if (!media?.url) return null;
    // If it's already absolute, return as-is
    if (media.url.startsWith('http')) return media.url;
    // Otherwise prefix with API base (strip /api suffix)
    const base = API_BASE.replace(/\/api$/, '');
    return `${base}${media.url}`;
}
