// Times shown in the viewer's own time zone, in the app's en-US style

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

// "9:45 AM"
export const formatTime = (t: number | Date) => timeFmt.format(t);

// "9 AM" on the hour, "9:45 AM" otherwise; for tight spots like axis ticks
export const formatTimeShort = (t: number | Date) => formatTime(t).replace(":00", "");

// "Oct 2"
export const formatDay = (t: number | Date) => dayFmt.format(t);

// "Thu, Oct 2"
export const formatWeekday = (t: number | Date) => weekdayFmt.format(t);

export const isSameDay = (a: number | Date, b: number | Date) => new Date(a).toDateString() === new Date(b).toDateString();

// "9:45 AM" today, "Oct 2, 9:45 AM" any other day
export const formatMoment = (t: number | Date) => (isSameDay(t, Date.now()) ? formatTime(t) : `${formatDay(t)}, ${formatTime(t)}`);

const pad2 = (n: number) => String(n).padStart(2, "0");

// A duration as three units: days, hours, minutes once it's a day or more,
// otherwise hours, minutes, seconds
export const durationParts = (ms: number): Array<{ value: string; unit: string }> => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hrs = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) {
    return [
      { value: String(days), unit: days === 1 ? "Day" : "Days" },
      { value: pad2(hrs), unit: "Hrs" },
      { value: pad2(mins), unit: "Min" },
    ];
  }
  return [
    { value: pad2(hrs), unit: "Hrs" },
    { value: pad2(mins), unit: "Min" },
    { value: pad2(secs), unit: "Sec" },
  ];
};
