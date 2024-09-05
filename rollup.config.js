import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: {
    index: 'src/index.ts',
    'vue-router': 'src/vueRouter.ts',
  },
  plugins: [
    typescript({
      include: 'src/**/*',
    }),
    terser(),
  ],
  output: {
    dir: 'dist',
    format: 'es',
  },
};