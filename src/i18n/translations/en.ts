export const en = {
  burrito: {
    given: '<@{giverId}> gave a burrito to <@{receiverId}>! 🌯',
    givenWithMessage:
      '<@{giverId}> gave a burrito to <@{receiverId}>! 🌯\n"{message}"',
    givenInChannel:
      '<@{giverId}> gave a burrito to <@{receiverId}> in this channel! 🌯',
    selfGiven: 'No one was mentioned, so <@{receiverId}> gets a burrito! 🌯',
    givenMultiple:
      '<@{giverId}> gave burritos to {receivers}! 🌯 ({count} burritos)',
    error: 'Error: {message}',
    giveBurrito: {
      self: 'You cannot give a burrito to yourself!',
      limit: 'You have reached your monthly limit of {monthlyLimit} burritos',
    },
    getLeaderboard: {
      disabled: 'The leaderboard is currently disabled.',
    },
  },
  leaderboard: {
    title: '🏆 *Burrito Leaderboard* 🏆',
    entry: '{position}. *<@{userId}>*: {count} burritos 🌯',
  },
  birthday: {
    greeting: {
      single: '🎉🎂 Happy birthday <@{userId}>! Have an amazing day. 🌯',
      singleWithAge:
        '🎉🎂 Happy birthday <@{userId}>! You turn {age} today. Enjoy it! 🌯',
      multiple: '🎉🎂 Big day today! Happy birthday to {mentions} 🌯',
      imageTitle: 'Happy birthday! 🎂',
    },
    saved: "🎂 Done, <@{userId}>'s birthday is set to {date}.",
    savedWithYear: "🎂 Done, <@{userId}>'s birthday is set to {date}/{year}.",
    removed: "🗑️ Removed <@{userId}>'s birthday.",
    announced: '📣 Greeting posted for {mentions} in <#{channel}>.',
    nothingToAnnounce: 'Nobody registered is celebrating today. 🙂',
    list: {
      title: '🎂 *Team birthdays* 🎂',
      entry: '• *<@{userId}>* — {date}',
      empty:
        'No birthdays registered yet. Use `{command} set DD/MM` to add yours.',
    },
    upcoming: {
      title: '🎂 *Upcoming birthdays* 🎂',
      entry: '{position}. *<@{userId}>* — {date} · {when}',
      today: 'today 🎉',
      tomorrow: 'tomorrow',
      inDays: 'in {days} days',
    },
    today: {
      title: "🎂 *Today's birthdays* 🎂",
      entry: '• *<@{userId}>*',
      none: 'Nobody registered is celebrating today. 🙂',
    },
    errors: {
      invalidDate:
        'I could not read the date "{value}". Use DD/MM or DD/MM/YYYY.',
      missingUser: 'I need to know whose birthday it is. Mention them with @.',
      missingDate: 'The date is missing. Example: `{command} set 05/03`.',
      notFound: 'No birthday registered for <@{userId}>.',
      disabled: 'The birthdays module is disabled.',
      noChannel:
        'No birthday channel is configured. Set BIRTHDAY_CHANNEL or SLACK_DEFAULT_CHANNEL.',
      postFailed: 'Could not post the greeting to {channel}: {reason}',
      unknownSubcommand: 'I do not recognize "{subcommand}".',
    },
    help:
      '🎂 *Birthdays* 🎂\n' +
      '• `{command} set DD/MM[/YYYY]` — register your birthday\n' +
      "• `{command} add @user DD/MM[/YYYY]` — register someone else's\n" +
      '• `{command} remove [@user]` — delete a birthday\n' +
      '• `{command} list` — show every birthday\n' +
      '• `{command} next [n]` — show the upcoming birthdays\n' +
      '• `{command} today` — show who is celebrating today\n' +
      "• `{command} announce` — post today's greeting right now",
  },
  errors: {
    unknownCommand: 'Unrecognized command.',
    unknownEvent: 'Unrecognized event.',
  },
};
