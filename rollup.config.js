import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  plugins: [
    typescript({
      include: 'src/**/*',
    }),
    terser(),
  ],
  output: {
    file: 'dist/index.js',
    format: 'es',
  },
};