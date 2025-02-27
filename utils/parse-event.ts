import { parse, startOfDay, endOfDay } from "date-fns";
import { toDate as zonedTimeToUtc } from "date-fns-tz";
import type { EventType } from "./handle-event";
import { Message } from "discord.js";
import * as chrono from "chrono-node";
import { DateTime } from "luxon";

interface DateTimeParams {
  date: string | undefined;
  time: string | undefined;
  endDate: string | undefined;
  endTime: string | undefined;
}

function parseDatesAndTimes({ date, time, endDate, endTime }: DateTimeParams) {
  console.log("Parsing dates:", { date, time, endDate, endTime });

  if (!date)
    return {
      startsAt: null,
      endsAt: null,
      isAllDay: false,
      timezone: null,
      recurrenceEndDate: null,
    };

  const isAllDay = !time;
  const parsedStartDateTime = parseDateTimeToUTC(date, time);

  // Always parse endDateTime using the start date for recurring events
  const parsedEndDateTime = parseDateTimeToUTC(date, endTime);

  // Parse recurrence end date separately
  const parsedRecurrenceEndDate = endDate
    ? parseDateTimeToUTC(endDate, time || "23:59:59")
    : null;

  // Extract timezone from time string if present
  const timezoneMatch = time?.match(
    /\b(?:UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)(?:[+-]\d{1,2}(?::\d{2})?)?|\b[+-]\d{1,2}(?::\d{2})?\b/,
  );
  const timezone = timezoneMatch ? timezoneMatch[0] : "UTC";

  if (!parsedStartDateTime)
    return {
      startsAt: null,
      endsAt: null,
      isAllDay: false,
      timezone: null,
      recurrenceEndDate: null,
    };

  const startsAt = new Date(parsedStartDateTime);
  const endsAt = parsedEndDateTime ? new Date(parsedEndDateTime) : null;
  const recurrenceEndDate = parsedRecurrenceEndDate
    ? new Date(parsedRecurrenceEndDate)
    : null;

  // Final validation of dates
  if (isNaN(startsAt.getTime()) || (endsAt && isNaN(endsAt.getTime()))) {
    return {
      startsAt: null,
      endsAt: null,
      isAllDay: false,
      timezone: null,
      recurrenceEndDate: null,
    };
  }

  console.log("Final dates:", { startsAt, endsAt, isAllDay, timezone });
  return { startsAt, endsAt, isAllDay, timezone, recurrenceEndDate };
}

function parseRecurrenceRule(rule: string | null): {
  rule: string | null;
  endDate: Date | null;
} {
  if (!rule) return { rule: null, endDate: null };

  const validRules = ["weekly", "monthly", "daily"];
  const normalizedRule = rule.trim().toLowerCase();

  return {
    rule: validRules.includes(normalizedRule) ? normalizedRule : null,
    endDate: null,
  };
}

export function parseEventFromDiscord(message: Message<boolean>): EventType {
  const { content, embeds } = message;

  const patterns = {
    title: /(?<=^|\n)\*{0,2}title\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    description: /(?<=^|\n)\*{0,2}description\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    date: /(?<=^|\n)\*{0,2}date\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    time: /(?<=^|\n)\*{0,2}time\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    endDate: /(?<=^|\n)\*{0,2}end[- ]?date\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    endTime: /(?<=^|\n)\*{0,2}end[- ]?time\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    location: /(?<=^|\n)\*{0,2}location\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    link: /(?<=^|\n)\*{0,2}link\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
    recurrence:
      /(?<=^|\n)\*{0,2}recurrence\*{0,2}\s*:\s*(daily|weekly|monthly)(?=\n|$)/i,
    tags: /(?<=^|\n)\*{0,2}tags?\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
  };

  const matches = {
    title: content.match(patterns.title)?.[1]?.trim(),
    description: content.match(patterns.description)?.[1]?.trim(),
    date: content.match(patterns.date)?.[1]?.trim(),
    time: content.match(patterns.time)?.[1]?.trim(),
    endDate: content.match(patterns.endDate)?.[1]?.trim(),
    endTime: content.match(patterns.endTime)?.[1]?.trim(),
    location: content.match(patterns.location)?.[1]?.trim(),
    link: content.match(patterns.link)?.[1]?.trim(),
    recurrence: content.match(patterns.recurrence)?.[1]?.trim(),
    tags: content.match(patterns.tags)?.[1]?.trim(),
  };

  let tags: string[] = [];

  // Process the hashtags string: split, remove leading '#', and filter empty strings
  if (matches.tags) {
    // Normalize the tags string to remove '#' and split by non-word characters except for '-'
    // also make lowercase
    tags = matches.tags
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, "").trim().toLowerCase())
      .filter((tag) => tag.length > 0);
  }

  let embedData = embeds.map((embed) => ({
    url: embed.url || null,
    imageUrl:
      embed.image?.proxyURL ||
      embed.image?.url ||
      embed.thumbnail?.url ||
      embed.thumbnail?.proxyURL ||
      null,
    width: embed.image?.width || embed.thumbnail?.width || null,
    height: embed.image?.height || embed.thumbnail?.height || null,
    color: embed.color || null,
  }));

  const { startsAt, endsAt, isAllDay, timezone, recurrenceEndDate } =
    parseDatesAndTimes({
      date: matches.date,
      time: matches.time,
      endDate: matches.endDate,
      endTime: matches.endTime,
    });

  // Only allow recurrence if an end date is specified
  const { rule: recurrenceRule } = parseRecurrenceRule(
    matches.recurrence && matches.endDate ? matches.recurrence : null,
  );

  // For recurring events: always use the end time on the same day as start
  // For non-recurring events: use the full end date and time
  const finalEndsAt = recurrenceRule
    ? parseDateTimeToUTC(matches.date, matches.endTime)
      ? new Date(parseDateTimeToUTC(matches.date, matches.endTime)!)
      : null
    : endsAt;

  console.log("embedDataImage", embedData?.[0]?.imageUrl);

  return {
    title: matches.title || null,
    description: matches.description || null,
    startsAt,
    endsAt: finalEndsAt,
    isAllDay,
    location: matches.location || null,
    link: matches.link || null,
    image: embedData?.[0]?.imageUrl || null,
    discordLink: null,
    recurrenceRule,
    recurrenceEndDate: recurrenceRule ? recurrenceEndDate : null,
    timezone,
    embeds: embedData,
    tags,
  };
}

export function parseDateTimeToUTC(
  dateInput: string | undefined,
  timeInput: string | undefined,
): string | null {
  if (!dateInput) return null;

  // Check for common formats with 4-digit years
  const validFormats = [
    /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
    /^\d{1,2}[.-]\d{1,2}[.-]\d{4}$/, // DD.MM.YYYY or DD-MM-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // DD/MM/YYYY
  ];

  if (!validFormats.some((format) => format.test(dateInput))) return null;

  const combinedInput = timeInput ? `${dateInput} ${timeInput}` : dateInput;
  const parsed = chrono.parseDate(combinedInput, { timezone: "UTC" });
  if (!parsed) return null;

  return DateTime.fromJSDate(parsed).toUTC().toISO();
}
