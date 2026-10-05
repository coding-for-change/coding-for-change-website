'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { TextFieldClientComponent } from 'payload';
import { FieldDescription, FieldError, FieldLabel, useConfig, useField, useFormFields } from '@payloadcms/ui';
import './share.css';

type Option = { value: string; label: string };
type FormDoc = { id: number; fields?: { blockType: string; options?: { value: string; label?: string | null }[] | null }[] };

/**
 * The "Evening" of a host share link: a dropdown of the registration form's
 * evenings (the options of its multi-select), stored as the option's key.
 * Opened from the review workspace with ?option=…, it starts on that evening.
 */
export const EveningField: TextFieldClientComponent = ({ field, path: pathProp }) => {
  const path = pathProp ?? field.name;
  const { value, setValue, showError, errorMessage } = useField<string>({ path });
  const formValue = useFormFields(([fields]) => fields.form?.value) as number | { id: number } | undefined;
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const [options, setOptions] = useState<Option[] | null>(null);

  // Opened with ?option=…: start on that evening – once, after the form has
  // loaded (an earlier value would be overwritten as the form initialises),
  // and never again once someone has changed it.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || options === null) return;
    prefilled.current = true;
    const wanted = new URLSearchParams(window.location.search).get('option');
    if (!value && wanted && options.some((o) => o.value === wanted)) setValue(wanted);
  }, [options, value, setValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const formId = typeof formValue === 'object' && formValue ? formValue.id : formValue;
      const url = formId
        ? `${api}/forms/${formId}?depth=0&locale=en`
        : `${api}/forms?where[title][equals]=techtour&depth=0&locale=en&limit=1`;
      const res = await fetch(url, { credentials: 'include' });
      const data = (await res.json()) as FormDoc & { docs?: FormDoc[] };
      const form = data.docs ? data.docs[0] : data;
      const group = form?.fields?.find((b) => b.blockType === 'checkboxGroup' && (b.options?.length ?? 0) > 0);
      if (!cancelled) setOptions((group?.options ?? []).map((o) => ({ value: o.value, label: o.label || o.value })));
    })().catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [formValue, api]);

  const known = options?.some((o) => o.value === value);
  return (
    <div className="field-type text share-evening">
      <FieldLabel label={field.label || 'Evening'} required={field.required} path={path} htmlFor={`field-${path}`} />
      <select
        id={`field-${path}`}
        className="share-evening__select"
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value)}
        disabled={options === null}
      >
        <option value="">{options === null ? 'Loading the evenings…' : 'Pick the evening…'}</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {value && options && !known && <option value={value}>{value} (no longer on the form)</option>}
      </select>
      <FieldError path={path} message={errorMessage} showError={showError} />
      <FieldDescription path={path} description={field.admin?.description as string | undefined} />
    </div>
  );
};
