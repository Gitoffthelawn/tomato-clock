const globals = require("globals");
const js = require("@eslint/js");
const babelParser = require("@babel/eslint-parser");

module.exports = [
  {
    ignores: ["dist/**", "dist-zip/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-env"],
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2015,
      },
      sourceType: "module",
    },
  },
];
