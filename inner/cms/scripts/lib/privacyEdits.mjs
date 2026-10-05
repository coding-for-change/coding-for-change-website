/**
 * The Datenschutz edits that go with the application forms and the Munich
 * TechTour, applied structurally to the Legal global's `privacyPolicy` rich
 * text (Payload Lexical JSON) instead of by hand in the editor:
 *
 *   1. section 5 → "Application and registration forms (membership, Munich
 *      TechTour)": both forms, the CV storage, the TechTour's host companies
 *      (each sees the registrations for its evening and decides who attends),
 *      the internal assessment, recipients, retention;
 *   2. section 8, storage list → one more bullet for `cfc-techtour-intro`;
 *   3. section 3 "Hosting" → a closing paragraph naming the email provider;
 *   4. the closing section's "dated …" line → the month of this version.
 *
 * Sections are located by their heading number and topic, never by position,
 * and every edit is idempotent: running it twice changes nothing the second
 * time. Anything it cannot find it reports and leaves alone. The texts here
 * mirror GO-LIVE-RUNBOOK.md §7; the email provider's transfer basis is an
 * option because it is a decision for the association (see `defaultOptions`).
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
 * `transfer`: the legal basis for the email provider's US transfer, 'scc'
 * (Standard Contractual Clauses) or 'dpf' (EU–US Data Privacy Framework) —
 * check Resend's DPA.
 */
export const defaultOptions = { transfer: 'scc' };

const TEXTS = {
  en: {
    section5Match: (h) => /^5\./.test(h) && /application/i.test(h),
    // This version is the one that names the host companies; any older
    // section 5 (the original "Application form", or the first TechTour
    // version that said names are not passed on) is replaced.
    section5Current: (text) => text.includes('Host companies of the TechTour'),
    section5Title: '5. Application and registration forms (membership, Munich TechTour)',
    section5: [
      'Via our forms you can apply to contribute to Coding for Change e.V. (page "Join") and register for our event series Munich TechTour (page "TechTour"). The two can be combined: if you tick the box for the other form inside one of them, its additional questions appear and we create two separate records – an application and a registration.',
      'For a **membership application** we process your first and last name, email address, where you study, your answers to our questions (for example about your motivation, your experience and where you would like to contribute), your CV (PDF) and your confirmations (for example of the expected time commitment). For a **TechTour registration** we process your first and last name, email address, the evenings you selected, your CV (PDF), any further details the form asks for (for example your university) and your confirmations (your commitment to attend, and that the host companies see your registration). In both cases we also store the time of submission, the language of the page, the wording of the boxes you ticked (as proof of what you confirmed) and – without any reference to you as a person – the channel through which you reached the page (for example a poster QR code), see section 7.',
      "Processing of an application is based on Art. 6(1)(b) GDPR (pre-contractual measures towards a participation relationship); processing of a TechTour registration is based on Art. 6(1)(b) GDPR (organising the event you asked to attend, including the host company's decision on who attends, see below). Insofar as you tick the consent box in the form, Art. 6(1)(a) GDPR is the additional legal basis; you can withdraw that consent at any time with effect for the future by emailing info@codingforchange.com.",
      'Your CV is uploaded to our server when you select the file and is never publicly accessible: within the association only logged-in members of our selection team, or of the team organising the TechTour, can open it, and for a TechTour registration also the host companies of the evenings you selected (see the next paragraph). A file you upload without then submitting the form is deleted automatically within 24 hours.',
      "**Host companies of the TechTour.** Every TechTour evening is hosted by a company, and that company decides who attends its evening. For this purpose we give the host company of each evening you selected access to your registration for that evening – your name, your CV and the other details you entered (for example your university), but not your email address – through a private link that only that company's contacts can open, that expires at the end of the event week at the latest and that we can block at any time; every access is logged. You confirm this in the form. The host company decides on your attendance and prepares the evening (for example access to its premises) under its own responsibility (Art. 4(7) GDPR); we ask the companies to use your data for nothing else and to delete any copies they downloaded after the event. We store the company's decision in order to let you know.",
      'During the selection process we keep an internal assessment for every application and registration (for example a score from 1 to 10, or "accepted", "unsure", "declined") together with notes. These serve solely to decide on your application or registration, are not passed on to the host companies, are deleted together with the other data, and are covered by your right of access (Art. 15 GDPR).',
      'The data is stored on our servers (section 3) and within the association is accessible only to the members entrusted with the selection or with organising the TechTour. Our team is notified of every new application and registration by email; that email contains your answers (not your CV) and is sent through the email service described in section 3.',
      "If your application is successful, your data is stored for the duration of your involvement in the association. If it is unsuccessful, we delete the application including the CV at the latest six months after the application round has closed, unless you have consented to longer storage for future opportunities. TechTour registrations, including the CV and the host company's decision, are deleted at the latest three months after the event week.",
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
    datedMatch: (h) => /^\d+\./.test(h) && /currency/i.test(h),
    dated: /\bdated [A-Z][a-z]+ \d{4}\b/,
    datedNow: 'dated October 2026',
  },
  de: {
    section5Match: (h) => /^5\./.test(h) && /bewerbung/i.test(h),
    section5Current: (text) => text.includes('Gastgebende Unternehmen der TechTour'),
    section5Title: '5. Bewerbungs- und Anmeldeformulare (Mitgliedschaft, Munich TechTour)',
    section5: [
      'Über unsere Formulare können Sie sich für eine Mitwirkung bei Coding for Change e.V. bewerben (Seite „Mitmachen“) und sich für unsere Veranstaltungsreihe Munich TechTour anmelden (Seite „TechTour“). Beides lässt sich kombinieren: Wenn Sie in einem der Formulare das Kästchen für das jeweils andere setzen, erscheinen dessen zusätzliche Fragen, und wir legen zwei getrennte Datensätze an – eine Bewerbung und eine Anmeldung.',
      'Bei einer **Mitgliedsbewerbung** verarbeiten wir Vor- und Nachname, E-Mail-Adresse, wo Sie studieren, Ihre Antworten auf unsere Fragen (z. B. zu Ihrer Motivation, Ihren Erfahrungen und dem Bereich, in dem Sie mitwirken möchten), Ihren Lebenslauf (PDF) sowie Ihre Bestätigungen (z. B. des zu erwartenden Zeitaufwands). Bei einer **TechTour-Anmeldung** verarbeiten wir Vor- und Nachname, E-Mail-Adresse, die von Ihnen gewählten Abende, Ihren Lebenslauf (PDF), weitere im Formular erfragte Angaben (z. B. Ihre Hochschule) sowie Ihre Bestätigungen (Ihre Teilnahmezusage und dass die gastgebenden Unternehmen Ihre Anmeldung sehen). In beiden Fällen speichern wir außerdem den Zeitpunkt der Übermittlung, die Sprache der Seite, den Wortlaut der Kästchen, die Sie gesetzt haben (als Nachweis dessen, was Sie bestätigt haben), und – ohne Bezug zu Ihrer Person – über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.',
      'Die Verarbeitung einer Bewerbung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen zur Begründung eines Mitwirkungsverhältnisses); die Verarbeitung einer TechTour-Anmeldung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Durchführung der Veranstaltung, an der Sie teilnehmen möchten, einschließlich der Entscheidung des gastgebenden Unternehmens, wer teilnimmt, siehe unten). Soweit Sie im Formular das Einwilligungskästchen setzen, ist zusätzlich Art. 6 Abs. 1 lit. a DSGVO Rechtsgrundlage; diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft per E-Mail an info@codingforchange.com widerrufen.',
      'Ihr Lebenslauf wird beim Auswählen der Datei auf unseren Server hochgeladen und ist zu keinem Zeitpunkt öffentlich abrufbar: Innerhalb des Vereins können ihn nur eingeloggte Mitglieder unseres Auswahlteams oder des TechTour-Organisationsteams öffnen, bei einer TechTour-Anmeldung außerdem die gastgebenden Unternehmen der von Ihnen gewählten Abende (siehe den nächsten Absatz). Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht.',
      '**Gastgebende Unternehmen der TechTour.** Jeder TechTour-Abend wird von einem Unternehmen ausgerichtet, und dieses Unternehmen entscheidet, wer an seinem Abend teilnimmt. Zu diesem Zweck geben wir dem gastgebenden Unternehmen jedes von Ihnen gewählten Abends Zugriff auf Ihre Anmeldung zu diesem Abend – Ihren Namen, Ihren Lebenslauf und Ihre weiteren Angaben (z. B. Ihre Hochschule), nicht aber Ihre E-Mail-Adresse – über einen privaten Link, den nur die Ansprechpersonen dieses Unternehmens öffnen können, der spätestens mit Ende der Veranstaltungswoche abläuft und den wir jederzeit sperren können; jeder Zugriff wird protokolliert. Dies bestätigen Sie im Formular. Das gastgebende Unternehmen entscheidet in eigener Verantwortung (Art. 4 Nr. 7 DSGVO) über Ihre Teilnahme und bereitet den Abend vor (z. B. den Zutritt zu seinen Räumen); wir bitten die Unternehmen, Ihre Daten für nichts anderes zu nutzen und heruntergeladene Kopien nach der Veranstaltung zu löschen. Die Entscheidung des Unternehmens speichern wir, um Sie darüber zu informieren.',
      'Im Auswahlverfahren halten wir zu jeder Bewerbung und Anmeldung intern eine Bewertung (z. B. eine Punktzahl von 1 bis 10 oder „angenommen“, „unsicher“, „abgelehnt“) sowie Notizen fest. Diese dienen ausschließlich der Entscheidung über Ihre Bewerbung bzw. Anmeldung, werden nicht an die gastgebenden Unternehmen weitergegeben, werden zusammen mit den übrigen Daten gelöscht und sind von Ihrem Auskunftsrecht (Art. 15 DSGVO) umfasst.',
      'Die Daten werden auf unseren Servern (Ziffer 3) gespeichert und innerhalb des Vereins nur den mit der Auswahl bzw. der Organisation der TechTour betrauten Mitgliedern zugänglich gemacht. Über jede neue Bewerbung und Anmeldung wird unser Team per E-Mail benachrichtigt; diese E-Mail enthält Ihre Angaben (nicht den Lebenslauf) und wird über den in Ziffer 3 beschriebenen E-Mail-Dienst versendet.',
      'Im Falle einer Zusage werden Ihre Daten für die Dauer Ihrer Mitwirkung im Verein gespeichert. Im Falle einer Absage löschen wir die Bewerbung einschließlich Lebenslauf spätestens sechs Monate nach Ende der Bewerbungsrunde, sofern Sie nicht in eine längere Speicherung für künftige Gelegenheiten eingewilligt haben. TechTour-Anmeldungen löschen wir einschließlich Lebenslauf und der Entscheidung des gastgebenden Unternehmens spätestens drei Monate nach der Veranstaltungswoche.',
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
    datedMatch: (h) => /^\d+\./.test(h) && /aktualität/i.test(h),
    dated: /\bStand [A-ZÄÖÜ][a-zäöü]+ \d{4}\b/,
    datedNow: 'Stand Oktober 2026',
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
  } else if (t.section5Current(children.slice(s5.start, s5.end).map(plain).join('\n'))) {
    skipped.push('section 5 already names the host companies — left unchanged');
  } else {
    children.splice(s5.start, s5.end - s5.start, ...sectionNodes(t.section5Title, t.section5));
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

  // 4. "This privacy policy is dated …" in the closing section
  const s17 = findSection(children, t.datedMatch);
  const datedAt = s17
    ? children.slice(s17.start, s17.end).findIndex((n) => n.type === 'paragraph' && t.dated.test(plain(n)))
    : -1;
  if (!s17 || datedAt === -1) {
    skipped.push('closing section with the "dated …" line not found — date not updated');
  } else {
    const node = children[s17.start + datedAt];
    const textChild = (node.children ?? []).find((c) => c.type === 'text' && t.dated.test(c.text ?? ''));
    if (plain(node).includes(t.datedNow)) {
      skipped.push(`closing section already says "${t.datedNow}"`);
    } else if (!textChild) {
      skipped.push('the "dated …" line is split across formatting — date not updated');
    } else {
      textChild.text = textChild.text.replace(t.dated, t.datedNow);
      changes.push(`closing section: "${t.datedNow}"`);
    }
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
