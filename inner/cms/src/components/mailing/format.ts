/** Dates in the mailing screens: Berlin time, like the review workspace. */
export const when = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
