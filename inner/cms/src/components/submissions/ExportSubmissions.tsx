'use client';
import React, { useEffect, useState } from 'react';
import './submissions-export.css';

/**
 * "Download as Excel" panel above the Form Submissions list (registered via
 * formSubmissionOverrides.admin.components.beforeListTable). One button per
 * form; each links to /api/submissions-export.xlsx?form=<title>, which needs
 * the admin's login cookie and streams an .xlsx with the answers, file links,
 * review status + notes and attribution.
 */

type FormRow = { id: number; title: string; count: number | null };

export const ExportSubmissions: React.FC = () => {
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/forms?limit=100&depth=0&sort=title', { credentials: 'include' });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { docs: { id: number; title: string }[] };
        const rows: FormRow[] = await Promise.all(
          data.docs.map(async (f) => {
            try {
              const c = await fetch(
                `/api/form-submissions/count?where[form][equals]=${f.id}`,
                { credentials: 'include' },
              );
              const { totalDocs } = (await c.json()) as { totalDocs: number };
              return { id: f.id, title: f.title, count: totalDocs };
            } catch {
              return { id: f.id, title: f.title, count: null };
            }
          }),
        );
        if (!cancelled) setForms(rows);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sub-export">
      <div className="sub-export__head">
        <strong>Download as Excel</strong>
        <span className="sub-export__hint">
          One file per form: every answer, links to uploaded CVs, review status and notes, and where the
          applicant came from. The status column has a dropdown (Accepted / Unsure / Rejected) for
          reviewing in the sheet — remember to enter the decision here as well.
        </span>
      </div>
      {error && <p className="sub-export__error">Could not load the list of forms.</p>}
      {!error && !forms && <p className="sub-export__hint">Loading forms…</p>}
      {forms && (
        <div className="sub-export__actions">
          {forms.map((f) => (
            <a
              key={f.id}
              className="sub-export__btn"
              href={`/api/submissions-export.xlsx?form=${encodeURIComponent(f.title)}`}
              download
            >
              {f.title}
              {f.count !== null && <span className="sub-export__count">{f.count}</span>}
              <span className="sub-export__ext">.xlsx</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
