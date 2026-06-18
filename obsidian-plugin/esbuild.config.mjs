import esbuild from 'esbuild';
import process from 'process';
import { copyFile } from 'fs/promises';
import builtins from 'builtin-modules';

const prod = process.argv[2] === 'production';
const stylesSource = 'src/styles.css';
const stylesTarget = 'styles.css';

const copyStylesPlugin = {
  name: 'copy-styles',
  setup(build) {
    build.onEnd(async () => {
      await copyFile(stylesSource, stylesTarget);
    });
  },
};

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    'better-sqlite3',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  plugins: [copyStylesPlugin],
});

if (prod) {
  await context.rebuild();
  await copyFile(stylesSource, stylesTarget);
  process.exit(0);
} else {
  await context.watch();
}
