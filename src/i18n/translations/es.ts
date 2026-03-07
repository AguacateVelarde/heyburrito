export const es = {
  burrito: {
    given: '¡<@{giverId}> le dio un burrito a <@{receiverId}>! 🌯',
    givenWithMessage:
      '¡<@{giverId}> le dio un burrito a <@{receiverId}>! 🌯\n"{message}"',
    givenInChannel:
      '¡<@{giverId}> le dio un burrito a <@{receiverId}> en este canal! 🌯',
    selfGiven:
      '¡No se mencionó a nadie, así que <@{receiverId}> se lleva un burrito! 🌯',
    error: 'Error: {message}',
    giveBurrito: {
      self: '¡No puedes darte un burrito a ti mismo!',
      limit: 'Has alcanzado tu límite mensual de {monthlyLimit} burritos',
    },
    getLeaderboard: {
      disabled: 'La tabla de clasificación está actualmente desactivada.',
    },
  },
  leaderboard: {
    title: '🏆 *Tabla de Clasificación de Burritos* 🏆',
    entry: '{position}. *<@{userId}>*: {count} burritos 🌯',
  },
  errors: {
    unknownCommand: 'Comando no reconocido.',
    unknownEvent: 'Evento no reconocido.',
  },
};
