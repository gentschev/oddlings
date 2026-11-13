import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.cache/**', '.codex-runs/**', 'test-results/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts'], rules: { '@typescript-eslint/no-non-null-assertion': 'off' } },
);
