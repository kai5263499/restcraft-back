/*global module:false*/

module.exports = function(grunt) {

  grunt.initConfig({
    mocha: {
      all: ['tests/index.html']
    },

    watch: {
      files: '<%= jshint.src %>',
      tasks: ['jshint', 'mocha']
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

  grunt.registerTask('docker', function() {
    grunt.log.writeln('Building Dockerfile');

    // docker.buildImage('archive.tar', {t: imageName}, function (err, response){
    //   //...
    // });
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.registerTask('default', 'jshint');
  grunt.loadNpmTasks('grunt-mocha');

};