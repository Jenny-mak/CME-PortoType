export type PublicHoliday = {
  dateKey: string;
  name: string;
  shortName: string;
};

/** Hong Kong general holidays (GovHK gazetted), keyed by YYYY-MM-DD. */
const HK_HOLIDAYS: PublicHoliday[] = [
  // 2025
  { dateKey: "2025-01-01", name: "The first day of January", shortName: "New Year" },
  { dateKey: "2025-01-29", name: "Lunar New Year's Day", shortName: "Lunar NY" },
  { dateKey: "2025-01-30", name: "The second day of Lunar New Year", shortName: "Lunar NY" },
  { dateKey: "2025-01-31", name: "The third day of Lunar New Year", shortName: "Lunar NY" },
  { dateKey: "2025-04-04", name: "Ching Ming Festival", shortName: "Ching Ming" },
  { dateKey: "2025-04-18", name: "Good Friday", shortName: "Good Friday" },
  { dateKey: "2025-04-19", name: "The day following Good Friday", shortName: "Easter" },
  { dateKey: "2025-04-21", name: "Easter Monday", shortName: "Easter" },
  { dateKey: "2025-05-01", name: "Labour Day", shortName: "Labour Day" },
  { dateKey: "2025-05-05", name: "The Birthday of the Buddha", shortName: "Buddha's Day" },
  { dateKey: "2025-05-31", name: "Tuen Ng Festival", shortName: "Tuen Ng" },
  { dateKey: "2025-07-01", name: "HKSAR Establishment Day", shortName: "HKSAR Day" },
  { dateKey: "2025-10-01", name: "National Day", shortName: "National Day" },
  { dateKey: "2025-10-07", name: "The day following Mid-Autumn Festival", shortName: "Mid-Autumn" },
  { dateKey: "2025-10-29", name: "Chung Yeung Festival", shortName: "Chung Yeung" },
  { dateKey: "2025-12-25", name: "Christmas Day", shortName: "Christmas" },
  { dateKey: "2025-12-26", name: "The first weekday after Christmas Day", shortName: "Boxing Day" },

  // 2026
  { dateKey: "2026-01-01", name: "The first day of January", shortName: "New Year" },
  { dateKey: "2026-02-17", name: "Lunar New Year's Day", shortName: "Lunar NY" },
  { dateKey: "2026-02-18", name: "The second day of Lunar New Year", shortName: "Lunar NY" },
  { dateKey: "2026-02-19", name: "The third day of Lunar New Year", shortName: "Lunar NY" },
  { dateKey: "2026-04-03", name: "Good Friday", shortName: "Good Friday" },
  { dateKey: "2026-04-04", name: "The day following Good Friday", shortName: "Easter" },
  { dateKey: "2026-04-06", name: "The day following Ching Ming Festival", shortName: "Ching Ming" },
  { dateKey: "2026-04-07", name: "The day following Easter Monday", shortName: "Easter" },
  { dateKey: "2026-05-01", name: "Labour Day", shortName: "Labour Day" },
  { dateKey: "2026-05-25", name: "The day following the Birthday of the Buddha", shortName: "Buddha's Day" },
  { dateKey: "2026-06-19", name: "Tuen Ng Festival", shortName: "Tuen Ng" },
  { dateKey: "2026-07-01", name: "HKSAR Establishment Day", shortName: "HKSAR Day" },
  { dateKey: "2026-09-26", name: "The day following Mid-Autumn Festival", shortName: "Mid-Autumn" },
  { dateKey: "2026-10-01", name: "National Day", shortName: "National Day" },
  { dateKey: "2026-10-19", name: "The day following Chung Yeung Festival", shortName: "Chung Yeung" },
  { dateKey: "2026-12-25", name: "Christmas Day", shortName: "Christmas" },
  { dateKey: "2026-12-26", name: "The first weekday after Christmas Day", shortName: "Boxing Day" },

  // 2027
  { dateKey: "2027-01-01", name: "The first day of January", shortName: "New Year" },
  { dateKey: "2027-02-06", name: "Lunar New Year's Day", shortName: "Lunar NY" },
  { dateKey: "2027-02-08", name: "The third day of Lunar New Year", shortName: "Lunar NY" },
  { dateKey: "2027-02-09", name: "The fourth day of Lunar New Year", shortName: "Lunar NY" },
  { dateKey: "2027-03-26", name: "Good Friday", shortName: "Good Friday" },
  { dateKey: "2027-03-27", name: "The day following Good Friday", shortName: "Easter" },
  { dateKey: "2027-03-29", name: "Easter Monday", shortName: "Easter" },
  { dateKey: "2027-04-05", name: "Ching Ming Festival", shortName: "Ching Ming" },
  { dateKey: "2027-05-01", name: "Labour Day", shortName: "Labour Day" },
  { dateKey: "2027-05-13", name: "The Birthday of the Buddha", shortName: "Buddha's Day" },
  { dateKey: "2027-06-09", name: "Tuen Ng Festival", shortName: "Tuen Ng" },
  { dateKey: "2027-07-01", name: "HKSAR Establishment Day", shortName: "HKSAR Day" },
  { dateKey: "2027-09-16", name: "The day following Mid-Autumn Festival", shortName: "Mid-Autumn" },
  { dateKey: "2027-10-01", name: "National Day", shortName: "National Day" },
  { dateKey: "2027-10-08", name: "Chung Yeung Festival", shortName: "Chung Yeung" },
  { dateKey: "2027-12-25", name: "Christmas Day", shortName: "Christmas" },
  { dateKey: "2027-12-27", name: "The first weekday after Christmas Day", shortName: "Boxing Day" },
];

const HOLIDAY_BY_DATE = new Map(HK_HOLIDAYS.map((holiday) => [holiday.dateKey, holiday]));

export function getHoliday(dateKey: string): PublicHoliday | undefined {
  return HOLIDAY_BY_DATE.get(dateKey);
}
