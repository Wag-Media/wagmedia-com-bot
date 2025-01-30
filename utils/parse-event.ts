import { parse, startOfDay, endOfDay } from "date-fns";
import { toDate as zonedTimeToUtc } from "date-fns-tz";
import type { EventType } from "./handle-event";
import { Message } from "discord.js";

interface ParsedEvent {
  title: string | null;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isAllDay: boolean;
  location: string | null;
  link: string | null;
  recurrenceRule: string | null;
  recurrenceEndDate: Date | null;
  tags: string[];
  timezone: string | null; // Store the original timezone
}

interface TimeComponents {
  time: string;
  timezone: string | null;
}

interface DateTimeParams {
  date: string | undefined;
  time: string | undefined;
  endDate: string | undefined;
  endTime: string | undefined;
}

function parseTimeString(timeStr: string): TimeComponents {
  // Common timezone abbreviations mapping
  const tzAbbreviations: Record<string, string> = {
    EST: "America/New_York",
    EDT: "America/New_York",
    CST: "America/Chicago",
    CDT: "America/Chicago",
    MST: "America/Denver",
    MDT: "America/Denver",
    PST: "America/Los_Angeles",
    PDT: "America/Los_Angeles",
    UTC: "UTC",
    GMT: "UTC",
  };

  // Match time and optional timezone
  // Matches formats like:
  // 15:00
  // 3:00 PM
  // 15:00 EST
  // 3:00 PM America/New_York
  const timePattern = /^(\d{1,2}(?::\d{2})?\s*(?:[AaPp][Mm])?)\s*(.+)?$/;
  const match = timeStr.trim().match(timePattern);

  if (!match) return { time: timeStr, timezone: null };

  const [, timeComponent, timezoneComponent] = match;

  if (!timezoneComponent) return { time: timeComponent, timezone: null };

  // Check if it's a known abbreviation
  const timezone =
    tzAbbreviations[timezoneComponent.toUpperCase()] || timezoneComponent;

  return { time: timeComponent, timezone };
}

function parseDatesAndTimes({ date, time, endDate, endTime }: DateTimeParams) {
  console.log("Parsing dates:", { date, time, endDate, endTime }); // Debug log

  if (!date)
    return {
      startsAt: null,
      endsAt: null,
      isAllDay: false,
      timezone: null,
    };

  const isAllDay = !time;
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  let timezone: string | null = null;

  try {
    if (isAllDay) {
      startsAt = parse(date, "yyyy-MM-dd", new Date());
      startsAt = startOfDay(startsAt);

      if (endDate) {
        endsAt = parse(endDate, "yyyy-MM-dd", new Date());
        endsAt = endOfDay(endsAt);
      }
    } else {
      const startTime = parseTimeString(time!);
      timezone = startTime.timezone || "UTC";

      console.log("Parsed start time:", startTime); // Debug log

      const localDate = parse(
        `${date} ${startTime.time}`,
        startTime.time.toLowerCase().includes("m")
          ? "yyyy-MM-dd hh:mm a"
          : "yyyy-MM-dd HH:mm",
        new Date(),
      );

      console.log("Parsed local date:", localDate); // Debug log

      startsAt = zonedTimeToUtc(localDate, { timeZone: timezone });

      if (endDate || endTime) {
        const actualEndDate = endDate || date;
        const endTimeComponents = endTime
          ? parseTimeString(endTime)
          : startTime;

        console.log("End time components:", endTimeComponents); // Debug log

        const localEndDate = parse(
          `${actualEndDate} ${endTimeComponents.time}`,
          endTimeComponents.time.toLowerCase().includes("m")
            ? "yyyy-MM-dd hh:mm a"
            : "yyyy-MM-dd HH:mm",
          new Date(),
        );

        console.log("Parsed local end date:", localEndDate); // Debug log

        endsAt = zonedTimeToUtc(localEndDate, {
          timeZone: endTimeComponents.timezone || timezone,
        });
      }
    }
  } catch (error) {
    console.error("Error parsing dates:", error);
    return {
      startsAt: null,
      endsAt: null,
      isAllDay: false,
      timezone: null,
    };
  }

  console.log("Final dates:", { startsAt, endsAt, isAllDay, timezone }); // Debug log
  return { startsAt, endsAt, isAllDay, timezone };
}

function parseRecurrenceRule(rule: string | null): {
  rule: string | null;
  endDate: Date | null;
} {
  if (!rule) return { rule: null, endDate: null };

  const pattern =
    /^(weekly|monthly|daily|yearly)(?:\s+until\s+(\d{4}-\d{2}-\d{2}))?$/i;
  const matches = rule.trim().match(pattern);

  if (!matches) return { rule: null, endDate: null };

  const [, recurrenceType, endDateStr] = matches;

  return {
    rule: recurrenceType.toLowerCase(),
    endDate: endDateStr ? parse(endDateStr, "yyyy-MM-dd", new Date()) : null,
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
    recurrence: /(?<=^|\n)\*{0,2}repeats?\*{0,2}\s*:\s*(.*?)(?=\n|$)/i,
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

  const { startsAt, endsAt, isAllDay, timezone } = parseDatesAndTimes({
    date: matches.date,
    time: matches.time,
    endDate: matches.endDate,
    endTime: matches.endTime,
  });

  const { rule: recurrenceRule, endDate: recurrenceEndDate } =
    parseRecurrenceRule(matches.recurrence ?? null);

  console.log("embedDataImage", embedData?.[0]?.imageUrl);

  return {
    title: matches.title || null,
    description: matches.description || null,
    startsAt,
    endsAt,
    isAllDay,
    location: matches.location || null,
    link: matches.link || null,
    image: embedData?.[0]?.imageUrl || null,
    discordLink: null,
    recurrenceRule,
    recurrenceEndDate,
    timezone,
    embeds: embedData,
    tags,
  };
}
