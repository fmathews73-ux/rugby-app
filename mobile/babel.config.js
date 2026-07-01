/**
 * Babel config for the mobile app.
 *
 * Adds a module-resolver alias so `@rugby-app/shared` types can be imported
 * from `mobile/` without adding `mobile/` to the root npm workspaces (which
 * would confuse Metro / Expo's expectations of a self-contained node_modules).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@rugby-app/shared': '../packages/shared/src/types',
          },
        },
      ],
    ],
  };
};
