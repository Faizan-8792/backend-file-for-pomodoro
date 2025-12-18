// backend/utils/date.js
function isoDateInTimeZone(date = new Date(), timeZone = "Asia/Kolkata") {
  // Produces YYYY-MM-DD in the given timezone using Intl (no extra libs)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

module.exports = { isoDateInTimeZone };
