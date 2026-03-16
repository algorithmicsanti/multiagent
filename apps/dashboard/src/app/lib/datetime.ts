const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export function formatDateTimeCDMX(value: string | Date) {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

export function formatTimeCDMX(value: string | Date) {
  return TIME_FORMATTER.format(new Date(value));
}