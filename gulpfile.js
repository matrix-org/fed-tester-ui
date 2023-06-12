const gulp = require('gulp')
const sass = require('gulp-sass')(require('sass'));
const concat = require('gulp-concat')
const gutil = require('gulp-util')
const imagemin = require('gulp-imagemin')
const cache = require('gulp-cache')
const gulpIf = require('gulp-if')
const browserify = require('browserify')
const del = require('del')

const source = require('vinyl-source-stream')
const buffer = require('vinyl-buffer')
const sourcemaps = require('gulp-sourcemaps')

const budo = require('budo')
const babelify = require('babelify')

const cssFiles = 'public/scss/**/*.?(s)css'

let css = gulp.src(cssFiles)
    .pipe(sass())
    .pipe(concat('style.css'))
    .pipe(gulp.dest('build'))

gulp.task('watch', function(cb) {
  budo("app.js", {
    live: true,
    dir: "build",
    port: 3000,
    browserify: {
      transform: babelify
    }
  }).on('exit', cb)
  gulp.watch(cssFiles, gulp.series(["sass"]))
})

gulp.task("clean", function(done) {
  del.sync('build')
  done()
})

gulp.task("sass", function() {
  return gulp.src(cssFiles)
    .pipe(sass())
    .pipe(concat('style.css'))
    .pipe(gulp.dest('./build'))
})

gulp.task("assets", function() {
  return gulp.src(["public/**/*", "!public/scss", "!public/scss/**/*"])
    .pipe(gulpIf('*.+(png|jpg|jpeg|gif|svg)',
      cache(imagemin({
        interlaced: true
      }))
    ))
    .pipe(gulp.dest('build'))
})

gulp.task('js', function() {
  return gulp.src(['app.js', "components/**/*"])
    .pipe(babel({
      presets: [
        ['@babel/env', {
          modules: false
        }]
      ]
    }))
    .pipe(gulp.dest('build'))
})

gulp.task('js', function() {
  let b = browserify({
    entries: 'app.js',
    debug: false,
    transform: [babelify.configure({
      presets: ['@babel/preset-env', '@babel/preset-react']
    })]
  })
  return b.bundle()
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(gulp.dest('build'))
})

gulp.task("cf", function() {
  return gulp.src(["public/_headers"])
    .pipe(gulp.dest('build'))
})

gulp.task('build', gulp.parallel(['clean', 'assets', 'js', 'sass', 'cf', function(done) {
  done()
}]))
