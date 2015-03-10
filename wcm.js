var async = require('async');

module.exports = function WaterooWcm(pluginConf, web, next) {
  
  var self = this;
  web.cms.wcm = self;
  web.cms.wcm.constants = new Object();
  
  web.cms.wcm.constants.VIEWS_DIR = '/views';
  web.cms.wcm.constants.PUBLIC_DIR = '/public';

  web.cms.registerCmsModel('HtmlView', (pluginConf.pluginPath + '/models/HtmlView.js'))
    
  var dmsUtils = web.cms.utils;
  var DEFAULT_SETTINGS_PATH = '/web/settings.json';
  async.series([function(asyncCallback) {
    var defaultSettings = {
      baseDir: '/web',
      baseRouteViews: '', //can be /p for /p/about
      baseRoutePublic: '/pub',
      homeView: '/index.html'
    }

    dmsUtils.createFileIfNotExist(DEFAULT_SETTINGS_PATH, JSON.stringify(defaultSettings), function(err, doc, alreadyExists) {
      asyncCallback();
    });

  },

    function(asyncCallback) {
      if (!web.syspars) {
        console.warn('wateroo cms needs oils-plugin-syspars plugin');
        return;
      }
      web.syspars.get('WCM_RUN_ONCE', function(err, syspar) {
        if (!syspar) {
        //if (true) {

          //make sure folders exists in dms
           console.log('First time to run. Running WCM init data.');
          var fs = require('fs')
          async.series([

             function(callback) {
               fs.readFile(web.conf.baseDir + pluginConf.pluginPath + '/templates/index.html', 'utf8', function (err,data) {
                  if (err) {
                    return console.error(err);
                  }
                  
                  dmsUtils.createFileIfNotExist('/web/views/index.html', {docType:'HtmlView', content: data}, callback);
                });
            },
            
            function(callback) {
              //fs.readFile is relative to project folder
               fs.readFile(web.conf.baseDir + pluginConf.pluginPath + '/templates/main.html', 'utf8', function (err,data) {
                if (err) {
                  return console.error(err);
                }
               
                dmsUtils.createFileIfNotExist('/web/views/templates/main.html', {docType:'HtmlView', content: data}, callback);
              });
            },

           

            function(callback) {
              fs.readFile(web.conf.baseDir + pluginConf.pluginPath + '/templates/css/main.css', 'utf8', function (err,data) {
                if (err) {
                  return console.error(err);
                }
               
                dmsUtils.createFileIfNotExist('/web/public/css/main.css', data, callback);
              });

            }

          ], function() {
            asyncCallback();
            web.callEvent('cms.initWcm');
          });
           
          web.syspars.set('WCM_RUN_ONCE', 'Y')
        } else {
          asyncCallback();
          web.callEvent('cms.initWcm');
        }
      });  
    }
  ], function() {
    dmsUtils.retrieveDoc(DEFAULT_SETTINGS_PATH, function(err, doc) {
      if (err) throw err;
      if (doc) {
        var settings = JSON.parse(doc.content);
        //var baseDir = settings.baseDir;
        

        require('./wcmRoute')(pluginConf, web, settings);
      } else {
        throw new Error('Path not found ' + DEFAULT_SETTINGS_PATH);
      }
    })
  })


  next();
  

}