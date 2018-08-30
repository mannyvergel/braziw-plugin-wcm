

module.exports = function(pluginConf, web, wcmSettings) {
  var nunjucks = web.require('nunjucks');

  if (console.isDebug) {
    console.debug('WCM Settings : ' + JSON.stringify(wcmSettings));
  }
  var dmsUtils = web.cms.utils;
  var wcmConstants = web.cms.wcm.constants;
  var baseRouteViews = wcmSettings.baseRouteViews;
  var baseRoutePublic = wcmSettings.baseRoutePublic;

  var homeView = wcmSettings.homeView;

  var baseDir = wcmSettings.baseDir;
  var viewsDir = baseDir + wcmConstants.VIEWS_DIR;

  var publicDir = baseDir + wcmConstants.PUBLIC_DIR;

  var regex = new RegExp();

  var server = web.app;

  var wcm = web.cms.wcm;



  web.on('cms.beforeRenderList', function(options, req, res) {
    var folderPath = options.folderPath;
    if (folderPath.indexOf(viewsDir) == 0) {
      options.defaultDocTypeForAddFile = 'HtmlView';
    }
  })  

  var NunjucksMongoLoader = nunjucks.Loader.extend({
    async: true,
    init: function(basePath) {
        this.pathsToNames = {};
        this.basePath = basePath;

    },
   
    getSource: function(name, callback) {

        var fullpath = web.fileUtils.joinPath(this.basePath, name);
       
        this.pathsToNames[fullpath] = name;

        dmsUtils.retrieveDoc(fullpath, function(err, doc) {
          if (err) {throw err}
          if (!doc) {
            callback(null);
          } else {
            callback(err, {src: doc.content.toString('utf-8'), path: fullpath, noCache: web.conf.isDebug});
          }
        })
      }
  });

  var nunjucksLoader = new NunjucksMongoLoader(viewsDir);
  wcm.settings = wcmSettings;
  wcm.templateEngine = new nunjucks.Environment(nunjucksLoader, {autoescape: true});
  web.templateEngine.extendNunjucks(wcm.templateEngine);

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

  var dmsRoutes = web.cms.routes;
  
  web.on('cms.afterDocumentUpdate', function(doc) {
    var fullPath = doc.folderPath + doc.name;
    if (console.isDebug) {
      console.debug('Nunjucks cache invalidated: ' + fullPath);
    }

    nunjucksLoader.emit('update', fullPath);
    //wcm.swigMongo.invalidateCache();
  })

  var publicHandler = function() {
    return function(req, res, next) {
      // if (console.isDebug) {
      //   console.debug('PASSING WCM PUBLIC LOADER');
      // }
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

  var renderMongoPath = function(name, req, res, next, options) {
    var fullpath = web.fileUtils.joinPath(viewsDir, name);
    if (console.isDebug) {
      console.debug('Render mongo path: ' + fullpath);
    }
    dmsUtils.retrieveDoc(fullpath, function(err, doc) {
      if (!doc) {
        next();
        return;
      }

      var controller;

      if (doc.get('controller')) {
        //you have to use .get() for non defined models, need to fix this issue
        controller = web.include(doc.get('controller'));
      } else {
        controller = function(callback) {
          callback(null, options);
        }
      }

      controller(function(err, options) {
        if (err) {
          throw err;
        }
        options = options || {};
        web.callEvent('beforeRender', [name, options, null, req, res])
        web.callEvent('wcm.beforeRender', [name, options, null, req, res])
         wcm.templateEngine.render(name, options, function(err, res2) {
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
      }, req, res, next);
     
    });
  
  }

  web.cms.wcm.renderPath = renderMongoPath;

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

  //web.on('initServer', function() {

    
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

  //})



}





