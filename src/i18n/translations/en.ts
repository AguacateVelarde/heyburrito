export const en = {
  burrito: {
    given: '<@{giverId}> gave a burrito to <@{receiverId}>! 🌯',
    givenWithMessage:
      '<@{giverId}> gave a burrito to <@{receiverId}>! 🌯\n"{message}"',
    givenInChannel:
      '<@{giverId}> gave a burrito to <@{receiverId}> in this channel! 🌯',
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
  errors: {
    unknownCommand: 'Unrecognized command.',
    unknownEvent: 'Unrecognized event.',
  },
};
