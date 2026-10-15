# TechTour-Anmeldung: Datenschutz-Schritte im Admin

Was nach dem Merge noch im Admin (codingforchange.com/admin) passieren muss,
damit die Anmeldung unter /techtour/apply rechtlich abgesichert ist. Am
Formular selbst ändert sich dabei nur eins: Es kommt ein Pflicht-Kästchen für
die Weitergabe an die Partnerunternehmen dazu. Alle anderen Fragen bleiben,
wie sie sind – der CV bleibt Pflicht. Zeitbedarf: etwa 20 Minuten.

**Wann:** nach Merge und Deploy von #79, #80, #81 und dem PR zu dieser Datei,
in dieser Reihenfolge. Die Migrationen laufen beim Start des CMS automatisch.
**Alles hier, bevor die TechTour-Seite auf „Public“ geht.**

**Das erledigt der Code schon, ohne Admin-Arbeit:**

- Die Partner-Links zeigen nur Anmeldungen, in denen das Weitergabe-Kästchen (`hostSharing`) angehakt ist.
- Einwilligungsprotokoll: Zu jedem angehakten Kästchen werden Wortlaut, Version (ein Fingerabdruck des Wortlauts) und Zeitpunkt gespeichert, dazu die gewählten Abende. Nachträglich lässt sich das nicht ändern. Im Excel-Export steht es in der Spalte „Agreed to (wording version)“.
- Spamschutz per Honeypot (ein unsichtbares Feld), kein reCAPTCHA, nichts von Dritten.
- Kein Kästchen ist vorab angehakt, egal welcher Standardwert im Admin steht.
- Eine gelöschte Anmeldung nimmt ihren CV sofort mit, ein gelöschter Partner-Link sein Zugriffsprotokoll.
- Automatische Löschung am Stichtag (Schritt 3).
- Eine Google-Ads-Conversion für die TechTour-Anmeldung gibt es nur mit Marketing-Einwilligung.
- `/privacy#munich-techtour` springt direkt zum TechTour-Abschnitt.

---

## Schritt 1: Datenschutzerklärung

**Weg A, empfohlen (2 Minuten):** Ein Skript macht alle Änderungen dieses
Schritts in beiden Sprachen und prüft sie danach. Es ändert Ziffer 5, fügt 5a
ein, ergänzt drei Einträge in Ziffer 8, einen Absatz in Ziffer 9 und das Datum
in Ziffer 17 – sonst nichts. Ein zweiter Lauf findet nichts mehr zu tun.

```bash
cd inner/cms
export CMS_URL=https://codingforchange.com CMS_EMAIL='…' CMS_PASSWORD='…'
node scripts/upsert-content.mjs           # Probelauf: zeigt jede Änderung, schreibt nichts
node scripts/upsert-content.mjs --apply   # schreibt DE und EN, liest zurück und prüft
```

**Weg B, von Hand:** Admin → Globals → „Legal (Imprint & Privacy)“ → Feld
„Datenschutzerklärung (Privacy Policy)“. Zuerst mit der Sprache **Deutsch**,
dann oben rechts auf **English** wechseln und dasselbe mit den englischen
Texten. Fett gesetzte Absatzanfänge im Editor fett machen (⌘B).

### 1a. Ziffer 5 ersetzen

Die heutige Ziffer 5 behandelt Mitgliedsbewerbung und TechTour gemeinsam und
sagt: „Ihren Namen und Ihre Kontaktdaten geben wir nicht an die gastgebenden
Unternehmen weiter.“ Sie wird auf die Mitgliedsbewerbung beschränkt; die
TechTour bekommt Ziffer 5a.

Die Überschrift „5. Bewerbungs- und Anmeldeformulare (Mitgliedschaft, Munich
TechTour)“ und alle Absätze bis vor „6. Warteliste …“ ersetzen durch:

> **5. Bewerbungsformular (Mitgliedschaft)**
>
> Über das Bewerbungsformular auf unserer Seite „Mitmachen“ können Sie sich für eine Mitwirkung bei Coding for Change e.V. bewerben. Es lässt sich mit der Anmeldung zur Munich TechTour kombinieren: Wenn Sie in einem der Formulare das Kästchen für das jeweils andere setzen, erscheinen dessen zusätzliche Fragen, und wir legen zwei getrennte Datensätze an – eine Bewerbung (diese Ziffer) und eine Anmeldung (Ziffer 5a).
>
> Bei einer Bewerbung verarbeiten wir Vor- und Nachname, E-Mail-Adresse, wo Sie studieren, Ihre Antworten auf unsere Fragen (z. B. zu Ihrer Motivation, Ihren Erfahrungen und dem Bereich, in dem Sie mitwirken möchten), Ihren Lebenslauf (PDF) sowie Ihre Bestätigungen (z. B. des zu erwartenden Zeitaufwands). Außerdem speichern wir den Zeitpunkt der Übermittlung, die Sprache der Seite, den Wortlaut jedes Kästchens, das Sie gesetzt haben, mit einer Kennung der Fassung dieses Wortlauts (als Nachweis dessen, was Sie bestätigt haben), und über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.
>
> Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen zur Begründung eines Mitwirkungsverhältnisses). Soweit Sie im Formular das Einwilligungskästchen setzen, ist zusätzlich Art. 6 Abs. 1 lit. a DSGVO Rechtsgrundlage; diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft per E-Mail an info@codingforchange.com widerrufen.
>
> Ihr Lebenslauf wird beim Auswählen der Datei auf unseren Server hochgeladen und ist zu keinem Zeitpunkt öffentlich abrufbar: Innerhalb des Vereins können ihn nur eingeloggte Mitglieder unseres Auswahlteams öffnen. Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht.
>
> Im Auswahlverfahren halten wir zu jeder Bewerbung intern eine Bewertung (z. B. eine Punktzahl von 1 bis 10 oder „angenommen“, „unsicher“, „abgelehnt“) sowie Notizen fest. Diese dienen ausschließlich der Entscheidung über Ihre Bewerbung, werden zusammen mit den übrigen Daten gelöscht und sind von Ihrem Auskunftsrecht (Art. 15 DSGVO) umfasst.
>
> Die Daten werden auf unseren Servern in Deutschland (Ziffer 3) gespeichert und innerhalb des Vereins nur den mit der Auswahl betrauten Mitgliedern zugänglich gemacht. Über jede neue Bewerbung wird unser Team per E-Mail benachrichtigt; diese E-Mail enthält Ihre Angaben (nicht den Lebenslauf) und wird über den in Ziffer 3 beschriebenen E-Mail-Dienst versendet.
>
> Im Falle einer Zusage werden Ihre Daten für die Dauer Ihrer Mitwirkung im Verein gespeichert. Im Falle einer Absage löschen wir die Bewerbung einschließlich Lebenslauf spätestens sechs Monate nach Ende der Bewerbungsrunde, sofern Sie nicht in eine längere Speicherung für künftige Gelegenheiten eingewilligt haben.

English – replaces "5. Application and registration forms (membership, Munich TechTour)" and its paragraphs:

> **5. Application form (membership)**
>
> Via the application form on our page "Join" you can apply to contribute to Coding for Change e.V. It can be combined with the registration for the Munich TechTour: if you tick the box for the other form inside one of them, its additional questions appear and we create two separate records – an application (this section) and a registration (section 5a).
>
> For an application we process your first and last name, email address, where you study, your answers to our questions (for example about your motivation, your experience and where you would like to contribute), your CV (PDF) and your confirmations (for example of the expected time commitment). We also store the time of submission, the language of the page, the wording of every box you ticked together with an identifier of that version of the wording (as proof of what you confirmed), and the channel through which you reached the page (for example a poster QR code), see section 7.
>
> Processing is based on Art. 6(1)(b) GDPR (pre-contractual measures towards a participation relationship). Insofar as you tick the consent box in the form, Art. 6(1)(a) GDPR is the additional legal basis; you can withdraw that consent at any time with effect for the future by emailing info@codingforchange.com.
>
> Your CV is uploaded to our server when you select the file and is never publicly accessible: within the association only logged-in members of our selection team can open it. A file you upload without then submitting the form is deleted automatically within 24 hours.
>
> During the selection process we keep an internal assessment for every application (for example a score from 1 to 10, or "accepted", "unsure", "declined") together with notes. These serve solely to decide on your application, are deleted together with the other data, and are covered by your right of access (Art. 15 GDPR).
>
> The data is stored on our servers in Germany (section 3) and within the association is accessible only to the members entrusted with the selection. Our team is notified of every new application by email; that email contains your answers (not your CV) and is sent through the email service described in section 3.
>
> If your application is successful, your data is stored for the duration of your involvement in the association. If it is unsuccessful, we delete the application including the CV at the latest six months after the application round has closed, unless you have consented to longer storage for future opportunities.

### 1b. Neuer Abschnitt 5a direkt danach (vor Ziffer 6)

Die Überschrift im Editor als „Heading 2“ formatieren, wie die anderen Ziffern.

> **5a. Munich TechTour**
>
> Über das Anmeldeformular auf unserer Seite „TechTour“ können Sie sich für die Abende unserer Veranstaltungsreihe Munich TechTour anmelden. Jeder Abend wird von einem Partnerunternehmen ausgerichtet, das die Teilnehmenden für seinen Abend auswählt. Wir verarbeiten Ihre Daten, um die TechTour zu organisieren: um Ihre Anmeldung entgegenzunehmen, sie den Partnerunternehmen der von Ihnen gewählten Abende zur Auswahl weiterzugeben, Ihnen deren Entscheidung mitzuteilen und die Abende durchzuführen.
>
> Dafür verarbeiten wir Ihren Vor- und Nachnamen, Ihre E-Mail-Adresse, die von Ihnen gewählten Abende, Ihren Lebenslauf (PDF) und Ihre Teilnahmezusage. Weitere Angaben sind nicht erforderlich. Außerdem speichern wir den Zeitpunkt der Übermittlung, die Sprache der Seite und über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.
>
> **Rechtsgrundlage und Nachweis.** Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie im Formular mit zwei eigenen Kästchen erteilen: in die Verarbeitung Ihrer Angaben durch uns zur Bearbeitung Ihrer Anmeldung und in die Weitergabe an die Partnerunternehmen (nächster Absatz). Beide sind für die Anmeldung erforderlich, weil die Partnerunternehmen die Teilnehmenden auswählen; ohne sie können wir Ihre Anmeldung nicht berücksichtigen. Als Nachweis Ihrer Einwilligung (Art. 7 Abs. 1 DSGVO) speichern wir zu jedem Kästchen, das Sie setzen, den Wortlaut, eine Kennung der Fassung dieses Wortlauts und den Zeitpunkt sowie die von Ihnen gewählten Abende.
>
> **Empfänger.** Ihre Angaben und Ihren Lebenslauf geben wir ausschließlich an die Partnerunternehmen der Abende weiter, die Sie ausgewählt haben – 2026 Project A (9. November), Lio (10. November), QuantCo (11. November) und QuantumBlack (McKinsey & Company, 12. November). Die Unternehmen sehen Ihre Anmeldung – Ihren Namen, Ihren Lebenslauf und Ihre weiteren Angaben, nicht aber Ihre E-Mail-Adresse – über einen privaten Link, den nur ihre benannten Ansprechpersonen nach Bestätigung ihrer E-Mail-Adresse öffnen können, der spätestens mit Ende der Veranstaltungswoche abläuft und den wir jederzeit sperren können; jeder Zugriff wird protokolliert. Wählt ein Unternehmen Sie für seinen Abend aus, darf es Sie zur Registrierung für den Abend kontaktieren (z. B. für den Zutritt zu seinen Räumen); Ihre E-Mail-Adresse erhält es dafür von uns. Ihre anderen Abende, unsere interne Bewertung und eine etwaige Mitgliedsbewerbung sieht kein Unternehmen. Die Partnerunternehmen entscheiden über Ihre Teilnahme und verarbeiten die übermittelten Daten in eigener Verantwortung (Art. 4 Nr. 7 DSGVO); wir bitten sie, Ihre Daten nur für Auswahl, Kontakt und Durchführung des Abends zu nutzen und heruntergeladene Kopien nach der Veranstaltung zu löschen. Ihre Entscheidung speichern wir bei Ihrer Anmeldung, um Sie darüber zu informieren.
>
> Ihre Angaben und Ihr Lebenslauf liegen auf unseren Servern in Deutschland (Ziffer 3) und sind zu keinem Zeitpunkt öffentlich abrufbar: Innerhalb des Vereins haben nur eingeloggte Mitglieder des TechTour-Organisationsteams Zugriff, außerhalb nur die Partnerunternehmen wie oben beschrieben. Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht. Benachrichtigungen über neue Anmeldungen an unser Team und E-Mails an Sie versenden wir über den in Ziffer 3 beschriebenen E-Mail-Dienst; Ihr Lebenslauf ist darin nicht enthalten. Im Auswahlverfahren können wir zu Ihrer Anmeldung intern eine Bewertung und Notizen festhalten; sie dienen nur der Organisation der Abende, werden nicht an die Partnerunternehmen weitergegeben und mit der Anmeldung gelöscht.
>
> **Spamschutz.** Das Formular enthält ein für Menschen unsichtbares Feld, das automatisierte Anfragen erkennt (sog. Honeypot). Dafür erheben wir keine zusätzlichen Daten über Sie und binden keine Dienste Dritter ein – insbesondere kein reCAPTCHA. Eine Google-Ads-Conversion für das Absenden dieses Formulars melden wir nur, wenn Sie im Cookie-Banner der Werbemessung zugestimmt haben (Ziffer 9).
>
> **Speicherdauer.** Wir löschen Ihre Anmeldung einschließlich Lebenslauf, der Entscheidungen der Partnerunternehmen und des Nachweises Ihrer Einwilligung automatisch am 31. Januar 2027 (spätestens drei Monate nach der Veranstaltungswoche). Die privaten Links der Partnerunternehmen und deren Zugriffsprotokolle löschen wir zum selben Zeitpunkt.
>
> **Widerruf.** Sie können Ihre Einwilligungen jederzeit mit Wirkung für die Zukunft widerrufen, am einfachsten per E-Mail an info@codingforchange.com. Widerrufen Sie die Einwilligung in die Verarbeitung oder in die Weitergabe, löschen wir Ihre Anmeldung samt Lebenslauf; die Partnerunternehmen sehen sie dann nicht mehr, und wir bitten diejenigen, die sie bereits gesehen haben, etwaige Kopien zu löschen. An der TechTour können Sie dann nicht mehr teilnehmen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt (Art. 7 Abs. 3 DSGVO).
>
> **Ihre Rechte.** Ihnen stehen das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20), soweit wir uns auf berechtigte Interessen stützen (Ziffer 7) das Widerspruchsrecht (Art. 21) sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO) zu; Einzelheiten in den Ziffern 15 und 16. Eine formlose E-Mail an info@codingforchange.com genügt.
>
> **Ansprechpersonen der Partnerunternehmen.** Wenn Sie einen solchen Link als Ansprechperson eines Partnerunternehmens öffnen, verarbeiten wir die E-Mail-Adresse, mit der Sie sich anmelden, sowie ein Protokoll, wann der Link genutzt und welcher Lebenslauf geöffnet oder was entschieden wurde, um die Anmeldungen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Die Anmeldung setzt ein dafür unbedingt erforderliches Cookie (Ziffer 8). Beides wird zusammen mit dem Link gelöscht.

English:

> **5a. Munich TechTour**
>
> Via the registration form on our page "TechTour" you can register for the evenings of our event series Munich TechTour. Each evening is hosted by a partner company, which selects the participants for its evening. We process your data to organise the TechTour: to receive your registration, to pass it on for selection to the partner companies of the evenings you picked, to let you know their decision, and to hold the evenings.
>
> For this we process your first and last name, your email address, the evenings you picked, your CV (PDF) and your commitment to attend. Nothing else is required. We also store the time of submission, the language of the page and the channel through which you reached the page (for example a poster QR code), see section 7.
>
> **Legal basis and proof.** The legal basis is your consent (Art. 6(1)(a) GDPR), which you give in the form with two separate boxes: to our processing of your details to handle your registration, and to passing them on to the partner companies (next paragraph). Both are needed to register, because the partner companies select the participants; without them we cannot consider your registration. As proof of your consent (Art. 7(1) GDPR) we store, for every box you tick, its wording, an identifier of that version of the wording and the time, together with the evenings you picked.
>
> **Recipients.** We pass your details and your CV on only to the partner companies of the evenings you picked – in 2026 Project A (9 November), Lio (10 November), QuantCo (11 November) and QuantumBlack (McKinsey & Company, 12 November). The companies see your registration – your name, your CV and the other details you entered, but not your email address – through a private link that only their named contacts can open after confirming their email address, that expires at the end of the event week at the latest and that we can block at any time; every access is logged. If a company selects you for its evening, it may contact you to register for the evening (for example for access to its premises); we give it your email address for this. No company sees your other evenings, our internal assessment or any membership application. The partner companies decide on your attendance and process the data they receive under their own responsibility (Art. 4(7) GDPR); we ask them to use your data only to select, contact and host you, and to delete any copies they downloaded after the event. We store their decision with your registration in order to let you know.
>
> Your details and your CV are stored on our servers in Germany (section 3) and are never publicly accessible: within the association only logged-in members of the team organising the TechTour can access them, and outside it only the partner companies as described above. A file you upload without then submitting the form is deleted automatically within 24 hours. Notifications of new registrations to our team and emails to you are sent through the email service described in section 3; they do not contain your CV. During the selection we may keep an internal assessment and notes on your registration; they serve only to organise the evenings, are not passed on to the partner companies and are deleted with the registration.
>
> **Spam protection.** The form contains a field that people do not see and that catches automated submissions (a so-called honeypot). It collects no additional data about you and involves no third-party service – in particular no reCAPTCHA. We report a Google Ads conversion for sending this form only if you have agreed to advertising measurement in the cookie banner (section 9).
>
> **Retention.** We delete your registration, including your CV, the partner companies' decisions and the proof of your consent, automatically on 31 January 2027 (at the latest three months after the event week). The partner companies' private links and their access logs are deleted at the same time.
>
> **Withdrawal.** You can withdraw your consent at any time with effect for the future, most easily by emailing info@codingforchange.com. If you withdraw your consent to our processing or to passing your data on, we delete your registration including your CV; partner companies then no longer see it, and we ask those that have already seen it to delete any copies. You can then no longer take part in the TechTour. Withdrawal does not affect the lawfulness of processing before it (Art. 7(3) GDPR).
>
> **Your rights.** You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20), insofar as we rely on legitimate interests (section 7) the right to object (Art. 21), and the right to lodge a complaint with a supervisory authority (Art. 77 GDPR); see sections 15 and 16. An informal email to info@codingforchange.com is enough.
>
> **Contact persons of the partner companies.** If you open such a link as the contact person of a partner company, we process the email address you sign in with and a log of when the link was used and which CV was opened or what was decided, to protect the registrations (Art. 6(1)(f) GDPR). Signing in sets a cookie that is strictly necessary for it (section 8). Both are deleted together with the link.

Habt ihr die vollständigen Firmennamen aus den Partnerverträgen, setzt sie im
Absatz „Empfänger“ statt der Markennamen ein.

### 1c. Ziffer 8: drei Einträge in der Liste „Alles, was auf Ihrem Endgerät gespeichert wird“

Nach dem Punkt „cfc-techtour-intro“ einfügen. Die zwei gespeicherten
Formular-Entwürfe gibt es schon; sie fehlten nur in der Liste.

> - cfc-share – hält die Ansprechperson eines Partnerunternehmens der TechTour im privaten Anmeldungslink angemeldet, nachdem sie ihre E-Mail-Adresse mit einem Code bestätigt hat (Cookie, nur auf diesem Link und nur für sie). Unbedingt erforderlich, für höchstens 12 Stunden.
> - cfc-techtour-draft – behält die Antworten, die Sie in die TechTour-Anmeldung eingegeben haben, wenn Sie auf „Speichern und später weitermachen“ klicken, nur in diesem Browser (Browser-Speicher, kein Cookie; keine Kästchen, kein Lebenslauf). Unbedingt erforderlich, bis Sie das Formular absenden oder die gespeicherten Antworten löschen, höchstens 30 Tage.
> - cfc-application-draft – behält die Antworten, die Sie in die Mitgliedsbewerbung eingeben, schon während des Tippens, nur in diesem Browser (Browser-Speicher, kein Cookie; keine Kästchen, kein Lebenslauf). Unbedingt erforderlich, bis Sie das Formular absenden oder die gespeicherten Antworten löschen, höchstens 30 Tage.

English, after "cfc-techtour-intro":

> - cfc-share – keeps the contact person of a TechTour partner company signed in to the private registration link after they confirmed their email address with a code (cookie, only on that link and only for them). Strictly necessary, for up to 12 hours.
> - cfc-techtour-draft – keeps the answers you have typed into the TechTour registration when you press "save and finish later", in this browser only (browser storage, not a cookie; no ticked boxes, no CV). Strictly necessary, until you send the form or delete the saved answers, at most 30 days.
> - cfc-application-draft – keeps the answers you have typed into the membership application as you type, in this browser only (browser storage, not a cookie; no ticked boxes, no CV). Strictly necessary, until you send the form or delete the saved answers, at most 30 days.

### 1d. Ziffer 9 (Google Ads): den Absatz „Was passiert: …“ ersetzen

Die TechTour-Anmeldung fehlte in der Liste der Aktionen.

> **Was passiert:** Mit Ihrer Einwilligung erfasst das Google-Tag, wenn Sie eine von fünf Aktionen abschließen – Eintrag in die Warteliste, Absenden einer Mitgliedsbewerbung, Anmeldung zur Munich TechTour, Senden einer Kontaktanfrage oder Buchen eines Termins – und verknüpft dies mit der von Ihnen angeklickten Anzeige. Google setzt hierfür _gcl_*-Cookies und verarbeitet die im Anzeigenlink enthaltene Klick-Kennung.

English – also fixes the stray formatting around "_gcl_aw":

> What happens: if you consent, Google's tag records when you complete one of five actions – joining the waitlist, submitting a membership application, registering for the Munich TechTour, sending a contact enquiry, or booking an appointment – and links it to the advertisement you clicked. For this purpose Google sets the cookies _gcl_aw and _gcl_dc and processes the click identifier contained in the ad link.

### 1e. Ziffer 17

„Stand Juli 2026“ → **„Stand Oktober 2026“** (EN: "dated July 2026" → **"dated October 2026"**).

---

## Schritt 2: Weitergabe-Kästchen im Formular „techtour“

**Weg A, empfohlen:**

```bash
node scripts/techtour-host-sharing.mjs           # Probelauf: listet jede Änderung, schreibt nichts
node scripts/techtour-host-sharing.mjs --apply   # schreibt DE und EN, liest zurück und prüft
```

Das Skript (aus #79) fügt das Kästchen direkt vor dem Datenschutz-Kästchen ein
und lässt alle anderen Fragen, wie sie im Admin stehen. Außerdem gleicht es die
Firmennamen in den Abend-Optionen an die TechTour-Seite an (im Live-Formular
sind Mittwoch und Donnerstag vertauscht) und ersetzt den ursprünglichen
Bestätigungstext. Der Probelauf zeigt alles vorher an.

**Weg B, von Hand:** Admin → Forms → Forms → „techtour“ → vor dem
Datenschutz-Kästchen einen Block **Checkbox** einfügen:

- **Name:** `hostSharing` – genau so geschrieben. Die Partner-Links zeigen nur Anmeldungen, in denen dieses Kästchen angehakt ist.
- **Required:** an. **Default Value:** leer lassen.
- **Label** zuerst mit Sprache English, speichern, dann Deutsch, speichern:
  - DE: `Ich willige ein, dass Coding for Change e.V. meine Angaben und meinen Lebenslauf an die Partnerunternehmen der von mir ausgewählten Events (Project A, Lio, QuantCo, QuantumBlack/McKinsey) zur Auswahl der Teilnehmenden weitergibt und diese mich zur Registrierung kontaktieren dürfen. Die Einwilligung kann ich jederzeit per Mail an info@codingforchange.com widerrufen.`
  - EN: `I consent to Coding for Change e.V. passing on my details and my CV to the partner companies of the events I selected (Project A, Lio, QuantCo, QuantumBlack/McKinsey) so that they can select the participants, and to these companies contacting me to register. I can withdraw this consent at any time by emailing info@codingforchange.com.`

Nichts anderes am Formular ändern.

---

## Schritt 3: Löschdatum setzen

Admin → Globals → „TechTour Page“ → rechte Spalte **„Delete registrations
on“** → **31.01.2027** → Save.

Am 31.01.2027 löscht das CMS beim ersten Lauf des Tages jede
TechTour-Anmeldung, die vor diesem Tag eingegangen ist. Mit ihr gehen der CV,
die Entscheidungen der Partner und die Partner-Links samt Protokoll.
Mitgliedsbewerbungen bleiben unberührt, auch solche, die über „auch als
Mitglied bewerben“ kamen. Ein Datum vor dem letzten Abend lehnt das Feld ab.
Für die nächste TechTour setzt ihr ein neues Datum; bis dahin werden spätere
Anmeldungen nicht angefasst.

---

## Schritt 4: Prüfen

- codingforchange.com/privacy auf DE und EN: Ziffern 5, 5a, 8, 9 und 17. `/privacy#munich-techtour` springt zu 5a.
- /techtour/apply in einem privaten Fenster: Das neue Kästchen steht vor dem Datenschutz-Kästchen, nichts ist angehakt, absenden geht nur mit beiden.
- Optional eine Test-Anmeldung mit eigener Adresse:
  1. Unter Forms → Form Submissions das Feld „Agreed to“ ansehen: Wortlaut, Version, Zeit.
  2. Die Anmeldung löschen: Der CV unter „Applicant files“ verschwindet mit.

---

## Schritt 5: Anmeldungen von vor dem Kästchen

Wer sich vor dem neuen Kästchen angemeldet hat, hat der Weitergabe nicht
zugestimmt; die bisherige Datenschutzerklärung schloss sie sogar ausdrücklich
aus. Diese Anmeldungen sieht kein Partner. Für alle neuen Anmeldungen ändert
sich nichts: Das Kästchen ist Pflicht, also geht jede samt CV an die Partner
ihrer Abende.

So findet ihr die alten: im Excel-Export „techtour“ alle Zeilen, in denen in
der Spalte „Agreed to (wording version)“ kein `hostSharing` steht. Im
Review-Workspace steht bei ihnen „Not shared – no consent to pass it on“.
Schreibt diesen Personen und löscht die alte Anmeldung, wenn die neue da ist:

> **Betreff:** Deine Anmeldung zur Munich TechTour – bitte einmal neu bestätigen
>
> Hallo {Vorname},
>
> danke für deine Anmeldung zur Munich TechTour! Die Partnerunternehmen wählen die Teilnehmenden ihrer Abende selbst aus. Damit wir deine Anmeldung an sie weitergeben dürfen, brauchen wir deine Einwilligung – die hat das Formular bei deiner Anmeldung noch nicht abgefragt. Bitte melde dich dafür einmal neu an: https://codingforchange.com/techtour/apply. Deine bisherige Anmeldung löschen wir danach.
>
> Viele Grüße
> Coding for Change

> **Subject:** Your Munich TechTour registration – please confirm once more
>
> Hi {first name},
>
> thanks for registering for the Munich TechTour! The partner companies select the participants for their evenings themselves. To pass your registration on to them we need your consent, which the form did not ask for yet when you registered. Please register once more: https://codingforchange.com/techtour/apply. We will then delete your earlier registration.
>
> Best,
> Coding for Change

---

## Schritt 6: Im Alltag

- **Partner wollen Ausgewählte kontaktieren:** Der Partner-Link zeigt keine E-Mail-Adressen (wie in #81). Die Einwilligung erlaubt es, einem Partner die Adressen der Personen zu geben, die er ausgewählt hat. Schickt sie ihm dann aus dem Excel-Export, nur für seinen Abend.
- **Widerruf:** Admin → Forms → Form Submissions → Person suchen → öffnen → oben rechts **⋯ → Delete**.
  - Der CV wird mitgelöscht, die Partner sehen die Anmeldung sofort nicht mehr.
  - Hat ein Partner sie schon gesehen, bittet seine Kontaktperson kurz per Mail, heruntergeladene Kopien zu löschen.
  - Gab es auch eine Mitgliedsbewerbung (der Review-Workspace zeigt „Also in Applications“), fragt nach, ob die auch weg soll. Sie ist ein eigener Datensatz.
- **Auskunft:** Excel-Export oder Review-Workspace zeigen alles, was zu einer Person gespeichert ist.

---

## Offen, eure Entscheidung

1. **Google-Tag vor der Einwilligung.**
   - Ist-Stand: `gtag.js` lädt auf allen Seiten auch ohne Einwilligung (Advanced Consent Mode mit cookielosen Pings an Google; Ziffer 9 beschreibt das). Die TechTour-Anmeldung meldet ohne Marketing-Einwilligung jetzt keine Conversion mehr.
   - Kosten: Google sieht dadurch den Großteil der TechTour-Anmeldungen nicht mehr.
   - Wenn: Soll auf /techtour/apply vor der Einwilligung gar kein Google-Kontakt stattfinden, muss `gtag.js` seitenweit erst nach der Einwilligung laden. Das betrifft die Messung für den Ad Grant.
2. **Eigene Reichweitenmessung.** Die cookielose Zählung (Ziffer 7, Art. 6 Abs. 1 lit. f) erfasst auch auf dem TechTour-Formular Start und Absenden. Sie arbeitet ohne Cookie und ohne Speicherung auf dem Gerät und lässt sich per DNT/GPC abschalten. Versteht ihr „kein Tracking ohne Einwilligung“ strenger, lässt sie sich für dieses Formular abschalten.
