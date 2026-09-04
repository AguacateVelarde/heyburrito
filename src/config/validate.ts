export const validate = () => (config: Record<string, unknown>) => {
  const {
    MONTHLY_BURRITO_LIMIT,
    ENABLE_LEADERBOARD,
    ENABLE_MONTHLY_RESET,
    SHOW_MONTHLY_LEADER,
    ENABLE_BIRTHDAYS,
    ...rest
  } = config;

  // Convert string values to appropriate types
  const parsedConfig = {
    ...rest,
    MONTHLY_BURRITO_LIMIT: MONTHLY_BURRITO_LIMIT
      ? parseInt(MONTHLY_BURRITO_LIMIT as string, 10)
      : 0,
    ENABLE_LEADERBOARD: ENABLE_LEADERBOARD === 'true',
    ENABLE_MONTHLY_RESET: ENABLE_MONTHLY_RESET === 'true',
    SHOW_MONTHLY_LEADER: SHOW_MONTHLY_LEADER === 'true',
    // Birthdays are on by default, so only an explicit 'false' disables them.
    ENABLE_BIRTHDAYS:
      ENABLE_BIRTHDAYS === undefined || ENABLE_BIRTHDAYS === 'true',
  };

  return parsedConfig;
};
