/**
 * The Datenschutz edits that go with the WS 2026/27 application forms and the
 * Munich TechTour, applied structurally to the Legal global's `privacyPolicy`
 * rich text (Payload Lexical JSON) instead of by hand in the editor:
 *
 *   1. section 5 "Application form" → "Application and registration forms
 *      (membership, Munich TechTour)": both forms, the CV storage, the internal
 *      review notes, recipients, retention;
 *   2. section 8, storage list → one more bullet for `cfc-techtour-intro`;
 *   3. section 3 "Hosting" → a closing paragraph naming the email provider.
 *
 * Sections are located by their heading number and topic, never by position,
 * and every edit is idempotent: running it twice changes nothing the second
 * time. Anything it cannot find it reports and leaves alone. The texts here
 * mirror GO-LIVE-RUNBOOK.md §7; two wording choices are options because they
 * are decisions for the association (see `defaultOptions`).
 */

// ---- Lexical builders (shapes copied from the live document) -------------

const textNode = (text, format = 0) => ({
  mode: 'normal',
  text,
  type: 'text',
  style: '',
  detail: 0,
  format,
  version: 1,
});

const paragraph = (children = []) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: children.length ? 'ltr' : null,
  textStyle: '',
  textFormat: 0,
  children,
});

const heading = (text, tag = 'h2') => ({
  tag,
  type: 'heading',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  children: [textNode(text)],
});

const link = (url, text) => ({
  type: 'link',
  fields: { url, linkType: 'custom', newTab: false },
  format: '',
  indent: 0,
  version: 3,
  direction: 'ltr',
  children: [textNode(text)],
});

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** `**bold**` → bold text nodes; bare email addresses → mailto links. */
export function inline(markdown) {
  const nodes = [];
  const pushPlain = (segment, format) => {
    const parts = segment.split(EMAIL_RE);
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 1) nodes.push(link(`mailto:${part}`, part));
      else nodes.push(textNode(part, format));
    });
  };
  markdown.split(/\*\*(.+?)\*\*/).forEach((segment, i) => pushPlain(segment, i % 2 === 1 ? 1 : 0));
  return nodes;
}

const plain = (node) =>
  !node
    ? ''
    : node.type === 'text'
      ? node.text ?? ''
      : node.type === 'linebreak'
        ? '\n'
        : (node.children ?? []).map(plain).join('');

const isEmptyParagraph = (n) => n?.type === 'paragraph' && plain(n).trim() === '';

/** [start, end) of the section whose h2 heading satisfies `match`; null if absent. */
function findSection(children, match) {
  const start = children.findIndex((n) => n.type === 'heading' && n.tag === 'h2' && match(plain(n)));
  if (start === -1) return null;
  let end = children.findIndex((n, i) => i > start && n.type === 'heading' && n.tag === 'h2');
  if (end === -1) end = children.length;
  return { start, end };
}

/** heading, then ('' , paragraph) per paragraph, then a trailing '' — the document's own rhythm. */
const sectionNodes = (title, paragraphs) => [
  heading(title),
  ...paragraphs.flatMap((p) => [paragraph(), paragraph(inline(p))]),
  paragraph(),
];

// ---- Texts ------------------------------------------------------------------

/**
 * `shareNames`: whether attendee names may be passed to a host company for
 * building access (false = the sentence is omitted). `transfer`: the legal
 * basis for the email provider's US transfer, 'scc' (Standard Contractual
 * Clauses) or 'dpf' (EU–US Data Privacy Framework) — check Resend's DPA.
 */
export const defaultOptions = { shareNames: false, transfer: 'scc' };

const TEXTS = {
  en: {
    section5Match: (h) => /^5\./.test(h) && /application/i.test(h),
    section5Done: (h) => /TechTour/.test(h),
    section5Title: '5. Application and registration forms (membership, Munich TechTour)',
    section5: ({ shareNames }) => [
      'Via our forms you can apply to contribute to Coding for Change e.V. (page "Join") and register for our event series Munich TechTour (page "TechTour"). The two can be combined: if you tick the box for the other form inside one of them, its additional questions appear and we create two separate records — an application and a registration.',
      'For a **membership application** we process your first and last name, email address, your motivation, your CV (PDF) and your confirmation of the expected time commitment. For a **TechTour registration** we process your first and last name, email address, your university and course of study, the evenings you selected, your commitment to attend and — only if you choose to attach one — your CV (PDF). In both cases we also store the time of submission, the language of the page and — without any reference to you as a person — the channel through which you reached the page (for example a poster QR code), see section 7.',
      'Processing of an application is based on Art. 6(1)(b) GDPR (pre-contractual measures towards a participation relationship); processing of a TechTour registration is based on Art. 6(1)(b) GDPR (organising the event you asked to attend). Insofar as you tick the consent box in the form, Art. 6(1)(a) GDPR is the additional legal basis; you can withdraw that consent at any time with effect for the future by emailing info@codingforchange.com.',
      'Your CV is uploaded to our server when you select the file and stored so that only logged-in members of our selection team, or of the team organising the TechTour, can open it; it is never publicly accessible. On the TechTour registration it is optional — you can register without one. A file you upload without then submitting the form is deleted automatically within 24 hours.',
      'During the selection process we keep an internal assessment for every application and registration (for example "accepted", "unsure", "declined") together with notes. These serve solely to decide on your application or registration, are deleted together with the other data, and are covered by your right of access (Art. 15 GDPR).',
      'The data is stored on our servers (section 3) and within the association is accessible only to the members entrusted with the selection or with organising the TechTour. For a TechTour registration we tell the host company the number of participants in advance.' +
        (shareNames
          ? ' We pass on your name only where the company requires it for access to its premises; we inform you of this by email beforehand.'
          : ' We do not pass on your name or contact details to the host companies.') +
        ' Our team is notified of every new application and registration by email; that email contains your answers (not your CV) and is sent through the email service described in section 3.',
      'If your application is successful, your data is stored for the duration of your involvement in the association. If it is unsuccessful, we delete the application including the CV at the latest six months after the application round has closed, unless you have consented to longer storage for future opportunities. TechTour registrations, including any CV attached to them, are deleted at the latest three months after the event week.',
    ],
    storageAnchor: /^- cfc-locale\b/,
    storageBullet:
      '- cfc-techtour-intro – remembers that you have already watched the opening animation of the TechTour page, so it is not shown again (browser storage, not a cookie). Strictly necessary, until you clear your site data.',
    hostingMatch: (h) => /^3\./.test(h) && /hosting/i.test(h),
    emailProvider: ({ transfer }) =>
      '**Email delivery.** Notifications to our team (new contact enquiries, applications, registrations) and emails to you (for example the waitlist notification) are sent through the email service Resend (Resend, Inc., San Francisco, USA), which processes sender and recipient addresses and the email content on our behalf under a data processing agreement (Art. 28 GDPR). ' +
      (transfer === 'dpf'
        ? 'Transfers to the USA are based on the EU–US Data Privacy Framework, under which Resend is certified. '
        : 'Transfers to the USA are based on the EU Standard Contractual Clauses. ') +
      'Legal basis: Art. 6(1)(f) GDPR (reliable delivery of the emails you or we have requested).',
  },
  de: {
    section5Match: (h) => /^5\./.test(h) && /bewerbung/i.test(h),
    section5Done: (h) => /TechTour/.test(h),
    section5Title: '5. Bewerbungs- und Anmeldeformulare (Mitgliedschaft, Munich TechTour)',
    section5: ({ shareNames }) => [
      'Über unsere Formulare können Sie sich für eine Mitwirkung bei Coding for Change e.V. bewerben (Seite „Mitmachen“) und sich für unsere Veranstaltungsreihe Munich TechTour anmelden (Seite „TechTour“). Beides lässt sich kombinieren: Wenn Sie in einem der Formulare das Kästchen für das jeweils andere setzen, erscheinen dessen zusätzliche Fragen, und wir legen zwei getrennte Datensätze an – eine Bewerbung und eine Anmeldung.',
      'Bei einer **Mitgliedsbewerbung** verarbeiten wir Vor- und Nachname, E-Mail-Adresse, Ihre Motivation, Ihren Lebenslauf (PDF) sowie Ihre Bestätigung des zu erwartenden Zeitaufwands. Bei einer **TechTour-Anmeldung** verarbeiten wir Vor- und Nachname, E-Mail-Adresse, Hochschule und Studiengang, die von Ihnen gewählten Abende, Ihre Teilnahmezusage sowie – nur wenn Sie ihn freiwillig anhängen – Ihren Lebenslauf (PDF). In beiden Fällen speichern wir außerdem den Zeitpunkt der Übermittlung, die Sprache der Seite und – ohne Bezug zu Ihrer Person – über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.',
      'Die Verarbeitung einer Bewerbung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen zur Begründung eines Mitwirkungsverhältnisses); die Verarbeitung einer TechTour-Anmeldung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Durchführung der Veranstaltung, an der Sie teilnehmen möchten). Soweit Sie im Formular das Einwilligungskästchen setzen, ist zusätzlich Art. 6 Abs. 1 lit. a DSGVO Rechtsgrundlage; diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft per E-Mail an info@codingforchange.com widerrufen.',
      'Ihr Lebenslauf wird beim Auswählen der Datei auf unseren Server hochgeladen und dort so gespeichert, dass nur eingeloggte Mitglieder unseres Auswahlteams oder des TechTour-Organisationsteams ihn öffnen können; er ist zu keinem Zeitpunkt öffentlich abrufbar. Bei der TechTour-Anmeldung ist er freiwillig – Sie können sich auch ohne anmelden. Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht.',
      'Im Auswahlverfahren halten wir zu jeder Bewerbung und Anmeldung intern eine Bewertung (z. B. „angenommen“, „unsicher“, „abgelehnt“) sowie Notizen fest. Diese dienen ausschließlich der Entscheidung über Ihre Bewerbung bzw. Anmeldung, werden zusammen mit den übrigen Daten gelöscht und sind von Ihrem Auskunftsrecht (Art. 15 DSGVO) umfasst.',
      'Die Daten werden auf unseren Servern (Ziffer 3) gespeichert und innerhalb des Vereins nur den mit der Auswahl bzw. der Organisation der TechTour betrauten Mitgliedern zugänglich gemacht. Bei einer TechTour-Anmeldung teilen wir dem gastgebenden Unternehmen vorab die Teilnehmerzahl mit.' +
        (shareNames
          ? ' Ihren Namen geben wir nur weiter, wenn das Unternehmen dies für den Zutritt zu seinen Räumen verlangt; darüber informieren wir Sie vorher per E-Mail.'
          : ' Ihren Namen und Ihre Kontaktdaten geben wir nicht an die gastgebenden Unternehmen weiter.') +
        ' Über jede neue Bewerbung und Anmeldung wird unser Team per E-Mail benachrichtigt; diese E-Mail enthält Ihre Angaben (nicht den Lebenslauf) und wird über den in Ziffer 3 beschriebenen E-Mail-Dienst versendet.',
      'Im Falle einer Zusage werden Ihre Daten für die Dauer Ihrer Mitwirkung im Verein gespeichert. Im Falle einer Absage löschen wir die Bewerbung einschließlich Lebenslauf spätestens sechs Monate nach Ende der Bewerbungsrunde, sofern Sie nicht in eine längere Speicherung für künftige Gelegenheiten eingewilligt haben. TechTour-Anmeldungen löschen wir einschließlich eines etwaigen Lebenslaufs spätestens drei Monate nach der Veranstaltungswoche.',
    ],
    storageAnchor: /^- cfc-locale\b/,
    storageBullet:
      '- cfc-techtour-intro – merkt sich, dass Sie die Eröffnungsanimation der TechTour-Seite bereits gesehen haben, damit sie nicht erneut abgespielt wird (Browser-Speicher, kein Cookie). Unbedingt erforderlich, bis Sie Ihre Website-Daten löschen.',
    hostingMatch: (h) => /^3\./.test(h) && /hosting/i.test(h),
    emailProvider: ({ transfer }) =>
      '**E-Mail-Versand.** Benachrichtigungen an unser Team (neue Kontaktanfragen, Bewerbungen, Anmeldungen) sowie E-Mails an Sie (z. B. die Wartelisten-Benachrichtigung) versenden wir über den E-Mail-Dienst Resend (Resend, Inc., San Francisco, USA), der Absender- und Empfängeradresse sowie den Inhalt der E-Mail in unserem Auftrag auf Grundlage eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO) verarbeitet. ' +
      (transfer === 'dpf'
        ? 'Die Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy Framework, unter dem Resend zertifiziert ist. '
        : 'Die Übermittlung in die USA erfolgt auf Grundlage der EU-Standardvertragsklauseln. ') +
      'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (zuverlässige Zustellung der von Ihnen oder uns veranlassten E-Mails).',
  },
};

// ---- The edit -----------------------------------------------------------------

/**
 * Returns `{ doc, changes, skipped }` — a new document (the input is not
 * mutated), what was changed, and what was left alone and why.
 */
export function applyPrivacyEdits(doc, locale, options = {}) {
  const opts = { ...defaultOptions, ...options };
  const t = TEXTS[locale];
  if (!t) throw new Error(`No texts for locale "${locale}"`);
  const out = JSON.parse(JSON.stringify(doc));
  const children = out.root.children;
  const changes = [];
  const skipped = [];

  // 1. Section 5
  const s5 = findSection(children, t.section5Match);
  if (!s5) {
    skipped.push('section 5 (application form) not found — left unchanged');
  } else if (t.section5Done(plain(children[s5.start]))) {
    skipped.push('section 5 already covers the TechTour — left unchanged');
  } else {
    children.splice(s5.start, s5.end - s5.start, ...sectionNodes(t.section5Title, t.section5(opts)));
    changes.push(`section 5 replaced → "${t.section5Title}"`);
  }

  // 2. Storage list bullet (section 8)
  if (children.some((n) => plain(n).includes('cfc-techtour-intro'))) {
    skipped.push('storage list already lists cfc-techtour-intro');
  } else {
    const anchor = children.findIndex((n) => n.type === 'paragraph' && t.storageAnchor.test(plain(n).trim()));
    if (anchor === -1) skipped.push('storage list bullet for cfc-locale not found — bullet not added');
    else {
      children.splice(anchor + 1, 0, paragraph(inline(t.storageBullet)));
      changes.push('storage list: bullet for cfc-techtour-intro added after cfc-locale');
    }
  }

  // 3. Email provider (section 3)
  const s3 = findSection(children, t.hostingMatch);
  if (!s3) {
    skipped.push('section 3 (hosting) not found — email provider not added');
  } else if (children.slice(s3.start, s3.end).some((n) => /Resend/.test(plain(n)))) {
    skipped.push('section 3 already names the email provider');
  } else {
    // Keep the trailing empty paragraph as the section's last node.
    const insertAt = isEmptyParagraph(children[s3.end - 1]) ? s3.end - 1 : s3.end;
    children.splice(insertAt, 0, paragraph(), paragraph(inline(t.emailProvider(opts))));
    changes.push('section 3: email provider paragraph appended');
  }

  return { doc: out, changes, skipped };
}

/** Section headings + the paragraphs of a section, for reports and checks. */
export function sectionText(doc, match) {
  const children = doc.root.children;
  const s = findSection(children, match);
  if (!s) return null;
  return children
    .slice(s.start, s.end)
    .map(plain)
    .filter((x) => x.trim())
    .join('\n');
}

export const headings = (doc) =>
  doc.root.children.filter((n) => n.type === 'heading').map((n) => `${n.tag} ${plain(n)}`);
