import typescript from 'rollup-plugin-typescript2';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import svgr from '@svgr/rollup';
import tscAlias from 'rollup-plugin-tsc-alias';
import tsconfigPaths from 'rollup-plugin-tsconfig-paths';
import alias from '@rollup/plugin-alias';
import path from 'path';
import { fileURLToPath } from 'url';
import json from '@rollup/plugin-json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    input: 'src/views/components/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'auto',
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      alias({
        entries: [
          { find: '@assets', replacement: path.resolve(__dirname, './assets') },
          { find: '@root', replacement: path.resolve(__dirname, './') },
        ],
      }),
      svgr(),
      json(),
      nodeResolve(),
      commonjs(),
      // TypeScript compilation
      typescript({ useTsconfigDeclarationDir: true }),
    ],
    external: (id) => {
      // Exclude node built-in modules and any other modules that should not be bundled
      return id.startsWith('node:') || id.startsWith('fs') || id.startsWith('path') || id.startsWith('os') || id.startsWith('util');
    },
  },
];
