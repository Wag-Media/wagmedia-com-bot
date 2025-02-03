import { parseEventFromDiscord } from "../utils/parse-event";

// Mock message structure
interface MockMessage {
  content: string;
  embeds: Array<{
    url?: string;
    image?: {
      url?: string;
      proxyURL?: string;
      width?: number;
      height?: number;
    };
    thumbnail?: {
      url?: string;
      proxyURL?: string;
      width?: number;
      height?: number;
    };
    color?: number;
  }>;
}

describe("parseEventFromDiscord", () => {
  it("should parse a basic event with required fields", () => {
    const mockMessage: MockMessage = {
      content: `
title: Community Call
date: 2024-03-20
time: 15:00 UTC
description: Monthly community call to discuss updates
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Community Call",
      description: "Monthly community call to discuss updates",
      startsAt: expect.any(Date),
      isAllDay: false,
      timezone: "UTC",
    });
  });

  it("should parse an all-day event", () => {
    const mockMessage: MockMessage = {
      content: `
title: Conference Day
date: 2024-03-21
description: All day conference
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Conference Day",
      description: "All day conference",
      isAllDay: true,
      startsAt: expect.any(Date),
    });
  });

  it("should parse event with tags and location", () => {
    const mockMessage: MockMessage = {
      content: `
title: Tech Meetup
date: 2024-03-22
time: 18:00 EST
description: Local tech meetup
location: Virtual
tags: #tech,community #virtual
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Tech Meetup",
      location: "Virtual",
      tags: ["tech", "community", "virtual"],
      timezone: "EST",
    });
  });

  it("should parse recurring event with end date", () => {
    const mockMessage: MockMessage = {
      content: `
title: Weekly Standup
date: 2024-03-25
time: 10:00 PST
description: Team sync
repeats: weekly
end-date: 2024-04-25
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Weekly Standup",
      recurrenceRule: "weekly",
      startsAt: expect.any(Date),
      endsAt: expect.any(Date),
      timezone: "PST",
    });
  });

  it("should handle invalid recurrence rule", () => {
    const mockMessage: MockMessage = {
      content: `
title: Invalid Recurring Event
date: 2024-03-25
time: 10:00 UTC
repeats: invalid-rule
end-date: 2024-04-25
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Invalid Recurring Event",
      recurrenceRule: null,
      startsAt: expect.any(Date),
      endsAt: expect.any(Date),
      timezone: "UTC",
    });
  });

  it("should parse recurring event without end date", () => {
    const mockMessage: MockMessage = {
      content: `
title: Daily Standup
date: 2024-03-25
time: 10:00 UTC
repeats: daily
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Daily Standup",
      recurrenceRule: "daily",
      recurrenceEndDate: null,
      startsAt: expect.any(Date),
      timezone: "UTC",
    });
  });

  it("should handle missing required fields", () => {
    const mockMessage: MockMessage = {
      content: "Just some random content",
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: null,
      description: null,
      startsAt: null,
      endsAt: null,
      isAllDay: false,
    });
  });

  it("should parse event with end date and time", () => {
    const mockMessage: MockMessage = {
      content: `
title: Extended Meeting
date: 2024-03-27
time: 14:00 UTC
end-date: 2024-03-27
end-time: 16:00 UTC
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    // Use Date.UTC to create UTC timestamps
    const expectedStart = new Date(Date.UTC(2024, 2, 27, 14, 0, 0));
    const expectedEnd = new Date(Date.UTC(2024, 2, 27, 16, 0, 0));

    expect(result).toMatchObject({
      title: "Extended Meeting",
      startsAt: expectedStart,
      endsAt: expectedEnd,
      isAllDay: false,
      timezone: "UTC",
    });
  });

  it("should handle invalid date formats", () => {
    const mockMessage: MockMessage = {
      content: `
title: Invalid Date Event
date: invalid-date
time: not-a-time
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Invalid Date Event",
      startsAt: null,
      endsAt: null,
      isAllDay: false,
    });
  });

  it("should default to UTC if no or invalid  timezone is provided", () => {
    //
    const mockMessage: MockMessage = {
      content: `
title: Invalid Timezone Event
date: 2024-03-25
time: 10:00 XXXA
      `.trim(),
      embeds: [],
    };

    const result = parseEventFromDiscord(mockMessage as any);

    expect(result).toMatchObject({
      title: "Invalid Timezone Event",
      startsAt: new Date(Date.UTC(2024, 2, 25, 10, 0, 0)),
      endsAt: new Date(Date.UTC(2024, 2, 25, 10, 0, 0)),
      isAllDay: false,
      timezone: "UTC",
    });
  });
});
