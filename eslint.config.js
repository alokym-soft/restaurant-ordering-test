// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

const root = import.meta.dirname;
const web = 'apps/web/src/app';

/**
 * Architecture boundaries of the web app. Everything not explicitly allowed is rejected.
 * Element order matters: the first matching descriptor wins.
 */
const webElements = [
  { type: 'contracts', pattern: 'packages/contracts', partialMatch: false },
  { type: 'core', pattern: `${web}/core/*`, partialMatch: false, capture: ['area'] },
  { type: 'shared-ui', pattern: `${web}/shared/ui`, partialMatch: false },
  { type: 'shared-util', pattern: `${web}/shared/util`, partialMatch: false },
  { type: 'data-access', pattern: `${web}/domains/*/data-access`, partialMatch: false, capture: ['domain'] },
  { type: 'feature', pattern: `${web}/domains/*/feature-*`, partialMatch: false, capture: ['domain', 'feature'] },
  { type: 'ui', pattern: `${web}/domains/*/ui`, partialMatch: false, capture: ['domain'] },
  // Files directly in a domain folder: only its public `index.ts`.
  { type: 'domain-entry', pattern: `${web}/domains/*`, partialMatch: false, capture: ['domain'] },
  { type: 'app', pattern: 'apps/web/src', partialMatch: false },
];

const sameDomain = { domain: '{{ from.element.captured.domain }}' };
const otherDomain = { domain: '!{{ from.element.captured.domain }}' };
const el = (type, captured) => ({ element: captured ? { type, captured } : { type } });

/** @type {import('eslint-plugin-boundaries').DependenciesRuleOptions} */
const webBoundaries = {
  default: 'disallow',
  message: '{{ from.element.types }} must not depend on {{ to.element.types }} ({{ dependency.source }})',
  policies: [
    // Packages, Node built-ins, shared contracts and files of the same element.
    { allow: { to: { module: { origin: ['external', 'core'] } } } },
    { allow: { to: el('contracts') } },
    { allow: { dependency: { relationship: { to: 'internal' } } } },
    // Composition root: routes, providers, bootstrap.
    { from: el('app'), allow: { to: { element: { type: '*' } } } },
    {
      from: el('domain-entry'),
      allow: { to: [el('data-access', sameDomain), el('feature', sameDomain), el('ui', sameDomain)] },
    },
    {
      from: el('feature'),
      allow: {
        to: [
          el('feature', { domain: '{{ from.element.captured.domain }}', feature: '{{ from.element.captured.feature }}' }),
          el('data-access', sameDomain),
          el('ui', sameDomain),
          el('domain-entry', otherDomain),
          el('core'),
          el('shared-ui'),
          el('shared-util'),
        ],
      },
    },
    {
      from: el('data-access'),
      allow: {
        to: [el('data-access', sameDomain), el('domain-entry', otherDomain), el('core'), el('shared-util')],
      },
    },
    { from: el('ui'), allow: { to: [el('ui', sameDomain), el('shared-ui'), el('shared-util')] } },
    { from: el('core'), allow: { to: [el('core'), el('shared-ui'), el('shared-util')] } },
    { from: el('shared-ui'), allow: { to: [el('shared-ui'), el('shared-util')] } },
    { from: el('shared-util'), allow: { to: el('shared-util') } },
    // Presentational code has no store and uses contracts for types only.
    {
      from: [el('ui'), el('shared-ui')],
      disallow: { to: { module: { origin: 'external', source: '@ngrx/*' } } },
      message: 'Presentational components must not use the store',
    },
    {
      from: el('ui'),
      dependency: { kind: 'value' },
      disallow: { to: el('contracts') },
      message: 'Presentational components may import contract types only',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.angular/**', '**/coverage/**', '**/out-tsc/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // Server and contracts.
  {
    files: ['apps/server/**/*.ts', 'packages/contracts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Web: Angular rules.
  {
    files: ['apps/web/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: `${root}/apps/web` },
    },
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
    },
  },
  {
    files: ['apps/web/src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-at-empty': 'off',
    },
  },

  // Web: architecture boundaries.
  {
    files: ['apps/web/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': root,
      'boundaries/elements': webElements,
      'boundaries/legacy-templates': false,
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: `${root}/apps/web/tsconfig.json` },
      },
    },
    rules: {
      'boundaries/dependencies': ['error', webBoundaries],
      'boundaries/no-unknown-files': 'error',
    },
  },
);
