export const es = {
  burrito: {
    given: '¡<@{giverId}> le dio un burrito a <@{receiverId}>! 🌯',
    givenWithMessage:
      '¡<@{giverId}> le dio un burrito a <@{receiverId}>! 🌯\n"{message}"',
    givenInChannel:
      '¡<@{giverId}> le dio un burrito a <@{receiverId}> en este canal! 🌯',
    selfGiven:
      '¡No se mencionó a nadie, así que <@{receiverId}> se lleva un burrito! 🌯',
    givenMultiple:
      '¡<@{giverId}> le dio burritos a {receivers}! 🌯 ({count} burritos)',
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
  birthday: {
    greeting: {
      single:
        '🎉🎂 ¡Feliz cumpleaños <@{userId}>! Que tengas un día increíble. 🌯',
      singleWithAge:
        '🎉🎂 ¡Feliz cumpleaños <@{userId}>! Hoy cumples {age} años. ¡Que lo disfrutes! 🌯',
      multiple:
        '🎉🎂 ¡Hoy están de manteles largos! Muchas felicidades a {mentions} 🌯',
      imageTitle: '¡Feliz cumpleaños! 🎂',
    },
    saved: '🎂 Listo, el cumpleaños de <@{userId}> quedó registrado el {date}.',
    savedWithYear:
      '🎂 Listo, el cumpleaños de <@{userId}> quedó registrado el {date}/{year}.',
    removed: '🗑️ Se eliminó el cumpleaños de <@{userId}>.',
    announced: '📣 Se publicó el saludo para {mentions} en <#{channel}>.',
    nothingToAnnounce: 'Hoy no cumple años nadie registrado. 🙂',
    list: {
      title: '🎂 *Cumpleaños del equipo* 🎂',
      entry: '• *<@{userId}>* — {date}',
      empty:
        'Todavía no hay cumpleaños registrados. Usa `{command} set DD/MM` para agregar el tuyo.',
    },
    upcoming: {
      title: '🎂 *Próximos cumpleaños* 🎂',
      entry: '{position}. *<@{userId}>* — {date} · {when}',
      today: 'hoy 🎉',
      tomorrow: 'mañana',
      inDays: 'en {days} días',
    },
    today: {
      title: '🎂 *Cumpleaños de hoy* 🎂',
      entry: '• *<@{userId}>*',
      none: 'Hoy no cumple años nadie registrado. 🙂',
    },
    errors: {
      invalidDate:
        'No pude leer la fecha "{value}". Usa el formato DD/MM o DD/MM/AAAA.',
      missingUser:
        'Necesito saber de quién es el cumpleaños. Menciona a la persona con @.',
      missingDate: 'Falta la fecha. Ejemplo: `{command} set 05/03`.',
      notFound: 'No encontré un cumpleaños registrado para <@{userId}>.',
      disabled: 'El módulo de cumpleaños está desactivado.',
      noChannel:
        'No hay un canal configurado para los cumpleaños. Define BIRTHDAY_CHANNEL o SLACK_DEFAULT_CHANNEL.',
      postFailed: 'No se pudo publicar el saludo en {channel}: {reason}',
      unknownSubcommand: 'No reconozco "{subcommand}".',
    },
    help:
      '🎂 *Cumpleaños* 🎂\n' +
      '• `{command} set DD/MM[/AAAA]` — registra tu cumpleaños\n' +
      '• `{command} add @usuario DD/MM[/AAAA]` — registra el de alguien más\n' +
      '• `{command} remove [@usuario]` — elimina un cumpleaños\n' +
      '• `{command} list` — muestra todos los cumpleaños\n' +
      '• `{command} next [n]` — muestra los próximos cumpleaños\n' +
      '• `{command} today` — muestra quién cumple hoy\n' +
      '• `{command} announce` — publica ahora el saludo del día',
  },
  errors: {
    unknownCommand: 'Comando no reconocido.',
    unknownEvent: 'Evento no reconocido.',
  },
};
