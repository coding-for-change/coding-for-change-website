/**
 * The two application forms, as form-builder documents — shared by the dev
 * seed (`scripts/seed.mjs`) and the production upsert (`scripts/upsert-forms.mjs`)
 * so both environments start from the same questions. After that, questions
 * are edited in the admin; this file is the starting point, not the truth.
 *
 * Field names are shared deliberately: when one form is embedded in the other
 * (the "also apply / also register" checkbox), fields with the same `name` are
 * asked once and copied into both submissions. So `firstName`, `lastName`,
 * `email` and `privacy` match across the two forms, while the two commitment
 * boxes have distinct names because they mean different things.
 */

const paragraph = (text) => ({
  type: 'paragraph',
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' }],
});
const doc = (...children) => ({
  root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children },
});

/** Labels per locale, keyed by field name (and option value for groups). */
const L = {
  en: {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    why: 'Why do you want to join Coding for Change?',
    cv: 'Your CV',
    cvHint: 'PDF, max. 5 MB',
    university: 'University',
    course: 'Course of study',
    techtourCv: 'Your CV (optional)',
    techtourCvHint:
        'Only if you want the companies to see it. PDF, max. 5 MB — the TechTour is open to you either way.',
    hoursCommit: 'I can commit about 5 hours per week for the project phase.',
    privacy:
      'I agree that Coding for Change e.V. processes the data in this form to handle my application, as described in the [privacy policy](/privacy).',
    alsoTechtour: 'I also want to register for the Munich TechTour.',
    alsoTechtourLink: 'What is the TechTour?',
    events: 'Which evenings will you join?',
    eventsHint: 'Pick every evening you want to attend.',
    'mon-tba': 'Mon 9 Nov · Company to be announced',
    'tue-lio': 'Tue 10 Nov · Lio',
    'wed-quantumblack': 'Wed 11 Nov · McKinsey QuantumBlack',
    'thu-quantco': 'Thu 12 Nov · QuantCo',
    'fri-tba': 'Fri 13 Nov · To be announced',
    attendCommit: 'I commit to attending the evenings I selected. Spots are limited and the companies plan for us.',
    alsoApply: 'I also want to apply to become a Coding for Change member.',
    alsoApplyLink: 'About membership',
    applicationSubmit: 'Send application',
    applicationConfirm:
      'Thanks! Your application is in. Within two days of the deadline you will hear from us with an invitation to pick an interview slot.',
    techtourSubmit: 'Register',
    techtourConfirm:
      'You are registered! We will email you the details for each evening as soon as times and locations are confirmed.',
  },
  de: {
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail',
    why: 'Warum möchtest du bei Coding for Change mitmachen?',
    cv: 'Dein Lebenslauf',
    cvHint: 'PDF, max. 5 MB',
    university: 'Hochschule',
    course: 'Studiengang',
    techtourCv: 'Dein Lebenslauf (optional)',
    techtourCvHint:
        'Nur wenn du willst, dass die Unternehmen ihn sehen. PDF, max. 5 MB — zur TechTour kannst du auch ohne kommen.',
    hoursCommit: 'Ich kann in der Projektphase etwa 5 Stunden pro Woche einbringen.',
    privacy:
      'Ich bin einverstanden, dass Coding for Change e.V. die Angaben in diesem Formular zur Bearbeitung meiner Bewerbung verarbeitet, wie in der [Datenschutzerklärung](/privacy) beschrieben.',
    alsoTechtour: 'Ich möchte mich auch für die Munich TechTour anmelden.',
    alsoTechtourLink: 'Was ist die TechTour?',
    events: 'An welchen Abenden bist du dabei?',
    eventsHint: 'Wähl jeden Abend, an dem du teilnehmen willst.',
    'mon-tba': 'Mo 9. Nov · Unternehmen wird noch bekannt gegeben',
    'tue-lio': 'Di 10. Nov · Lio',
    'wed-quantumblack': 'Mi 11. Nov · McKinsey QuantumBlack',
    'thu-quantco': 'Do 12. Nov · QuantCo',
    'fri-tba': 'Fr 13. Nov · Wird noch bekannt gegeben',
    attendCommit: 'Ich verpflichte mich, an den ausgewählten Abenden dabei zu sein. Die Plätze sind begrenzt und die Unternehmen planen mit uns.',
    alsoApply: 'Ich möchte mich auch als Mitglied bei Coding for Change bewerben.',
    alsoApplyLink: 'Mehr zur Mitgliedschaft',
    applicationSubmit: 'Bewerbung absenden',
    applicationConfirm:
      'Danke! Deine Bewerbung ist eingegangen. Innerhalb von zwei Tagen nach der Frist hörst du von uns und wählst einen Interviewtermin.',
    techtourSubmit: 'Anmelden',
    techtourConfirm:
      'Du bist angemeldet! Sobald Uhrzeiten und Orte feststehen, schicken wir dir die Details zu jedem Abend per E-Mail.',
  },
};

export const EVENT_OPTIONS = ['mon-tba', 'tue-lio', 'wed-quantumblack', 'thu-quantco', 'fri-tba'];

/**
 * The membership application. `techtourFormId` is the id of the techtour form
 * for the "also register" box; pass null on the first pass and patch it in
 * once both forms exist.
 */
export const applicationForm = (locale, { techtourFormId, toEmail, fromEmail } = {}) => {
  const t = L[locale];
  const fields = [
    { blockType: 'text', name: 'firstName', label: t.firstName, required: true, width: 50 },
    { blockType: 'text', name: 'lastName', label: t.lastName, required: true, width: 50 },
    { blockType: 'email', name: 'email', label: t.email, required: true, width: 100 },
    { blockType: 'textarea', name: 'why', label: t.why, required: true, width: 100 },
    { blockType: 'upload', name: 'cv', label: t.cv, required: true, width: 100, description: t.cvHint },
    { blockType: 'checkbox', name: 'hoursCommit', label: t.hoursCommit, required: true, width: 100 },
    { blockType: 'checkbox', name: 'privacy', label: t.privacy, required: true, width: 100 },
  ];
  if (techtourFormId) {
    fields.push({
      blockType: 'subform',
      name: 'alsoTechtour',
      label: t.alsoTechtour,
      form: techtourFormId,
      linkLabel: t.alsoTechtourLink,
      linkUrl: '/techtour',
    });
  }
  return {
    title: 'application',
    submitButtonLabel: t.applicationSubmit,
    confirmationType: 'message',
    confirmationMessage: doc(paragraph(t.applicationConfirm)),
    fields,
    ...(locale === 'en' && toEmail
      ? {
          emails: [
            {
              emailTo: toEmail,
              emailFrom: fromEmail,
              replyTo: '{{email}}',
              subject: 'New membership application from {{firstName}} {{lastName}}',
              message: doc(paragraph('A new membership application came in:'), paragraph('{{*:table}}')),
            },
          ],
        }
      : {}),
  };
};

/** The TechTour registration. `applicationFormId` for the "also apply" box. */
export const techtourForm = (locale, { applicationFormId, toEmail, fromEmail } = {}) => {
  const t = L[locale];
  const fields = [
    { blockType: 'text', name: 'firstName', label: t.firstName, required: true, width: 50 },
    { blockType: 'text', name: 'lastName', label: t.lastName, required: true, width: 50 },
    { blockType: 'email', name: 'email', label: t.email, required: true, width: 100 },
    { blockType: 'text', name: 'university', label: t.university, required: true, width: 50 },
    { blockType: 'text', name: 'course', label: t.course, required: true, width: 50 },
    {
      blockType: 'checkboxGroup',
      name: 'events',
      label: t.events,
      required: true,
      width: 100,
      description: t.eventsHint,
      options: EVENT_OPTIONS.map((value) => ({ value, label: t[value] })),
    },
    // Optional, deliberately: the tour is free and open to every student, so a
    // required CV would contradict the promise on the page. It exists because
    // the host companies ask who is coming.
    {
      blockType: 'upload',
      name: 'cv',
      label: t.techtourCv,
      required: false,
      width: 100,
      description: t.techtourCvHint,
    },
    { blockType: 'checkbox', name: 'attendCommit', label: t.attendCommit, required: true, width: 100 },
    { blockType: 'checkbox', name: 'privacy', label: t.privacy, required: true, width: 100 },
  ];
  if (applicationFormId) {
    fields.push({
      blockType: 'subform',
      name: 'alsoApply',
      label: t.alsoApply,
      form: applicationFormId,
      linkLabel: t.alsoApplyLink,
      linkUrl: '/join',
    });
  }
  return {
    title: 'techtour',
    submitButtonLabel: t.techtourSubmit,
    confirmationType: 'message',
    confirmationMessage: doc(paragraph(t.techtourConfirm)),
    fields,
    ...(locale === 'en' && toEmail
      ? {
          emails: [
            {
              emailTo: toEmail,
              emailFrom: fromEmail,
              replyTo: '{{email}}',
              subject: 'New TechTour registration from {{firstName}} {{lastName}}',
              message: doc(paragraph('A new TechTour registration came in:'), paragraph('{{*:table}}')),
            },
          ],
        }
      : {}),
  };
};

/**
 * Starting content for the TechTour page global. Times and locations are left
 * empty on purpose (the page then says "to be announced"); fill them in the
 * admin as the companies confirm.
 */
export const techTourGlobal = (locale) => {
  const en = locale === 'en';
  const ev = (company, date, status, title, description, website) => ({
    company,
    date,
    status,
    title,
    description,
    website,
  });
  return {
    kicker: en ? 'Munich TechTour · 9–13 November 2026' : 'Munich TechTour · 9.–13. November 2026',
    title: en
      ? 'One week. Munich’s most exciting tech companies. You’re invited.'
      : 'Eine Woche. Münchens spannendste Tech-Unternehmen. Du bist eingeladen.',
    intro: en
      ? 'Every evening of the week we visit one company that is shaping tech in Munich — from a fast-growing startup to a global AI practice. Meet the engineers and founders, see how they work, ask what you always wanted to ask. Free and open to every student.'
      : 'Jeden Abend der Woche besuchen wir ein Unternehmen, das Tech in München prägt – vom schnell wachsenden Startup bis zur globalen KI-Beratung. Triff die Engineers und Gründer:innen, sieh, wie sie arbeiten, und frag, was du schon immer fragen wolltest. Kostenlos und offen für alle Studierenden.',
    registrationOpen: true,
    registrationDeadline: '2026-11-06T23:59:00.000+01:00',
    events: [
      // `company` is not localised; the page shows its own "to be announced" for tba slots.
      ev('TBA', '2026-11-09T12:00:00.000Z', 'tba', '', '', ''),
      ev('Lio', '2026-11-10T12:00:00.000Z', 'confirmed', en ? 'Startup evening at Lio' : 'Startup-Abend bei Lio',
        en ? 'One of Munich’s best-known startups opens its doors: how a small team ships fast, what they look for in new hires, and where students can plug in.'
           : 'Eines der bekanntesten Startups Münchens öffnet seine Türen: wie ein kleines Team schnell liefert, worauf es bei neuen Kolleg:innen achtet und wo Studierende einsteigen können.',
        ''),
      ev('McKinsey QuantumBlack', '2026-11-11T12:00:00.000Z', 'confirmed', en ? 'AI at scale with QuantumBlack' : 'KI im großen Maßstab bei QuantumBlack',
        en ? 'McKinsey’s AI arm on how data science and engineering land in real organisations — and what a career there looks like.'
           : 'McKinseys KI-Einheit darüber, wie Data Science und Engineering in echten Organisationen ankommen – und wie eine Karriere dort aussieht.',
        'https://www.mckinsey.com/capabilities/quantumblack'),
      ev('QuantCo', '2026-11-12T12:00:00.000Z', 'confirmed', en ? 'Data science that decides at QuantCo' : 'Data Science, die entscheidet – bei QuantCo',
        en ? 'How QuantCo turns economics, statistics and engineering into decisions for insurers and health systems, told by the people building it.'
           : 'Wie QuantCo aus Ökonomie, Statistik und Engineering Entscheidungen für Versicherer und Gesundheitssysteme macht – erzählt von den Leuten, die es bauen.',
        'https://quantco.com'),
      ev('TBA', '2026-11-13T12:00:00.000Z', 'tba', '', '', ''),
    ],
    highlights: [
      {
        title: en ? 'Inside, not on stage' : 'Drinnen statt auf der Bühne',
        text: en
          ? 'Small groups in the companies’ own offices, with the engineers who do the work — not a career-fair booth.'
          : 'Kleine Gruppen in den Büros der Unternehmen, mit den Engineers, die die Arbeit machen – kein Messestand.',
      },
      {
        title: en ? 'Pick your evenings' : 'Wähl deine Abende',
        text: en
          ? 'Come to one visit or all of them. Registration is per evening.'
          : 'Komm zu einem Besuch oder zu allen. Die Anmeldung gilt pro Abend.',
      },
      {
        title: en ? 'Free, for every student' : 'Kostenlos, für alle Studierenden',
        text: en
          ? 'No membership needed, no fee. Just show up when you said you would.'
          : 'Keine Mitgliedschaft nötig, keine Gebühr. Komm einfach, wenn du dich angemeldet hast.',
      },
    ],
    commitment: en
      ? 'Spots per evening are limited and the companies prepare for the number of people we announce. Please only tick the evenings you will actually attend — and tell us early if plans change.'
      : 'Die Plätze pro Abend sind begrenzt, und die Unternehmen bereiten sich auf die Zahl vor, die wir ansagen. Bitte wähl nur die Abende, an denen du wirklich kommst – und sag früh Bescheid, wenn sich etwas ändert.',
    formHeading: en ? 'Register for the TechTour' : 'Für die TechTour anmelden',
    closedMessage: en
      ? 'Registration for this TechTour has closed. Follow us on LinkedIn to hear about the next one.'
      : 'Die Anmeldung für diese TechTour ist geschlossen. Folg uns auf LinkedIn, um von der nächsten zu erfahren.',
  };
};
