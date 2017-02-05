import gulp from 'gulp';
import autoprefixer from 'autoprefixer';
import browserify from 'browserify';
import watchify from 'watchify';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import eslint from 'gulp-eslint';
import babelify from 'babelify';
import uglify from 'gulp-uglify';
import rimraf from 'rimraf';
import notify from 'gulp-notify';
import browserSync, { reload } from 'browser-sync';
import sourcemaps from 'gulp-sourcemaps';
import postcss from 'gulp-postcss';
import rename from 'gulp-rename';
import nested from 'postcss-nested';
import vars from 'postcss-simple-vars';
import extend from 'postcss-simple-extend';
import cssnano from 'cssnano';
import imagemin from 'gulp-imagemin';
import pngquant from 'imagemin-pngquant';
import runSequence from 'run-sequence';
import ghPages from 'gulp-gh-pages';
import eStream from 'event-stream';
import factor from 'factor-bundle';
import assemble from 'assemble';
import handlebarsHelpers from 'handlebars-helpers';
import prettify from 'gulp-prettify';
import renderFile from 'assemble-render-file';

const app = assemble();

const paths = {
  bundle: 'app.js',
  entry: './src/js/app.js',
  srcCss: './src/**/*.scss',
  srcImg: './src/assets/**/**/**/**',
  srcLint: ['./src/js/polymap.js'],
  dist: './dist',
  distJs: './dist/js',
  distImg: './dist/images',
  distDeploy: './dist/**/*'
};

const entries = [
  './src/js/app.js',
  './src/js/polygen.js',
  './src/js/polymap.js',
  './src/js/video-background.js'
];

const output = [
  './dist/js/app.js',
  './dist/js/polygen.js',
  './dist/js/polymap.js',
  './dist/js/video-background.js'
];

const customOpts = {
  entries: entries,
  debug: true,
  cache: {},
  packageCache: {}
};

const opts = Object.assign({}, watchify.args, customOpts);

gulp.task('clean', cb => {
  rimraf('./dist/js/*', cb);
});

gulp.task('browserSync', () => {
  browserSync({
    server: {baseDir: './dist/'}
  });
});

gulp.task('watchify', () => {
  const bundler = watchify(browserify(opts));

  function rebundle() {
    return bundler.plugin(factor, {o: output})
      .bundle()
      .on('error', notify.onError())
      .pipe(source('common.js'))
      .pipe(gulp.dest(paths.distJs))
      .pipe(reload({stream: true}));
  }

  bundler.transform(babelify)
  .on('update', rebundle);
  return rebundle();
});

gulp.task('browserify', () => {
  return browserify({entries: entries})
  .plugin(factor, {o: output})
  .bundle()
  .pipe(source('common.js'))
  .pipe(buffer())
  .pipe(uglify())
  .pipe(gulp.dest(paths.distJs));
});

gulp.task('styles', () => {
  gulp.src(paths.srcCss)
  .pipe(rename({extname: '.css'}))
  .pipe(sourcemaps.init())
  .pipe(postcss([vars, extend, nested, autoprefixer, cssnano]))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest(paths.dist))
  .pipe(reload({stream: true}));
});

gulp.task('images', () => {
  gulp.src(paths.srcImg)
    .pipe(imagemin({
      progressive: true,
      svgoPlugins: [{removeViewBox: false}],
      use: [pngquant()]
    }))
    .pipe(gulp.dest(paths.distImg));
});

gulp.task('html', () => {
  // Find layouts and partials
  app.layouts('./src/hbs/layouts/*.hbs');
  app.partials('./src/hbs/partials/**/*.hbs');

  // Add data
  app.data({imagePath: './dist/images/'});
  app.data('./src/hbs/data/*.{json,yml}');

  // Add classic helpers
  app.helpers(handlebarsHelpers(), app.helpers());

  // Build templates
  return app.src('./src/hbs/*.hbs')
    .pipe(app.renderFile({
      name: 'default',
      locale: 'en-GB',
      timestamp: Date.now()
    }))
    .pipe(rename({extname: '.html'}))
    .pipe(prettify({indent_size: 2}))
    .pipe(app.dest('./dist/'))
    .pipe(reload({stream: true}));
});

gulp.task('lint', () => {
  gulp.src(paths.srcLint)
  .pipe(eslint())
  .pipe(eslint.format());
});

gulp.task('watchTask', () => {
  gulp.watch(paths.srcCss, ['styles']);
  gulp.watch(paths.srcLint, ['lint']);
});

gulp.task('deploy', () => {
  gulp.src(paths.distDeploy)
    .pipe(ghPages());
});

gulp.task('watch', cb => {
  runSequence('clean', ['browserSync', 'watchTask', 'watchify', 'styles', 'lint', 'html', 'images'], cb);
});

gulp.task('build', cb => {
  process.env.NODE_ENV = 'production';
  runSequence('clean', ['browserify', 'styles', 'html', 'images'], cb);
});
