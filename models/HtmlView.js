module.exports = {
  name: 'HtmlView',
  label: 'Html View',
  schema: {
    docType: {type: String, required:true, default: 'HtmlView'},
  	controller: String
  },

  initSchema: function(schema) {
  },

  parentModel: web.cms.conf.models.Document,

  editables: [{"name": "name", "type": "text", "label": "Name", "required": true},
  {"name": "controller", "type": "text", "label": "Controller"},
  {"name": "content", "type": "file", "label": "Content"}  
    ]

}