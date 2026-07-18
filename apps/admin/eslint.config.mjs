import preset from "@skillcontest/config/eslint-preset"
import nextPlugin from "@next/eslint-plugin-next"

export default [
  ...preset,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  { ignores: [".next/**"] },
]
