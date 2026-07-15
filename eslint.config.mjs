import {includeIgnoreFile} from '@eslint/compat'
import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

export default [
  includeIgnoreFile(gitignorePath),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      'new-cap': ['error', {capIsNewExceptionPattern: String.raw`^(Fastify|FormatRegistry\.(Has|Set)|Type\.)`}],
    },
  },
]
