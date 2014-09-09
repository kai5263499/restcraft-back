/*global module:false*/

var fs = require('fs');
var childProcess = require('child_process');

module.exports = function(grunt) {

  grunt.initConfig({
    watch: {
      files: '<%= jshint.src %>',
      tasks: ['jshint']
    },

    jshint: {
      src: ['Gruntfile.js', 'server.js'],
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true,
        globals: {
          require: true,
          define: true,
          requirejs: true,
          describe: true,
          expect: true,
          it: true
        }
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.registerTask('default', 'jshint');

};