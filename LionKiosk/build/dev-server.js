require('./check-versions')()

var config = require('../config')
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV)
}

var bodyParser = require('body-parser')
var opn = require('opn')
var path = require('path')
var express = require('express')
var webpack = require('webpack')
var proxyMiddleware = require('http-proxy-middleware')
var webpackConfig = (process.env.NODE_ENV === 'testing' || process.env.NODE_ENV === 'production')
  ? require('./webpack.prod.conf')
  : require('./webpack.dev.conf')
var mongoose = require('mongoose')
var bcrypt = require('bcryptjs')
var models = require('./models')

let User = models.User;
let Book = models.Book;
let Request = models.Request;
// let Book_listing = models.Book_listing;
// let Request_inbox = models.Request_inbox;

const SALT_FACTOR = 10;

mongoose.connect('mongodb://192.168.99.100:32768', {
  useMongoClient: true,
})
// default port where dev server listens for incoming traffic
var port = process.env.PORT || config.dev.port
// automatically open browser, if not set will be false
var autoOpenBrowser = !!config.dev.autoOpenBrowser
// Define HTTP proxies to your custom API backend
// https://github.com/chimurai/http-proxy-middleware
var proxyTable = config.dev.proxyTable

var app = express()
var apiRoutes = express.Router();


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//handle get request through /account route


apiRoutes.post('/reg', function(req, res) {
  let data = req.body;
  let user = new User({
    password: data.password,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
  });

  bcrypt.genSalt(SALT_FACTOR, function (saltErr, salt) {
    if (saltErr) {
      throw saltErr;
    }
    user.salt = salt;
  });
  console.log(user);
  User.findOne({'email': user.email}, function (err, newUser) {
    console.log(newUser);
    if (err) {
      res.status(400).send({error: 'query error occurred'});
    }
    if (newUser) {
      res.status(401).send({ error: 'email already in use' });
    } else {
      console.log(user);
      user.save(function (err) {
        if (err) {
          res.status(400).send({ error: 'email, password, first_name, and last_name required' });
        } else {
          res.json({
            email: data.email,
            errno: 0
          });
        }
      });
    }
  });
});

apiRoutes.post('/login', function(req, res) {
  let data = req.body;
  if (!data) {
    res.status(400).send({ error: 'username and password required' });
  }
  User.findOne({email: data.email}, function (err, user) {
    if (err) {
      res.status(400).send({ error: 'username and password required' });
    }
    if (!user) {
      res.status(400).send({ error: 'no user found!' });
    } else {
      bcrypt.hash(data.password, user.salt, function (hashErr, hash) {
        if (hashErr) {
          throw hashErr;
        }

        console.log(hash);
        console.log(user.password);
        data.password = hash;
        if (data.password !== user.password) {
          res.status(401).send({error: 'unauthorized'});
        } else {
          res.json({
            email: user.email,
            errno: 0
          });
        }
      });
    }
  });
});

apiRoutes.post('/account', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if (err) {
      res.status(400).send({error: 'query error occurred'});
    } else {
      res.json({
        first_name: foundUser.first_name,
        last_name: foundUser.last_name,
        errno: 0
      })
    }
  })
});

apiRoutes.post('/addbook', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if (err) {
      res.status(400).send({error: 'query error occurred'});
    }
    if (!foundUser) {
      res.status(400).send({error: 'no user found!'});
    } else {

      let book = new Book({
        title: data.title,
        author: data.author,
        remarks: data.remarks.split(','),
        status: 'available',
        listed_by: foundUser._id,
        on_list: true
      });

      book.save(function (err) {
        if (err) {
          console.log(err);
          res.status(400).send({error: 'cannot save to database'});
        } else {
          // success
          res.json({
            title: book.title,
            listedbyUser: foundUser.first_name,
            errno: 0
          })
        }
      });
    }
  })
});


apiRoutes.post('/getbook', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if(err) {res.status(400).send({error: 'user query error occurred'});
    } if (!foundUser) {
      res.status(400).send({ error: 'no user found!' });
    } else {
      // user found, query book
      Book.find({'listed_by':foundUser._id}, function (err, foundBooks) {
        if(err) {res.status(400).send({error: 'book query error occurred'});
        } if (!foundBooks) {
          res.status(400).send({ error: 'no books found!' });
        } else {
          // found books in a list
          res.status(200).send(foundBooks);
        }
      })
    }
  })

});


apiRoutes.get('/search', function (req, res) {
  let data = req.body;
  let srch = data.title;
  srch.trim();
  Book.find({title : { $regex: /srch/, $options: "i" }}).lean().exec(function (err, Books) {
    if(err) {res.status(400).send({error: 'query error occurred'});
    } if (!Books) {
      res.json({
        books: [],
        errno: 0
      })
    } else {
      res.json({
        books: JSON.stringify(Books),
        errno: 0
      });
    }
  })
})
app.use('/v1', apiRoutes);

var compiler = webpack(webpackConfig)

var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true
})

var hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: false,
  heartbeat: 2000
})
// force page reload when html-webpack-plugin template changes
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
})

// proxy api requests
Object.keys(proxyTable).forEach(function (context) {
  var options = proxyTable[context]
  if (typeof options === 'string') {
    options = { target: options }
  }
  app.use(proxyMiddleware(options.filter || context, options))
})

// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')())

// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)

// serve pure static assets
var staticPath = path.posix.join(config.dev.assetsPublicPath, config.dev.assetsSubDirectory)
app.use(staticPath, express.static('./static'))

var uri = 'http://localhost:' + port

var _resolve
var readyPromise = new Promise(resolve => {
  _resolve = resolve
})

console.log('> Starting dev server...')
devMiddleware.waitUntilValid(() => {
  console.log('> Listening at ' + uri + '\n')
  // when env is testing, don't need open it
  if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
    opn(uri)
  }
  _resolve()
})

var server = app.listen(port)

module.exports = {
  ready: readyPromise,
  close: () => {
    server.close()
  }
}