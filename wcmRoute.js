//var markedSwig = require('swig-marked');
//var Promise = require('es6-promise').Promise;
//var extras = require('swig-extras');
var nunjucks = require('nunjucks');
var path = require('path');
module.exports = function(pluginConf, web, wcmSettings) {
  if (console.isDebug) {
    console.debug('WCM Settings : ' + JSON.stringify(wcmSettings));
  }
  var dmsUtils = web.dms.utils;
  var wcmConstants = web.dms.wcm.constants;
  var baseRouteViews = wcmSettings.baseRouteViews;
  var baseRoutePublic = wcmSettings.baseRoutePublic;

  var homeView = wcmSettings.homeView;

  var baseDir = wcmSettings.baseDir;
  var viewsDir = baseDir + wcmConstants.VIEWS_DIR;

  var publicDir = baseDir + wcmConstants.PUBLIC_DIR;

  var regex = new RegExp();

  var server = web.app;

  var wcm = web.dms.wcm;

  var NunjucksMongoLoader = nunjucks.Loader.extend({
    async: true,
    init: function(basePath) {
        this.pathsToNames = {};
        this.basePath = basePath;

    },
   
    getSource: function(name, callback) {

        var fullpath = path.join(this.basePath, name);
       
        this.pathsToNames[fullpath] = name;

        dmsUtils.retrieveDoc(fullpath, function(err, doc) {
          if (err) {throw err}
          if (!doc) {
            callback(new Error('Path not found '+ fullpath));
          } else {
            callback(err, {src: doc.content.toString('utf-8'), path: fullpath});
          }
        })
      }
  });

  var nunjucksLoader = new NunjucksMongoLoader(viewsDir);

  wcm.templateEngine = new nunjucks.Environment(nunjucksLoader, {autoescape: true});
  

  var getRegexFromStr = function(regexStr) {
    var flags = regexStr.replace(/.*\/([gimy]*)$/, '$1');
    var pattern = regexStr.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
    return new RegExp(pattern, flags);
  }
  if (!baseRoutePublic) {
    console.error('baseRoutePublic not found in settings');
  }

  baseRouteViews = baseRouteViews || '';

  var routePublic = getRegexFromStr('/^' + baseRoutePublic + '(.*)/');
  var routeViews = getRegexFromStr('/^' + baseRouteViews + '(.*)/');

  var dmsRoutes = web.dms.routes;
  
  web.on('dms.afterDocumentUpdate', function(doc) {
    var fullPath = doc.folderPath + doc.name;
    if (console.isDebug) {
      console.debug('Nunjucks cache invalidated: ' + fullPath);
    }

    nunjucksLoader.emit('update', fullPath);
    //wcm.swigMongo.invalidateCache();
  })

  var publicHandler = function() {
    return function(req, res, next) {
      if (console.isDebug) {
        console.debug('PASSING WCM PUBLIC LOADER');
      }
      var path = req.params[0];
      if (!path) {
        path = '/index.html';
      } else {
        path = path;
      }
      var dmsPath = publicDir + path;
      if (console.isDebug) {
        console.debug('Routing dms path %s', dmsPath);
      }
      dmsUtils.retrieveDoc(dmsPath, function(err, doc) {
        if (err) throw err;

        if (doc) {
          var getMimeType = require('simple-mime')('application/octect-stream');

          var type = getMimeType(doc.name);
          res.writeHead(200, {'Content-Type': type})
          res.end(doc.content);
        } else {
          res.status(404).send('File not found.');
        }
      })
    }
  }

  var renderMongoPath = function(path, req, res, next) {
    wcm.templateEngine.render(path, {}, function(err, res2) {
      if (err) {
        if (web.conf.isDebug) {
          res.status(500).send(err.stack);
        } else {
          res.status(500).send('Internal server error');
        }
        throw err;
      }
      res.send(res2);
    });
    
  }

  var viewsHandler = function() {
    return function(req, res, next) {
      if (console.isDebug) {
        console.debug('PASSING WCM VIEWS LOADER');
      }
      var path = req.params[0];
      path = path + '.html';
      renderMongoPath(path, req, res, next);
      
    }
  }

  server.get(routePublic, publicHandler());
  server.all(routeViews, viewsHandler());
  server.all('/article/:YEAR/:SLUG', function(req, res, next) {
    var path = '/article.html';
    //console.log('!!!!' + path);
    renderMongoPath(path, req, res, next);
  })

  server.all('/article', function(req, res, next) {
    var path = '/article.html';
    //console.log('!!!!' + path);
    renderMongoPath(path, req, res, next);
  })

  
  if (homeView) {
    server.get('/', function(req, res, next) {
        renderMongoPath(homeView, req, res, next);
      })
    if (console.isDebug) {

      console.debug('Setting homeView to %s', homeView);
    }
  } else {
    if (console.isDebug) {
      console.debug('homeView not found. Skipping.');
    }
  }



}





