/**
 * The Datenschutz edits that go with the application forms and the Munich
 * TechTour, applied structurally to the Legal global's `privacyPolicy` rich
 * text (Payload Lexical JSON) instead of by hand in the editor:
 *
 *   1. section 5 → "Application form (membership)": the membership
 *      application only – its data, legal basis, CV storage, internal
 *      assessment, retention;
 *   2. section 5a "Munich TechTour", right after it: the registration, on the
 *      registrant's consent (Art. 6(1)(a) GDPR) – purpose, data, the two
 *      consent boxes and how they are logged, the partner companies of the
 *      evenings picked as recipients (private expiring link, email address
 *      only once admitted), the optional "future events" box, the spam trap,
 *      retention (the deletion day), withdrawal and rights, and the partner
 *      companies' contact persons;
 *   3. section 8, storage list → bullets for `cfc-techtour-intro`, the host
 *      share link's sign-in cookie `cfc-share`, and the two saved-form keys
 *      `cfc-techtour-draft` / `cfc-application-draft`;
 *   4. section 3 "Hosting" → a closing paragraph naming the email provider;
 *   5. section 9 "Google Ads" → the TechTour registration among the actions
 *      the Google tag records (with consent only, see section 5a);
 *   6. the closing section's "dated …" line → the month of this version.
 *
 * Sections are located by their heading number and topic, never by position,
 * and every edit is idempotent: running it twice changes nothing the second
 * time. Anything it cannot find it reports and leaves alone. The texts here
 * are the ones in TECHTOUR-DATENSCHUTZ.md (the admin guide), so pasting by hand
 * and running the script end the same way; the email provider's transfer
 * basis is an option because it is a decision for the association (see
 * `defaultOptions`).
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

export const TEXTS = {
  en: {
    section5Match: (h) => /^5\./.test(h) && /application/i.test(h),
    // The version that hands the TechTour over to section 5a; any older
    // section 5 (one section for both forms) is replaced.
    section5Current: (text) => text.includes('section 5a'),
    section5Title: '5. Application form (membership)',
    section5: [
      'Via the application form on our page "Join" you can apply to contribute to Coding for Change e.V. It can be combined with the registration for the Munich TechTour: if you tick the box for the other form inside one of them, its additional questions appear and we create two separate records – an application (this section) and a registration (section 5a).',
      'For an application we process your first and last name, email address, where you study, your answers to our questions (for example about your motivation, your experience and where you would like to contribute), your CV (PDF) and your confirmations (for example of the expected time commitment). We also store the time of submission, the language of the page, the wording of every box you ticked together with an identifier of that version of the wording (as proof of what you confirmed), and the channel through which you reached the page (for example a poster QR code), see section 7.',
      'Processing is based on Art. 6(1)(b) GDPR (pre-contractual measures towards a participation relationship). Insofar as you tick the consent box in the form, Art. 6(1)(a) GDPR is the additional legal basis; you can withdraw that consent at any time with effect for the future by emailing info@codingforchange.com.',
      'Your CV is uploaded to our server when you select the file and is never publicly accessible: within the association only logged-in members of our selection team can open it. A file you upload without then submitting the form is deleted automatically within 24 hours.',
      'During the selection process we keep an internal assessment for every application (for example a score from 1 to 10, or "accepted", "unsure", "declined") together with notes. These serve solely to decide on your application, are deleted together with the other data, and are covered by your right of access (Art. 15 GDPR).',
      'The data is stored on our servers in Germany (section 3) and within the association is accessible only to the members entrusted with the selection. Our team is notified of every new application by email; that email contains your answers (not your CV) and is sent through the email service described in section 3.',
      'If your application is successful, your data is stored for the duration of your involvement in the association. If it is unsuccessful, we delete the application including the CV at the latest six months after the application round has closed, unless you have consented to longer storage for future opportunities.',
    ],
    section5aMatch: (h) => /^5a\./.test(h),
    section5aCurrent: (text) => text.includes('it may then contact you'),
    section5aTitle: '5a. Munich TechTour',
    section5a: [
      'Via the registration form on our page "TechTour" you can register for the evenings of our event series Munich TechTour. Each evening is hosted by a partner company, which selects the participants for its evening. We process your data to organise the TechTour: to receive your registration, to pass it on for selection to the partner companies of the evenings you picked, to let you know their decision, and to hold the evenings.',
      'For this we process your first and last name, your email address, your university, your degree programme and semester, the evenings you picked, your CV (PDF) or instead the link to your LinkedIn profile, and, if you like, a few words on why you want to join. Nothing else is required. We also store the time of submission, the language of the page and the channel through which you reached the page (for example a poster QR code), see section 7.',
      '**Legal basis and proof.** The legal basis is your consent (Art. 6(1)(a) GDPR), which you give in the form with two separate boxes: to our processing of your details to handle your registration, and to passing them on to the partner companies (next paragraph). Both are needed to register, because the partner companies select the participants; without them we cannot consider your registration. As proof of your consent (Art. 7(1) GDPR) we store, for every box you tick, its wording, an identifier of that version of the wording and the time, together with the evenings you picked.',
      '**Recipients.** We pass your details and your CV (or LinkedIn link) on only to the partner companies of the evenings you picked – in 2026 Project A (9 November), Lio (10 November), QuantCo (11 November) and QuantumBlack (McKinsey & Company, 12 November). The companies see your registration through a private link that only their named contacts can open after confirming their email address, that expires at the end of the event week at the latest and that we can block at any time; every access is logged. A company sees your email address only once it has selected you for its evening; it may then contact you so that you can register for the evening (for example for access to its premises). No company sees your other evenings, our internal assessment or any membership application. The partner companies decide on your attendance and process the data they receive under their own responsibility (Art. 4(7) GDPR); we ask them to use your data only to select, contact and host you, and to delete any copies they downloaded after the event. We store their decision with your registration in order to let you know.',
      'Your details and your CV are stored on our servers in Germany (section 3) and are never publicly accessible: within the association only logged-in members of the team organising the TechTour can access them, and outside it only the partner companies as described above. A file you upload without then submitting the form is deleted automatically within 24 hours. Notifications of new registrations to our team and emails to you are sent through the email service described in section 3; they do not contain your CV. During the selection we may keep an internal assessment and notes on your registration; they serve only to organise the evenings, are not passed on to the partner companies and are deleted with the registration.',
      '**Future events (optional).** If you also tick the optional box for information about future events, we email you about future events of Coding for Change (Art. 6(1)(a) GDPR). This box is not a condition for registering, and you can withdraw this consent at any time by emailing info@codingforchange.com without affecting your registration. It is stored with your registration and deleted with it.',
      '**Spam protection.** The form contains a field that people do not see and that catches automated submissions (a so-called honeypot). It collects no additional data about you and involves no third-party service – in particular no reCAPTCHA. We report a Google Ads conversion for sending this form only if you have agreed to advertising measurement in the cookie banner (section 9).',
      '**Retention.** We delete your registration, including your CV, the partner companies\' decisions and the proof of your consent, automatically on 31 January 2027 (at the latest three months after the event week). The partner companies\' private links and their access logs are deleted at the same time.',
      '**Withdrawal.** You can withdraw your consent at any time with effect for the future, most easily by emailing info@codingforchange.com. If you withdraw your consent to our processing or to passing your data on, we delete your registration including your CV; partner companies then no longer see it, and we ask those that have already seen it to delete any copies. You can then no longer take part in the TechTour. Withdrawal does not affect the lawfulness of processing before it (Art. 7(3) GDPR).',
      '**Your rights.** You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20), insofar as we rely on legitimate interests (section 7) the right to object (Art. 21), and the right to lodge a complaint with a supervisory authority (Art. 77 GDPR); see sections 15 and 16. An informal email to info@codingforchange.com is enough.',
      '**Contact persons of the partner companies.** If you open such a link as the contact person of a partner company, we process the email address you sign in with and a log of when the link was used and which CV was opened or what was decided, to protect the registrations (Art. 6(1)(f) GDPR). Signing in sets a cookie that is strictly necessary for it (section 8). Both are deleted together with the link.',
    ],
    storageAnchor: /^- cfc-locale\b/,
    storageBullet:
      '- cfc-techtour-intro – remembers that you have already watched the opening animation of the TechTour page, so it is not shown again (browser storage, not a cookie). Strictly necessary, until you clear your site data.',
    shareAnchor: /^- cfc-techtour-intro\b/,
    shareBullet:
      '- cfc-share – keeps the contact person of a TechTour partner company signed in to the private registration link after they confirmed their email address with a code (cookie, only on that link and only for them). Strictly necessary, for up to 12 hours.',
    draftBullets: [
      '- cfc-techtour-draft – keeps the answers you have typed into the TechTour registration when you press "save and finish later", in this browser only (browser storage, not a cookie; no ticked boxes, no CV). Strictly necessary, until you send the form or delete the saved answers, at most 30 days.',
      '- cfc-application-draft – keeps the answers you have typed into the membership application as you type, in this browser only (browser storage, not a cookie; no ticked boxes, no CV). Strictly necessary, until you send the form or delete the saved answers, at most 30 days.',
    ],
    hostingMatch: (h) => /^3\./.test(h) && /hosting/i.test(h),
    emailProvider: ({ transfer }) =>
      '**Email delivery.** Notifications to our team (new contact enquiries, applications, registrations) and emails to you (for example the waitlist notification) are sent through the email service Resend (Resend, Inc., San Francisco, USA), which processes sender and recipient addresses and the email content on our behalf under a data processing agreement (Art. 28 GDPR). ' +
      (transfer === 'dpf'
        ? 'Transfers to the USA are based on the EU–US Data Privacy Framework, under which Resend is certified. '
        : 'Transfers to the USA are based on the EU Standard Contractual Clauses. ') +
      'Legal basis: Art. 6(1)(f) GDPR (reliable delivery of the emails you or we have requested).',
    adsMatch: (h) => /^9\./.test(h) && /google ads/i.test(h),
    adsOld: 'one of four actions',
    adsNew:
      "What happens: if you consent, Google's tag records when you complete one of five actions – joining the waitlist, submitting a membership application, registering for the Munich TechTour, sending a contact enquiry, or booking an appointment – and links it to the advertisement you clicked. For this purpose Google sets the cookies _gcl_aw and _gcl_dc and processes the click identifier contained in the ad link.",
    datedMatch: (h) => /^\d+\./.test(h) && /currency/i.test(h),
    dated: /\bdated [A-Z][a-z]+ \d{4}\b/,
    datedNow: 'dated October 2026',
  },
  de: {
    section5Match: (h) => /^5\./.test(h) && /bewerbung/i.test(h),
    section5Current: (text) => text.includes('Ziffer 5a'),
    section5Title: '5. Bewerbungsformular (Mitgliedschaft)',
    section5: [
      'Über das Bewerbungsformular auf unserer Seite „Mitmachen“ können Sie sich für eine Mitwirkung bei Coding for Change e.V. bewerben. Es lässt sich mit der Anmeldung zur Munich TechTour kombinieren: Wenn Sie in einem der Formulare das Kästchen für das jeweils andere setzen, erscheinen dessen zusätzliche Fragen, und wir legen zwei getrennte Datensätze an – eine Bewerbung (diese Ziffer) und eine Anmeldung (Ziffer 5a).',
      'Bei einer Bewerbung verarbeiten wir Vor- und Nachname, E-Mail-Adresse, wo Sie studieren, Ihre Antworten auf unsere Fragen (z. B. zu Ihrer Motivation, Ihren Erfahrungen und dem Bereich, in dem Sie mitwirken möchten), Ihren Lebenslauf (PDF) sowie Ihre Bestätigungen (z. B. des zu erwartenden Zeitaufwands). Außerdem speichern wir den Zeitpunkt der Übermittlung, die Sprache der Seite, den Wortlaut jedes Kästchens, das Sie gesetzt haben, mit einer Kennung der Fassung dieses Wortlauts (als Nachweis dessen, was Sie bestätigt haben), und über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.',
      'Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen zur Begründung eines Mitwirkungsverhältnisses). Soweit Sie im Formular das Einwilligungskästchen setzen, ist zusätzlich Art. 6 Abs. 1 lit. a DSGVO Rechtsgrundlage; diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft per E-Mail an info@codingforchange.com widerrufen.',
      'Ihr Lebenslauf wird beim Auswählen der Datei auf unseren Server hochgeladen und ist zu keinem Zeitpunkt öffentlich abrufbar: Innerhalb des Vereins können ihn nur eingeloggte Mitglieder unseres Auswahlteams öffnen. Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht.',
      'Im Auswahlverfahren halten wir zu jeder Bewerbung intern eine Bewertung (z. B. eine Punktzahl von 1 bis 10 oder „angenommen“, „unsicher“, „abgelehnt“) sowie Notizen fest. Diese dienen ausschließlich der Entscheidung über Ihre Bewerbung, werden zusammen mit den übrigen Daten gelöscht und sind von Ihrem Auskunftsrecht (Art. 15 DSGVO) umfasst.',
      'Die Daten werden auf unseren Servern in Deutschland (Ziffer 3) gespeichert und innerhalb des Vereins nur den mit der Auswahl betrauten Mitgliedern zugänglich gemacht. Über jede neue Bewerbung wird unser Team per E-Mail benachrichtigt; diese E-Mail enthält Ihre Angaben (nicht den Lebenslauf) und wird über den in Ziffer 3 beschriebenen E-Mail-Dienst versendet.',
      'Im Falle einer Zusage werden Ihre Daten für die Dauer Ihrer Mitwirkung im Verein gespeichert. Im Falle einer Absage löschen wir die Bewerbung einschließlich Lebenslauf spätestens sechs Monate nach Ende der Bewerbungsrunde, sofern Sie nicht in eine längere Speicherung für künftige Gelegenheiten eingewilligt haben.',
    ],
    section5aMatch: (h) => /^5a\./.test(h),
    section5aCurrent: (text) => text.includes('darf Sie dann kontaktieren'),
    section5aTitle: '5a. Munich TechTour',
    section5a: [
      'Über das Anmeldeformular auf unserer Seite „TechTour“ können Sie sich für die Abende unserer Veranstaltungsreihe Munich TechTour anmelden. Jeder Abend wird von einem Partnerunternehmen ausgerichtet, das die Teilnehmenden für seinen Abend auswählt. Wir verarbeiten Ihre Daten, um die TechTour zu organisieren: um Ihre Anmeldung entgegenzunehmen, sie den Partnerunternehmen der von Ihnen gewählten Abende zur Auswahl weiterzugeben, Ihnen deren Entscheidung mitzuteilen und die Abende durchzuführen.',
      'Dafür verarbeiten wir Ihren Vor- und Nachnamen, Ihre E-Mail-Adresse, Ihre Hochschule, Ihren Studiengang und Ihr Fachsemester, die von Ihnen gewählten Abende, Ihren Lebenslauf (PDF) oder stattdessen den Link zu Ihrem LinkedIn-Profil sowie, wenn Sie möchten, eine kurze Motivation. Weitere Angaben sind nicht erforderlich. Außerdem speichern wir den Zeitpunkt der Übermittlung, die Sprache der Seite und über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.',
      '**Rechtsgrundlage und Nachweis.** Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie im Formular mit zwei eigenen Kästchen erteilen: in die Verarbeitung Ihrer Angaben durch uns zur Bearbeitung Ihrer Anmeldung und in die Weitergabe an die Partnerunternehmen (nächster Absatz). Beide sind für die Anmeldung erforderlich, weil die Partnerunternehmen die Teilnehmenden auswählen; ohne sie können wir Ihre Anmeldung nicht berücksichtigen. Als Nachweis Ihrer Einwilligung (Art. 7 Abs. 1 DSGVO) speichern wir zu jedem Kästchen, das Sie setzen, den Wortlaut, eine Kennung der Fassung dieses Wortlauts und den Zeitpunkt sowie die von Ihnen gewählten Abende.',
      '**Empfänger.** Ihre Angaben und Ihren Lebenslauf (bzw. LinkedIn-Link) geben wir ausschließlich an die Partnerunternehmen der Abende weiter, die Sie ausgewählt haben – 2026 Project A (9. November), Lio (10. November), QuantCo (11. November) und QuantumBlack (McKinsey & Company, 12. November). Die Unternehmen sehen Ihre Anmeldung über einen privaten Link, den nur ihre benannten Ansprechpersonen nach Bestätigung ihrer E-Mail-Adresse öffnen können, der spätestens mit Ende der Veranstaltungswoche abläuft und den wir jederzeit sperren können; jeder Zugriff wird protokolliert. Ihre E-Mail-Adresse sieht ein Unternehmen erst, wenn es Sie für seinen Abend ausgewählt hat; es darf Sie dann kontaktieren, damit Sie sich für den Abend registrieren (z. B. für den Zutritt zu seinen Räumen). Ihre anderen Abende, unsere interne Bewertung und eine etwaige Mitgliedsbewerbung sieht kein Unternehmen. Die Partnerunternehmen entscheiden über Ihre Teilnahme und verarbeiten die übermittelten Daten in eigener Verantwortung (Art. 4 Nr. 7 DSGVO); wir bitten sie, Ihre Daten nur für Auswahl, Kontakt und Durchführung des Abends zu nutzen und heruntergeladene Kopien nach der Veranstaltung zu löschen. Ihre Entscheidung speichern wir bei Ihrer Anmeldung, um Sie darüber zu informieren.',
      'Ihre Angaben und Ihr Lebenslauf liegen auf unseren Servern in Deutschland (Ziffer 3) und sind zu keinem Zeitpunkt öffentlich abrufbar: Innerhalb des Vereins haben nur eingeloggte Mitglieder des TechTour-Organisationsteams Zugriff, außerhalb nur die Partnerunternehmen wie oben beschrieben. Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht. Benachrichtigungen über neue Anmeldungen an unser Team und E-Mails an Sie versenden wir über den in Ziffer 3 beschriebenen E-Mail-Dienst; Ihr Lebenslauf ist darin nicht enthalten. Im Auswahlverfahren können wir zu Ihrer Anmeldung intern eine Bewertung und Notizen festhalten; sie dienen nur der Organisation der Abende, werden nicht an die Partnerunternehmen weitergegeben und mit der Anmeldung gelöscht.',
      '**Infos zu künftigen Events (freiwillig).** Wenn Sie zusätzlich das freiwillige Kästchen für Informationen zu künftigen Events setzen, schreiben wir Ihnen per E-Mail über künftige Veranstaltungen von Coding for Change (Art. 6 Abs. 1 lit. a DSGVO). Dieses Kästchen ist keine Voraussetzung für die Anmeldung, und Sie können die Einwilligung jederzeit per E-Mail an info@codingforchange.com widerrufen, ohne dass das Ihre Anmeldung berührt. Die Angabe wird mit Ihrer Anmeldung gespeichert und mit ihr gelöscht.',
      '**Spamschutz.** Das Formular enthält ein für Menschen unsichtbares Feld, das automatisierte Anfragen erkennt (sog. Honeypot). Dafür erheben wir keine zusätzlichen Daten über Sie und binden keine Dienste Dritter ein – insbesondere kein reCAPTCHA. Eine Google-Ads-Conversion für das Absenden dieses Formulars melden wir nur, wenn Sie im Cookie-Banner der Werbemessung zugestimmt haben (Ziffer 9).',
      '**Speicherdauer.** Wir löschen Ihre Anmeldung einschließlich Lebenslauf, der Entscheidungen der Partnerunternehmen und des Nachweises Ihrer Einwilligung automatisch am 31. Januar 2027 (spätestens drei Monate nach der Veranstaltungswoche). Die privaten Links der Partnerunternehmen und deren Zugriffsprotokolle löschen wir zum selben Zeitpunkt.',
      '**Widerruf.** Sie können Ihre Einwilligungen jederzeit mit Wirkung für die Zukunft widerrufen, am einfachsten per E-Mail an info@codingforchange.com. Widerrufen Sie die Einwilligung in die Verarbeitung oder in die Weitergabe, löschen wir Ihre Anmeldung samt Lebenslauf; die Partnerunternehmen sehen sie dann nicht mehr, und wir bitten diejenigen, die sie bereits gesehen haben, etwaige Kopien zu löschen. An der TechTour können Sie dann nicht mehr teilnehmen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt (Art. 7 Abs. 3 DSGVO).',
      '**Ihre Rechte.** Ihnen stehen das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20), soweit wir uns auf berechtigte Interessen stützen (Ziffer 7) das Widerspruchsrecht (Art. 21) sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO) zu; Einzelheiten in den Ziffern 15 und 16. Eine formlose E-Mail an info@codingforchange.com genügt.',
      '**Ansprechpersonen der Partnerunternehmen.** Wenn Sie einen solchen Link als Ansprechperson eines Partnerunternehmens öffnen, verarbeiten wir die E-Mail-Adresse, mit der Sie sich anmelden, sowie ein Protokoll, wann der Link genutzt und welcher Lebenslauf geöffnet oder was entschieden wurde, um die Anmeldungen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Die Anmeldung setzt ein dafür unbedingt erforderliches Cookie (Ziffer 8). Beides wird zusammen mit dem Link gelöscht.',
    ],
    storageAnchor: /^- cfc-locale\b/,
    storageBullet:
      '- cfc-techtour-intro – merkt sich, dass Sie die Eröffnungsanimation der TechTour-Seite bereits gesehen haben, damit sie nicht erneut abgespielt wird (Browser-Speicher, kein Cookie). Unbedingt erforderlich, bis Sie Ihre Website-Daten löschen.',
    shareAnchor: /^- cfc-techtour-intro\b/,
    shareBullet:
      '- cfc-share – hält die Ansprechperson eines Partnerunternehmens der TechTour im privaten Anmeldungslink angemeldet, nachdem sie ihre E-Mail-Adresse mit einem Code bestätigt hat (Cookie, nur auf diesem Link und nur für sie). Unbedingt erforderlich, für höchstens 12 Stunden.',
    draftBullets: [
      '- cfc-techtour-draft – behält die Antworten, die Sie in die TechTour-Anmeldung eingegeben haben, wenn Sie auf „Speichern und später weitermachen“ klicken, nur in diesem Browser (Browser-Speicher, kein Cookie; keine Kästchen, kein Lebenslauf). Unbedingt erforderlich, bis Sie das Formular absenden oder die gespeicherten Antworten löschen, höchstens 30 Tage.',
      '- cfc-application-draft – behält die Antworten, die Sie in die Mitgliedsbewerbung eingeben, schon während des Tippens, nur in diesem Browser (Browser-Speicher, kein Cookie; keine Kästchen, kein Lebenslauf). Unbedingt erforderlich, bis Sie das Formular absenden oder die gespeicherten Antworten löschen, höchstens 30 Tage.',
    ],
    hostingMatch: (h) => /^3\./.test(h) && /hosting/i.test(h),
    emailProvider: ({ transfer }) =>
      '**E-Mail-Versand.** Benachrichtigungen an unser Team (neue Kontaktanfragen, Bewerbungen, Anmeldungen) sowie E-Mails an Sie (z. B. die Wartelisten-Benachrichtigung) versenden wir über den E-Mail-Dienst Resend (Resend, Inc., San Francisco, USA), der Absender- und Empfängeradresse sowie den Inhalt der E-Mail in unserem Auftrag auf Grundlage eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO) verarbeitet. ' +
      (transfer === 'dpf'
        ? 'Die Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy Framework, unter dem Resend zertifiziert ist. '
        : 'Die Übermittlung in die USA erfolgt auf Grundlage der EU-Standardvertragsklauseln. ') +
      'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (zuverlässige Zustellung der von Ihnen oder uns veranlassten E-Mails).',
    adsMatch: (h) => /^9\./.test(h) && /google ads/i.test(h),
    adsOld: 'eine von vier Aktionen',
    adsNew:
      '**Was passiert:** Mit Ihrer Einwilligung erfasst das Google-Tag, wenn Sie eine von fünf Aktionen abschließen – Eintrag in die Warteliste, Absenden einer Mitgliedsbewerbung, Anmeldung zur Munich TechTour, Senden einer Kontaktanfrage oder Buchen eines Termins – und verknüpft dies mit der von Ihnen angeklickten Anzeige. Google setzt hierfür _gcl_*-Cookies und verarbeitet die im Anzeigenlink enthaltene Klick-Kennung.',
    datedMatch: (h) => /^\d+\./.test(h) && /aktualität/i.test(h),
    dated: /\bStand [A-ZÄÖÜ][a-zäöü]+ \d{4}\b/,
    datedNow: 'Stand Oktober 2026',
  },
};

// ---- The edit -----------------------------------------------------------------

/** A storage-list bullet, inserted after the first bullet `anchors` finds; reported either way. */
function addBullet(children, bullet, anchors, changes, skipped) {
  const name = /^- (\S+)/.exec(bullet)?.[1] ?? bullet;
  if (children.some((n) => plain(n).trim().startsWith(`- ${name} `))) {
    skipped.push(`storage list already lists ${name}`);
    return;
  }
  for (const anchor of anchors) {
    const at = children.findIndex((n) => n.type === 'paragraph' && anchor.test(plain(n).trim()));
    if (at === -1) continue;
    children.splice(at + 1, 0, paragraph(inline(bullet)));
    changes.push(`storage list: bullet for ${name} added`);
    return;
  }
  skipped.push(`storage list anchor not found – ${name} not added`);
}

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
  const sectionPlain = (s) => children.slice(s.start, s.end).map(plain).join('\n');

  // 1. Section 5 – the membership application only
  const s5 = findSection(children, t.section5Match);
  if (!s5) {
    skipped.push('section 5 (application form) not found – left unchanged, and section 5a not added');
  } else {
    if (t.section5Current(sectionPlain(s5))) {
      skipped.push('section 5 is already the current version – left unchanged');
    } else {
      children.splice(s5.start, s5.end - s5.start, ...sectionNodes(t.section5Title, t.section5));
      changes.push(`section 5 replaced → "${t.section5Title}"`);
    }

    // 2. Section 5a – the Munich TechTour, right after section 5
    const s5a = findSection(children, t.section5aMatch);
    if (s5a && t.section5aCurrent(sectionPlain(s5a))) {
      skipped.push('section 5a is already the current version – left unchanged');
    } else if (s5a) {
      children.splice(s5a.start, s5a.end - s5a.start, ...sectionNodes(t.section5aTitle, t.section5a));
      changes.push(`section 5a replaced → "${t.section5aTitle}"`);
    } else {
      const after = findSection(children, t.section5Match);
      children.splice(after.end, 0, ...sectionNodes(t.section5aTitle, t.section5a));
      changes.push(`section 5a added after section 5 → "${t.section5aTitle}"`);
    }
  }

  // 3. Storage list bullets (section 8)
  addBullet(children, t.storageBullet, [t.storageAnchor], changes, skipped);
  addBullet(children, t.shareBullet, [t.shareAnchor], changes, skipped);
  const [techtourDraft, applicationDraft] = t.draftBullets;
  addBullet(children, techtourDraft, [/^- cfc-share\b/, t.shareAnchor], changes, skipped);
  addBullet(children, applicationDraft, [/^- cfc-techtour-draft\b/], changes, skipped);

  // 4. Email provider (section 3)
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

  // 5. Google Ads (section 9): the TechTour registration is one of the actions
  const s9 = findSection(children, t.adsMatch);
  const listAt = s9
    ? children.slice(s9.start, s9.end).findIndex((n) => n.type === 'paragraph' && plain(n).includes(t.adsOld))
    : -1;
  if (!s9) {
    skipped.push('section 9 (Google Ads) not found – its list of actions left unchanged');
  } else if (listAt === -1) {
    skipped.push('section 9 no longer says "four actions" – its list of actions left unchanged');
  } else {
    children[s9.start + listAt] = paragraph(inline(t.adsNew));
    changes.push('section 9: the TechTour registration added to the actions the Google tag records');
  }

  // 6. "This privacy policy is dated …" in the closing section
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
