import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const extensions = ['.js', '.jsx'];

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'lib/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'lib/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    peerDepsExternal(),
    resolve({ 
      extensions,
      moduleDirectories: ['node_modules']
    }),
    commonjs({
      include: /node_modules/,
      transformMixedEsModules: true
    }),
    babel({
      extensions,
      babelHelpers: 'bundled',
      include: ['src/**/*'],
      presets: [
        '@babel/preset-env',
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }),
    terser(),
  ],
  external: ['react', 'react-dom', 'prop-types', /^lodash\/.*/],
}; 