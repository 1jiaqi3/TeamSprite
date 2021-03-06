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

//mongodb:<dbuser>:<dbpassword>@ds117316.mlab.com:17316/heroku_kwp6q0dd
//mongodb://<dbuser>:<dbpassword>@ds043972.mlab.com:43972/teamsprite
var MONGO_URL_PROD = 'mongodb://heroku_kwp6q0dd:20ijifp8vurchbqel0id4r3ebq@ds117316.mlab.com:17316/heroku_kwp6q0dd'
var MONGO_URL_DEV_LOCAL = 'mongodb://127.0.0.1:27017'
var MONGO_URL_DEV_MLAB = 'mongodb://teamsprite:teamsprite2017@ds043972.mlab.com:43972/teamsprite'
var MONGO_URL_PROD_JP = 'mongodb://jpdemo:jpdemo@ds135926.mlab.com:35926/heroku_xdghg29j'
mongoose.connect(MONGO_URL_PROD_JP, {
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


apiRoutes.all('/googlelogin', function (req, res) {
  console.log("entered google route")
  let data = req.body;
  console.log(data);

  User.findOne({'email': data.email}, function (err, foundUser) {
    if (err) {
      res.status(400).send({error: 'query error occurred'});
    }
    if (foundUser) {
      res.status(200).json({
        email : foundUser.email,
        id : foundUser._id,
        errno: 0
      })
    } else {
      console.log("creating user")
      var names = (data.name).split(" ");
      var firstname = names[0];
      var lastname = names[names.length - 1];
      console.log(firstname)
      console.log(lastname)

      let user = new User({
        first_name: firstname,
        last_name: lastname,
        email: data.email,
      });

      console.log('user created');
/*
      bcrypt.genSalt(SALT_FACTOR, function (saltErr, salt) {
        if (saltErr) {
          throw saltErr;
        }
        user.salt = salt;
      });
*/
      console.log(user);

      user.save(function (err) {
        if (err) {
          console.log(err);
          res.status(400).send({error: 'cannot save to database'});
        }
          console.log(user._id);
          res.status(200).json({
            email: user.email,
            id: user._id,
            errno: 0
          })
      });
    }
  })
})


apiRoutes.post('/account', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if (err) {
      res.status(400).send({error: 'query error occurred'});
    } if (!foundUser){
      res.status(404).send({error: 'user not found'});
    } else {
      res.status(200).json({
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
          res.status(200).json({
            book: book,
            errno: 0
          });
        }
      });
    }
  })
});


apiRoutes.post('/getbooks', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if(err) {res.status(400).send({error: 'user query error occurred'});
    } else if (!foundUser) {
      res.status(400).send({ error: 'no user found!' });
    } else {
      // user found, query book
      Book.find({'listed_by':foundUser._id}, function (err, foundBooks) {
        if(err) {res.status(400).send({error: 'book query error occurred'});
        } else if (foundBooks.length == 0) {
          res.status(400).send({ error: 'no books found!' });
        } else {
          // found books in a list
          console.log(foundBooks);
          res.status(200).json({
            books: foundBooks,
            errno: 0
          });
        }
      })
    }
  })
});

apiRoutes.post('/getbook', function (req, res) {
  let data = req.body;
  Book.findOne({'_id': data.bid}, function (err, foundBook) {
    if(err) {res.status(400).send({error: 'user query error occurred'});
    } else if (!foundBook) {
      res.status(400).send({ error: 'no book found!' });
    } else {
      // book found
      console.log(foundBook);
      res.status(200).send({book: foundBook});
    }
  })
});
apiRoutes.post('/getuser', function (req, res) {
  let data = req.body;
  if (data.uid) {
    User.findOne({'_id': data.uid}, function (err, foundUser) {
      if(err) {res.status(400).send({error: 'user query error occurred'});
      } else if (!foundUser) {
        res.status(400).send({ error: 'no user found!' });
      } else {
        // book found
        console.log(foundUser);
        res.status(200).send(foundUser);
      }
    })
  } else if (data.email) {
    User.findOne({'email': data.email}, function (err, foundUser) {
      if(err) {res.status(400).send({error: 'user query error occurred'});
      } else if (!foundUser) {
        res.status(400).send({ error: 'no user found!' });
      } else {
        // book found
        console.log(foundUser);
        res.status(200).send(foundUser);
      }
    })
  } else {
    res.status(400).send({ error: 'wrong req format' });
  }
});

// apiRoutes.post('/deleteBook', function (req, res) {
//   let data = req.body;
//   Book.remove({'_id': data.bid, status: 'available'}, function (err, foundBook) {
//     if(err) {res.status(400).send({error: 'user query error occurred'});
//     } else if (!foundBook) {
//       res.status(400).send({ error: 'no book found!' });
//     } else {
//       // book deleted
//       // update request
//       Request.find({'bid': data.bid}, function (err, reqs) {
//         if(err) {res.status(400).send({error: 'request query error occurred'});
//         } if (!reqs) {
//           // no other requests
//           res.status(200).json({req: request});
//         } else {
//           console.log(reqs);
//           // found reqs in a list
//           while (reqs.length !== 0) {
//             r = reqs.pop();
//             r.status = 'invalid';
//             r.save(function (err) {
//               if (err) {res.status(400).send({error: 'cannot update request database'});
//               }});}
//           res.status(200).send('book deleted');
//         }
//       });
//     }
//   })
// });


apiRoutes.post('/getreq', function (req, res) {
  let data = req.body;
  Request.findOne({'_id': data.rid}, function (err, foundReq) {
    if(err) {res.status(400).send({error: 'user query error occurred'});
    } if (!foundReq) {
      res.status(400).send({ error: 'no req found!' });
    } else {
      // book found
      console.log(foundReq);
      res.status(200).send(foundReq);
    }
  })
});

apiRoutes.all('/search', function (req, res) {
  let srch = req.body.titleOrAuthor;
  if (srch) {
    console.log("search expression")
    console.log(srch);
    srch.trim();
    let srchArray = srch.split(" ");
    let stopWords = ["a", "on", "to", "the", "of", "in", "at", "about", "an", "as"]
    for (var i = 0; i < stopWords.length; i++){
      var index = srchArray.indexOf(stopWords[i])
      if (index > -1){
        srchArray.splice(index, 1)
      }
    }
    var srchexp = new RegExp(srchArray.join("|"), "i");
    console.log(srchexp);
    Book.find({
      $or: [
        {$and: [{title: {$regex: srchexp}}, {on_list: true}]},
        {$and: [{author: {$regex: srchexp}}, {on_list: true}]}
      ]
    }).exec(function (err, Books) {
      if (err) {
        res.status(400).send({error: 'query error occurred'});
      }
      if (!Books) {
        res.json({
          books: [],
          errno: 0
        })
      } else {
        res.json({
          books: JSON.parse(JSON.stringify(Books)),
          errno: 0
        });
      }
    })
  }
  else{
    res.json({
      books: [],
      errno: 0
    })
  }
});


apiRoutes.post('/sendreq', function (req, res) {
  let data = req.body;
  console.log(data)
  User.findOne({'email' : data.from}, function (err, sender) {
    if(err) {res.status(400).send({error: 'sender query error occurred'});
    } else if (!sender) {
      res.status(400).send({ error: 'no sender found!' });
    } else {
      User.findOne({'_id' : data.to}, function (err, receiver) {
        if(err) {
          res.status(400).send({error: 'receiver query error occurred'});
        } else if (!receiver) {
          res.status(400).send({ error: 'no receiver found!' });
        } else {

          if (String(sender._id) === String(receiver._id)) {
            return res.status(400).send({error: 'You cannot request a book from yourself!'});
          } else {
            // check if the req already exist
            Request.findOne({
              'from': sender._id,
              'to': receiver._id,
              'bid': data.bid,
              'status': 'pending'
            }, function (err, request) {
              if (err) {
                res.status(400).send({error: 'request query error occurred'});
              } else if (request) {
                res.status(401).send({error: 'request already sent'});
              } else {
                // request not sent yet, check if the book is available
                Book.findOne({_id: data.bid, on_list: true, listed_by: receiver._id}, function (err, foundBook) {
                  if (err) {
                    res.status(400).send({error: 'user query error occurred'});
                  }
                  if (!foundBook) {
                    res.status(400).send({error: 'no book found!'});
                  } else {
                    // book found
                    // send new req
                    let request = new Request({
                      from: sender._id,
                      to: receiver._id,
                      status: 'pending',
                      bid: data.bid,
                      read: false
                    });

                    request.save(function (err) {
                      if (err) {
                        console.log(err);
                        res.status(400).send({error: 'cannot save req to database'});
                      } else {
                        // success
                        console.log(request);
                        res.status(200).send(request);
                      }
                    });
                  }
                })

              }
            });
          }
        }
      })
    }
  })
});


apiRoutes.post('/acceptreq', function (req, res) {
  let data = req.body;

  Request.findOne({
    '_id': data.req_id,
    'status': 'pending'
  }, function (err, request) {
    if(err) {res.status(400).send({error: 'request query error occurred'});
    } if (!request) {res.status(400).send({ error: 'req not found!' });
    } else {
      Book.findOne({_id: data.bid}, function (err, book) {
        if (err) {res.status(400).send({error: 'request query error occurred'})
        } else {
          // update req and book
          request.status = 'approved';
          request.read = true;
          book.status = 'lent';
          book.on_list = false;
          book.lento = request.from;
          request.save(function (err) {
            if (err) {res.status(400).send({error: 'cannot update req database'});
            } else {
              // request update success
              console.log(request);
              book.save(function (err) {
                if (err) {res.status(400).send({error: 'cannot update book database'});
                } else {
                  // book update success
                  console.log(request);
                  // find all other requests for the book
                  Request.find({
                    'to': request.to,
                    'bid': request.bid,
                    'status': 'pending'
                  }, function (err, reqs) {
                    if(err) {res.status(400).send({error: 'request query error occurred'});
                    } if (!reqs) {
                      // no other requests
                      res.status(200).json({req: request});
                    } else {
                      console.log(reqs);
                      // found reqs in a list
                      while (reqs.length !== 0) {
                        r = reqs.pop();
                        r.status = 'invalid';
                        r.save(function (err) {
                          if (err) {res.status(400).send({error: 'cannot update request database'});
                          }});}
                      res.status(200).json({req: request});
                    }
                  });
                }});
            }});
        }
      });
    }
  });
});

apiRoutes.post('/getRecvReqs', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if(err) {
      res.status(400).send({error: 'user query error occurred'});
    } else if (!foundUser) {
      res.status(400).send({ error: 'no user found!' });
    } else {
      // user found, query book
      Request.find({'to':foundUser._id}, function (err, reqs) {
        if(err) {res.status(400).send({error: 'request error occurred'});
        } else if (reqs.length == 0) {
          res.status(400).send({ error: 'no reqs found!' });
        } else {
          // console.log(reqs);
          // found reqs in a list
          let updatedReqs = []
          while (reqs.length !== 0) {
            request = reqs.pop();
            request.read = true;
            request.save(function (err) {
              if (err) {
                console.log(err);
                res.status(400).send({error: 'cannot update request database'});
              }});
            updatedReqs.push(request);

          }
          console.log("Sending Requests");
          console.log(updatedReqs);
          res.status(200).json({reqs: updatedReqs});
        }
      })
    }
  })
});


apiRoutes.post('/getSentReqs', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if(err) {
      res.status(400).send({error: 'user query error occurred'});
    } if (!foundUser) {
      res.status(400).send({ error: 'no user found!' });
    } else {
      // user found, query book
      Request.find({'from':foundUser._id}, function (err, reqs) {
        if(err) {res.status(400).send({error: 'request error occurred'});
        } if (reqs.length == 0) {
          res.status(400).send({ error: 'no reqs found!' });
        } else {
          console.log("Sending Reqs");
          console.log(reqs);
          res.status(200).json({reqs: reqs});
        }
      })
    }
  })
});

apiRoutes.post('/getUnread', function (req, res) {
  let data = req.body;
  User.findOne({'email': data.email}, function (err, foundUser) {
    if (err) {
      res.status(400).send({error: 'user query error occurred'});
    }
    if (!foundUser) {
      res.status(400).send({error: 'no user found!'});
    } else {
      Request.find({'to':foundUser._id}, function (err, reqs) {
        if(err) {res.status(400).send({error: 'request error occurred'});
        } if (!reqs) {
          res.status(400).send({ error: 'no reqs found!' });
        } else {
          console.log(reqs);
          // found reqs in a list
          let unread = 0;
          while (reqs.length !== 0) {
            request = reqs.pop();
            if (!request.read) {
              unread += 1;
            }
          }
          res.status(200).json({unread: unread});
        }
      })
    }
  })
});

apiRoutes.get('/test', function (req, res) {
  res.status(200).send({'hi': 'he'})
});

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

module.exports = server;
/*module.exports = {
  ready: readyPromise,
  close: () => {
    server.close()
  }
}
*/
