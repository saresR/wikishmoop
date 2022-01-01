//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const favicon = require('express-favicon');
const cloudinary = require('cloudinary').v2;
const FuzzySearch = require('fuzzy-search');
const multer = require('multer');
const upload = multer({
  dest: 'uploads/' // this saves your file into a directory called "uploads"
});

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET // replace with dotenv when publishing!!!
});

//console.log(cloudinary.config());


mongoose.connect("mongodb://localhost:27017/notesDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true
  },
  username: {
    type: String,
    unique: true
  },
  password: String,
  grade: Number,
  bio: String,
  preferences: [], //specialties also go into this category
  edited: [], // can add infinitely many times to show HOW MANY edits are done
  score: Number, // this determines rank
  posts: [],
  pendingEdits: [{
    location: [], // array of how to "get to" the place of insertion
    newText: [],
    score: Number
  }],
  pendingFlags: [{
    location: [String],
    score: Number,
    reason: String,
    approvedBy: [String],
    rejectedBy: [String]
  }], //it will be in the form of an array with strings in an array
  notifications: [{
    text: String,
    link: String,
    closed: Boolean
  }],
});

userSchema.plugin(passportLocalMongoose);


const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// app.use(favicon(__dirname + '/public/images/favicon.png'));

let currentUser = false;
let error = false;



const litSchema = new mongoose.Schema({
  title: {
    type: String,
    unique: true
  },
  author: String,
  tags: [String],
  contributors: [String], //put usernames
  chapters: [{
    title: String,
    shortSummary: String,
    translation: String,
    whatWeGet: String,
    thingsToNote: String,
    characters: [],
    symbols: [],
    themes: []
  }],
  gradeLevel: [Number],
  rating: Number,
  lastEdited: Number,
  synopsis: String,
  cover: String,
  quizzes: [{
    title: String,
    rating: Number,
    createdBy: String,
    questions: [{
      question: String,
      answers: [String],
      correct: Number
    }]
  }],
  sections: [{ //formerly "extraWidgets"
    title: String, //can be characters, themes, symbols, quotes, context, essay prep, misc
    subpages: [{
      title: {
        type: String
      },
      overview: String,
      order: Number // this value is optional - usually in characters
    }],
    order: Number
  }],
  community: {
    qAndA: [{
      question: String,
      askedBy: String,
      askedByEmail: String,
      notify: Boolean,
      answers: [{
        answer: String,
        answeredBy: String,
        score: Number,
        likedBy: [String],
        reportedBy: [String]
      }]
    }],
    notes: [{
      url: [String],
      madeBy: String,
      description: String,
      score: Number,
      likedBy: [String],
      reportedBy: [String],
      title: String,
      tags: [String]
    }]
  }
});

//characters, themes, etc.

const Lit = new mongoose.model("Lit", litSchema);


const articleSchema = new mongoose.Schema({
  title: { //titles of these ones can be changed
    type: String,
    unique: true
  },
  subject: [String],
  overview: String,
  sections: [{
    type: {
      type: String,
      enum: ["text", "quiz"] //figure this out
    },
    title: String,
    text: String,
    order: String,
    //if quiz
    quizQuestions: [{
      question: String,
      answers: [String],
      correct: Number
    }]
  }],
  groups: [String], // group title
  tags: [String]
});

const Article = new mongoose.model("Article", articleSchema);

const groupSchema = new mongoose.Schema({
  subject: {
    type: String,
    enum: ["English", "Math", "Science", "History", "Other"]
  },
  title: {
    type: String,
    unique: true
  },
  description: String,
  sections: [{
    title: String,
    articles: [{
      title: String, // we need to figure this out, because we want article titles to be editable
      id: String
    }] //we put the article id's here
  }],
  lastEdited: String,
  contributors: [String],
  community: {
    qAndA: [{
      question: String,
      askedBy: String,
      askedByEmail: String,
      notify: Boolean,
      answers: [{
        answer: String,
        answeredBy: String,
        score: Number,
        likedBy: [String],
        reportedBy: [String]
      }]
    }],
    notes: [{
      url: [String],
      madeBy: String,
      description: String,
      score: Number,
      likedBy: [String],
      reportedBy: [String],
      title: String,
      tags: [String]
    }]
  }
});

const Group = new mongoose.model("Group", groupSchema);


app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    User.findOne({
      username: req.user.username
    }, function(err, foundUser) {
      currentUser = foundUser;
      res.render("home", {
        currentUser: currentUser,
        url: "/",
        error: error
      });
      error = false;
    });
  } else {
    currentUser = false;
    res.render("home", {
      currentUser: false,
      url: "/",
      error: error
    });
    error = false;
  }
});

app.get("/login", function(req, res) {
  if (req.isAuthenticated()) {
    req.logout();
    currentUser = false;
  }
  res.render("login", {
    currentUser: false,
    error: error,
    url: "/"
  });
  error = false;
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if (err) {
      res.redirect("/unauthorized");
    } else {
      passport.authenticate("local", {
        failureRedirect: '/unauthorized'
      })(req, res, function() {
        if (req.isAuthenticated()) {
          User.findOne({
            username: req.user.username
          }, function(err, foundUser) {
            currentUser = foundUser;
            res.redirect(req.body.url);
          });
        } else {
          res.redirect("/"); //no "return" this time
        }
      });
    }
  }); //ON THE LOGIN BUTTON WE NEED TO HAVE A VALUE AND NAME SO WE KNOW WHICH PAGE TO REDIRECT TO AFTER PEOPLE LOG IN!!!!!!!
}); //WE CAN PASS IN SOMETHING LIKE {url: "/literature"+ req.params.book or somehtings}

app.get("/unauthorized", function(req, res) {
  error = "Your username or password is incorrect";
  res.redirect("/login");
});

app.get("/signup", function(req, res) {
  if (req.isAuthenticated()) {
    req.logout();
    currentUser = false;
  }
  res.render("signup", {
    currentUser: false,
    error: error,
    url: "/"
  });
  error = false;
});


app.post("/signup", function(req, res) {
  error = false;
  const email = req.body.email;
  const username = req.body.username;
  const password = req.body.password;
  const password2 = req.body.password2;
  const grade = Number(req.body.grade);
  User.find({
    username: username
  }, function(err, found) {
    if (!err) {
      if (found.length !== 0) {
        error = "An account with that username already exists.";
      }
    }
  });
  User.find({
    email: email
  }, function(err, found) {
    if (!err) {
      if (found.length !== 0) {
        error = "An account with that email already exists. If this is you, try contacting us to see if you can reset your password.";
      }
    }
  });
  if (username.length < 5 || username.length > 15) {
    error = "Your username must be between 5 and 15 characters.";
  } else if (password !== password2) {
    error = "Your passwords do not match.";
  }
  if (error) {
    res.redirect("/signup");
  } else {
    User.register({
      username: username,
      email: email,
      grade: grade,
      bio: "",
      preferences: [], //specialties also go into this category
      edited: [],
      score: 0, // this determines rank
      posts: [],
      pendingEdits: []
    }, req.body.password, function(err, user) {
      if (err) {
        error = err;
        res.redirect("/signup");
      } else {
        res.render("success", {
          currentUser: false,
          url: "/",
          error: error
        });
        error = false;
      }
    });
  }
});



app.get("/user/:username", function (req, res){
  const username = req.params.username;
  User.findOne({username: username}, function (err, foundUser){
    if (!err && foundUser){
      res.render("profile", {
        currentUser: currentUser,
        user: foundUser,
        url: "/user/" + username,
        error: error,
      });
      if (req.isAuthenticated()){
        User.findOne({
          username: req.user.username
        }, function(err, thisUser) {
          currentUser = thisUser;
        });
      }
    } else {
      res.redirect("/404");
    }
  });
});




app.post("/flag", function(req, res) {
  const reason = req.body.flagReason;
  const location = req.body.flagLocation.split(".............6c73vc8degey88ww273t2738gi83ig829du3g80chwjs8cwu..........");
  const currentUrl = req.body.flagCurrentUrl;
  if (req.isAuthenticated()) {
    if (currentUser.username === "admin") { //OR currentUser has a certain number of points
      if (location[0] === "literature") {
        Lit.find({}, function(err, foundLits) {
          if (!err) {
            foundLits.forEach(function(book) {
              if (_.kebabCase(book.title) === _.kebabCase(location[1])) {
                let outerLocation = book;
                if (location.length === 3) { // this means that it was an "extraWidget"
                  book.sections.forEach(function(pageToDelete) {
                    if (_.kebabCase(pageToDelete.title) === _.kebabCase(location[2])) {
                      _.pull(book.sections, pageToDelete);
                      book.markModified('sections'); // for some reason this makes things work
                      book.save();
                      error = "Success!";
                      res.redirect("/literature/" + book.title);
                    }
                  });
                } else if (location.length === 4) { // this means that it was a subsection on a page (or a summary/quiz)
                  if (_.kebabCase(location[2]) === "summaries") {
                    book.chapters.forEach(function(chapter) { // it it's a summary
                      if (_.kebabCase(chapter.title) === _.kebabCase(location[3])) {
                        _.pull(book.chapters, chapter);
                        book.markModified('chapters');
                        book.save();
                        error = "Success!";
                        res.redirect("/literature/" + book.title + "/summaries");
                      }
                    });
                  } else {
                    const sections = [];
                    book.sections.forEach(function(category) {
                      sections.push(_.kebabCase(category.title));
                      if (_.kebabCase(category.title) === _.kebabCase(location[2])) {
                        category.subpages.forEach(function(subpage) {
                          if (_.kebabCase(subpage.title) === _.kebabCase(location[3])) {
                            _.pull(category.subpages, subpage);
                            book.markModified('sections');
                            error = "Success!";
                            book.save();
                          }
                        });
                        res.redirect(currentUrl);
                      }
                    });
                    if (!sections.includes(_.kebabCase(location[2]))) {
                      res.redirect("/404");
                    }
                  }
                } else if ((location.length === 5 || location.length === 6) && location[3] === "q&a") { // this menas that it was a q&a question/answer
                  book.community.qAndA.forEach(function(question) {
                    if (_.kebabCase(question.question) === _.kebabCase(location[4])) {
                      if (location.length === 5) {
                        _.pull(book.community.qAndA, question);
                      } else { // this is for answers
                        question.answers.forEach(function(answer) {
                          if (_.kebabCase(answer.answer) === _.kebabCase(location[5])) {
                            _.pull(question.answers, answer);
                          }
                        });
                      }
                      book.markModified('community');
                      book.save();
                      error = "Success!";
                      res.redirect(currentUrl);
                    }
                  });
                  // write stuff for both, then put if else for if it's a question vs an answer
                } else if (location.length === 6 && location[3] === "notes") { // this means that it was a note
                  book.community.notes.forEach(function (note){
                    if (note.url[0].substring(72, note.url[0].length) === (location[5])) {
                      _.pull(book.community.notes, note);
                      book.markModified('community');
                      book.save();
                      error = "Success!";
                      res.redirect(currentUrl);
                    }
                  });
                } else {
                  res.redirect("/404");
                }
              }
            });
          } else {
            res.redirect("/404");
          }
        });
      } else {
        // we will figure this out LATER - this is for NON LITERATURE!!!!!
      }
    } else {
      User.findOne({
        username: currentUser.username
      }, function(err, foundUser) {
        const newLocation = [];
        location.forEach(function(locationItem) {
          newLocation.push(_.kebabCase(locationItem));
        });
        if (!err) {
          let pageSent = false;
          currentUser = foundUser;
          let score = 1; /// FIX THE SCORE SITUATION!!!!!!!!!!!!!
          User.find({
            pendingFlags: {
              $exists: true
            }
          }, function(err, allUsers) {
            allUsers.forEach(function(user) {
              user.pendingFlags.forEach(function(pendingFlag) {
                if (pendingFlag.location[0] === newLocation[0] && pendingFlag.location[1] === newLocation[1] && pendingFlag.location[pendingFlag.location.length-1] === newLocation[newLocation.length-1]) {
                  if (!pendingFlag.approvedBy.includes(currentUser.username)) {
                    pendingFlag.score += score;
                    pendingFlag.approvedBy.push(currentUser.username);
                    user.save();
                    if (!pageSent) {
                      error = "Successfully flagged!! The section you just marked will be looked over.";
                      res.redirect(currentUrl);
                      pageSent = true;
                    }
                  }
                }
              });
            });
            if (!pageSent) {
              foundUser.pendingFlags.push({
                location: newLocation,
                score: score,
                reason: reason
              });
              foundUser.save();
              error = "Successfully flagged!! The section you just marked will be looked over.";
              res.redirect(currentUrl);
            }
            if (location[0] === "literature" && location.length === 6 && (location[3] === "notes" || location[3] === "q&a")) {
              Lit.find({}, function (err, foundLits){
                foundLits.forEach(function(book){
                  if (_.kebabCase(book.title) === _.kebabCase(location[1])) {
                    let score = 1; //figure this out
                    if (location[3] === "notes") {
                      book.community.notes.forEach(function(note){
                        if (note.url[0].substring(72, note.url[0].length) === (location[5])) {
                          note.reportedBy.push(currentUser.username);
                          note.score -= score;
                          book.markModified('community');
                          book.save();
                        }
                      });
                    } else if (location[3] === "q&a") {
                      //add user to reportedBy
                    } //these will be the answers
                  }
                });
              });
            } else if (location[0] === "somethingelse") {
              //fix this
            }
          });
        } else {
          res.redirect("/404");
        }
      });
    }
  } else {
    res.redirect("/404");
  }
});


app.get("/new-group", function (req, res){

  checkUser(req, User, currentUser);

  if (req.isAuthenticated() && currentUser.score > 1000) { // points/score thing - check for level 9
    Group.find({}, function (err, foundGroups){
      let groups;
      if (foundGroups && foundGroups.length >0) {
        groups = getTitles(foundGroups);
      } else {
        groups = [];
      }
      if (!err) {
        Article.find({}, function (err, foundArticles){
          if (!err){
            res.render("new-group", {
              currentUser: currentUser,
              url: "/new-group",
              error: error,
              groups: groups,
              articles: foundArticles
            });
            error = false;

            checkUser(req, User, currentUser);

          } else {
            res.redirect("/404");
          }
        });
      } else {
        res.redirect("404");
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/new-group", function (req, res){
  const title = req.body.title;
  const description = req.body.description; // WHAT YOU CAN HAVE MULTIPLE INPUTS WITH THE SAME NAME AND IT MAKES AN ARRAY!!!!
  const subject = req.body.subject;
  const group = new Group({
    title: title,
    description: description,
    subject: subject,
    contributors: [currentUser.username],
    lastEdited: Math.round((new Date()).getTime() / 1000)
  });
  group.save();
  res.redirect("/" + subject + "/" + group.title);
});

app.get("/new-article", function (req, res){
  if (req.isAuthenticated && currentUser.score > 100) { /// figure out the scoring
    Article.find({}, function (err, foundArticles){
      if (!err) {
        Group.find({}, function (err, foundGroups){
          if (!err) {
            res.render("new-article", {
              currentUser: currentUser,
              url: "/new-article",
              error: error,
              articles: foundArticles,
              groups: foundGroups
            });
            error = false;

            checkUser(req, User, currentUser);

          } else {
            res.redirect("/404");
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/new-article", function (req, res){ // try at your own risk - this has not been tested yet!!!
  checkUser(req, User, currentUser);
  let subjects = [];
  if (typeof(req.body.subject) === "string") {
    subjects.push(req.body.subject);
  } else {
    subjects = req.body.subject;
  }
  const article = new Article({
    title: req.body.title,
    // we need more stuff here :)
    lastEdited: Math.round((new Date()).getTime() / 1000),
  });
  article.save(function(err, newArticle) {
    if (!err) {
      res.redirect("/" + group + "/" + newArticle._id);
    } else {
      error = err;
      res.redirect("/new-article");
    }
  });
});

app.get(":subject/:groupTitle/:sectionTitle/new-article", function (req, res){
  //second method to create new article. linked through the group sidebar
});



app.get("/literature", function(req, res) {
  Lit.find({}, function(err, foundBooks) {
    res.render("literature", {
      currentUser: currentUser,
      books: foundBooks,
      url: "/literature",
      error: error
    });
    error = false;
    if (req.isAuthenticated()) {
      User.findOne({
        username: req.user.username
      }, function(err, foundUser) {
        currentUser = foundUser;
      });
    }
  });
});

app.get("/literature-new", function(req, res) {
  if (req.isAuthenticated() && currentUser.score > 1000) {
    res.render("literature-new", {
      currentUser: currentUser,
      url: "/literature-new",
      error: error
    });
    error = false;
    User.findOne({
      username: req.user.username
    }, function(err, foundUser) {
      currentUser = foundUser;
    });
  } else {
    res.redirect("/literature");
  }
});

app.post("/literature-new", function(req, res) {
  checkUser(req, User, currentUser);
  if (req.isAuthenticated() && currentUser.score > 1000) {
    const chapterList = [];
    if (req.body.length === "long") {
      chapterList.push({
        "title": req.body.chapter1
      }, {
        "title": req.body.chapter2
      });
    } //else if (req.body.length === "short") {
    // chapterList.push({
    // "title": (req.body.title + ": Extended Summary")
    // });
    // }
    const book = new Lit({
      title: req.body.title,
      author: req.body.author,
      contributors: [currentUser.username],
      chapters: chapterList,
      gradeLevel: [],
      lastEdited: Math.round((new Date()).getTime() / 1000),
      sections: []
    });
    book.save(function(err, newBook) {
      if (!err) {
        res.redirect("/literature/" + _.kebabCase(book.title));
      } else {
        error = err;
        res.redirect("/literature");
      }
    });
  } else {
    res.redirect("/literature");
  }
});

app.get("/literature/:bookTitle", function(req, res) {
  Lit.find({}, function(err, foundLits) {
    if (!err) {
      const bookTitle = req.params.bookTitle;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          res.render("book-homepage", {
            currentUser: currentUser,
            theBook: book,
            url: ("/literature/" + bookTitle),
            error: error
          });
          error = false;
          if (req.isAuthenticated()) {
            User.findOne({
              username: req.user.username
            }, function(err, foundUser) {
              currentUser = foundUser;
            });
          }

        }
      });
    } else {
      res.redirect("/literature");
    }
  });
});

// app.post("/book-cover", function(req, res) {
//   Lit.findOne({
//     title: req.body.bookTitle
//   }, function(err, foundBook) {
//     foundBook.cover = req.body.cover;
//     foundBook.save();
//     res.redirect("/literature/" + req.body.bookTitle);
//   });
// });


app.get("/literature/:bookTitle/new-page", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            res.render("new-lit-page", {
              currentUser: currentUser,
              theBook: book,
              url: ("/literature/" + bookTitle + "/"),
              error: error
            });
            error = false;
            if (req.isAuthenticated()) {
              User.findOne({
                username: req.user.username
              }, function(err, foundUser) {
                currentUser = foundUser;
              });
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle);
  }
});

app.post("/literature/:bookTitle/new-page", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        const pageName = req.body.pageName;
        const sectionTitle = req.body.sectionTitle;
        const sectionText = req.body.sectionText;
        const number = Number(req.body.order);// FIGURE THIS OUT!!!!!
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            book.sections.push({
              title: pageName,
              subpages: [{
                title: sectionTitle,
                overview: sectionText,
                order: number
              }]
            });
            book.save();
            res.redirect("/literature/" + bookTitle + "/" + pageName);
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/literature/:bookTitle/community", function(req, res) {
  Lit.find({}, function(err, foundLits) {
    if (!err) {
      const bookTitle = req.params.bookTitle;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          res.render("community", {
            currentUser: currentUser,
            theBook: book,
            url: ("/literature/" + bookTitle + "/community"),
            error: error,
            topic: book.title
          });
          error = false;
          if (req.isAuthenticated()) {
            User.findOne({
              username: req.user.username
            }, function(err, foundUser) {
              currentUser = foundUser;
            });
          }
        }
      });
    } else {
      res.redirect("/404");
    }
  });
});

app.get("/literature/:bookTitle/community/:subcategory", function(req, res) {
  const subcategory = req.params.subcategory;
  if (subcategory === "q&a" || subcategory === "notes") {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            if (subcategory === "q&a") {
              res.render("q-a", {
                currentUser: currentUser,
                theBook: book,
                url: ("/literature/" + bookTitle + "/community/q&a"),
                error: error,
                topic: book.title,
                questions: book.community.qAndA
              });
              error = false;
              if (req.isAuthenticated()) {
                User.findOne({
                  username: req.user.username
                }, function(err, foundUser) {
                  currentUser = foundUser;
                });
              }
            } else {
              res.render("notes", {
                currentUser: currentUser,
                theBook: book,
                url: ("/literature/" + bookTitle + "/community/notes"),
                error: error,
                topic: book.title,
                notes: book.community.notes
              });
              error = false;
              if (req.isAuthenticated()) {
                User.findOne({
                  username: req.user.username
                }, function(err, foundUser) {
                  currentUser = foundUser;
                });
              }
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("404");
  }
});


app.post("/literature/:bookTitle/community/notes", upload.array('notes'), function(req, res) { // this is for subcategory === 'notes' -note names do not have to be unique but it's better if they are
  if (req.isAuthenticated()) {
    const notes = [];
    req.files.forEach(function(file) {
      notes.push(file.path);
    });
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            const urls = [];
            let score = 0; /// !!!!!!!!!!! FIX THIS !!!!!!!!!!!!!!!
            notes.forEach(function(notePic) {
              cloudinary.uploader.upload(notePic, {
                public_id: "notes/" + notePic,
                unique_filename: true,
                resource_type: "auto"
              }, function(result, error2) {
                //note - result usually returns undefined
                const url = error2.secure_url;
                urls.push(url);
                let notSaved = true;
                setTimeout(function() { // just in case
                  if (notes.length === urls.length) {
                    book.community.notes.push({
                      url: urls,
                      madeBy: currentUser.username,
                      description: req.body.description,
                      title: req.body.title,
                      score: score,
                      likedBy: [],
                      reportedBy: []
                    });
                    book.save();
                    error= "Success!";
                    res.redirect("/literature/" + bookTitle + "/community/notes"); // +urls[1]
                  }
                }, 5);
              });
            });


            //
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle + "/community/notes");
  }

});


app.post("/literature/:bookTitle/community/:subcategory", function(req, res) {
  const subcategory = req.params.subcategory;
  if (subcategory === "q&a") {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            if (subcategory === "q&a") {
              let askedBy;
              let askedByEmail;
              if (req.isAuthenticated()) {
                askedBy = currentUser.username;
                askedByEmail = currentUser.email;
              } else {
                askedBy = "Anonymous";
                if (req.body.email) {
                  askedByEmail = req.body.email;
                }
              }
              let notify = false;
              if (req.body.notify) {
                notify = true;
              }
              const newQuestion = req.body.question;
              const questions = [];
              book.community.qAndA.forEach(function(question) {
                questions.push(_.kebabCase(question.question));
              });
              if (!questions.includes(_.kebabCase(newQuestion))) {
                book.community.qAndA.push({
                  question: req.body.question,
                  askedBy: askedBy,
                  askedByEmail: askedByEmail,
                  notify: notify,
                  answers: []
                });
                book.save();
                res.redirect("/literature/" + bookTitle + "/community/q&a");
              } else {
                error = "Another very similar question already exists!";
                res.redirect("/literature/" + bookTitle + "/community/q&a");
              }
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("404");
  }
});

app.get("/literature/:bookTitle/community/q&a/:question", function(req, res) {
  Lit.find({}, function(err, foundLits) {
    if (!err) {
      const bookTitle = req.params.bookTitle;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          const kebabQuestions = [];
          const paramQuestion = req.params.question;
          book.community.qAndA.forEach(function(question) {
            kebabQuestions.push(_.kebabCase(question.question));
            if (_.kebabCase(paramQuestion) === _.kebabCase(question.question)) {
              res.render("q-a-question", {
                currentUser: currentUser,
                theBook: book,
                url: ("/literature/" + bookTitle + "/community/q&a/" + req.params.question),
                error: error,
                topic: book.title,
                question: question
              });
              error = false;
              if (req.isAuthenticated()) {
                User.findOne({
                  username: req.user.username
                }, function(err, foundUser) {
                  currentUser = foundUser;
                });
              }
            }
          });
          if (!kebabQuestions.includes(_.kebabCase(paramQuestion))) {
            res.redirect("/404");
          }
        }
      });
    } else {
      res.redirect("/404");
    }
  });
});


app.post("/literature/:bookTitle/community/q&a/:question", function(req, res) {
  Lit.find({}, function(err, foundLits) {
    if (!err) {
      const bookTitle = req.params.bookTitle;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          const kebabQuestions = [];
          const paramQuestion = req.params.question;
          book.community.qAndA.forEach(function(question) {
            kebabQuestions.push(_.kebabCase(question.question));
            if (_.kebabCase(paramQuestion) === _.kebabCase(question.question)) {
              let score = 0; /// AND LET THIS CHANGE BASED ON TEH USER'S CURRENT SCORE!!!!!!!!!!!!!!!!
              let person;
              if (req.isAuthenticated()) {
                person = currentUser.username;
              } else {
                person = "Anonymous";
              }
              const userAnswer = req.body.answer;
              question.answers.push({
                answer: userAnswer,
                answeredBy: person,
                score: score
              });
              book.save();
              res.redirect("/literature/" + bookTitle + "/community/q&a/" + paramQuestion);
            }
          });
          if (!kebabQuestions.includes(_.kebabCase(paramQuestion))) {
            res.redirect("/404");
          }
        }
      });
    } else {
      res.redirect("/404");
    }
  });
});


app.get("/literature/:bookTitle/community/notes/uploads/:noteUrl", function (req, res){
  Lit.find({}, function (err, foundLits){
    let bookIsFound = false;
    if (!err) {
      const bookTitle = req.params.bookTitle;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          const noteUrl = req.params.noteUrl;
          bookIsFound = true;
          let noteIsFound = false;
          book.community.notes.forEach(function (note){
            const firstNote = note.url[0];
            if (firstNote.substring(72,firstNote.length) === noteUrl && !noteIsFound) {
              noteIsFound = true;
              res.render("notes-note", {
                currentUser: currentUser,
                theBook: book,
                url: ("/literature/" + bookTitle + "/community/notes/uploads/" +noteUrl),
                error: error,
                topic: book.title,
                notes: book.community.notes,
                note: note
              });
              error = false;
              if (req.isAuthenticated()) {
                User.findOne({
                  username: req.user.username
                }, function(err, foundUser) {
                  currentUser = foundUser;
                });
              }
            }
          });
          setTimeout(function () {
            if (!noteIsFound){
              res.redirect("/literature/" + book.title + "/community/notes");
            }
          }, 1000);
        }
      });
      setTimeout(function () {
        if (!bookIsFound){
          req.redirect("/404");
        }
      }, 1000);
    } else {
      res.redirect("/404");
    }
  });
});




app.get("/literature/:bookTitle/:category", function(req, res) {
  Lit.find({}, function(err, foundLits) {
    if (!err) {
      const bookTitle = req.params.bookTitle;
      const category = req.params.category;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          if (_.kebabCase(category) === "summaries") {
            res.render("summaries-homepage", {
              currentUser: currentUser,
              theBook: book,
              url: ("/literature/" + bookTitle + "/summaries"),
              error: error
            });
            error = false;
          } else if (_.kebabCase(category) === "quizzes") {
            res.render("lit-quizzes", {
              currentUser: currentUser,
              theBook: book,
              url: "/literature/" + bookTitle + "/quizzes",
              error: error
            });
            error = false;
            if (req.isAuthenticated()) {
              User.findOne({
                username: req.user.username
              }, function(err, foundUser) {
                currentUser = foundUser;
              });
            }
          } else { //characters are sorted by importance
            const widgets = [];
            book.sections.forEach(function(section) {
              widgets.push([section.subpages, section.title]);
            });
            const widgetNames = [];
            widgets.forEach(function(widget) {
              widgetNames.push(_.kebabCase(widget[1]));
            });
            if (widgetNames.includes(_.kebabCase(category))) { // we need to fix this........ (also we need the titles in kebabcase)
              widgets.forEach(function(widget) {
                if (_.kebabCase(category) === _.kebabCase(widget[1])) {
                  res.render("category-homepage", {
                    currentUser: currentUser,
                    theBook: book,
                    category: widget[1],
                    content: widget[0],
                    url: ("/literature/" + bookTitle + "/" + category),
                    error: error
                  });
                  error = false;
                  if (req.isAuthenticated()) {
                    User.findOne({
                      username: req.user.username
                    }, function(err, foundUser) {
                      currentUser = foundUser;
                    });
                  }
                }
              });
            } else {
              res.redirect("/404");
            }
          }
        }
      });
    } else {
      res.redirect("/404");
    }
  });
});

app.get("/literature/:bookTitle/summaries/new", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            res.render("new-chapter", {
              currentUser: currentUser,
              theBook: book,
              url: ("/literature/" + bookTitle + "/summaries/new"),
              error: error
            });
            error = false;
            if (req.isAuthenticated()) {
              User.findOne({
                username: req.user.username
              }, function(err, foundUser) {
                currentUser = foundUser;
              });
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle + "/summaries");
  }
});

app.post("/literature/:bookTitle/summaries/new", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.findOne({
      title: req.params.bookTitle
    }, function(err, foundLit) {
      if (!err) {
        const newChapterTitle = req.body.title;
        if (getKebabTitles(foundLit.chapters).includes(_.kebabCase(newChapterTitle))) {
          error = "A summary with that title or a very similar title already exists. All summary titles must be unique!";
          res.redirect("/literature/" + req.params.bookTitle + "/summaries/new");
        } else {
          let newChapter = {
            title: newChapterTitle,
            shortSummary: req.body.shortSummary,
            translation: req.body.translation,
            whatWeGet: req.body.whatWeGet,
            thingsToNote: req.body.thingsToNote
          };
          const index = req.body.location;
          foundLit.chapters.splice(index, 0, newChapter);
          foundLit.save();
          res.redirect("/literature/" + req.params.bookTitle + "/summaries/" + newChapter.title);
        }
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle + "/summaries");
  }
});

app.get("/literature/:bookTitle/quizzes/new", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            res.render("new-lit-quiz", {
              currentUser: currentUser,
              theBook: book,
              url: ("/literature/" + bookTitle + "/quizzes/new"),
              error: error
            });
            error = false;
            if (req.isAuthenticated()) {
              User.findOne({
                username: req.user.username
              }, function(err, foundUser) {
                currentUser = foundUser;
              });
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle + "/quizzes");
  }
});

app.post("/literature/:bookTitle/quizzes/new", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.findOne({
      title: req.params.bookTitle
    }, function(err, foundLit) {
      if (!err) {
        const newQuizTitle = req.body.title;
        if (getKebabTitles(foundLit.quizzes).includes(_.kebabCase(newQuizTitle))) {
          error = "A quiz with that title or a very similar title already exists. All quiz titles must be unique!";
          res.redirect("/literature/" + req.params.bookTitle + "/quizzes/new");
        } else {
          const quizQuestions = [];
          const numberOfQuestions = (Object.keys(req.body).length - 1) / 6;
          for (var i = 0; i < numberOfQuestions; i++) {
            const question = Object.getOwnPropertyDescriptor(req.body, "question" + i + "-question").value;
            const answer1 = Object.getOwnPropertyDescriptor(req.body, "question" + i + "-answer1").value;
            const answer2 = Object.getOwnPropertyDescriptor(req.body, "question" + i + "-answer2").value;
            const answer3 = Object.getOwnPropertyDescriptor(req.body, "question" + i + "-answer3").value;
            const answer4 = Object.getOwnPropertyDescriptor(req.body, "question" + i + "-answer4").value;
            const correct = Object.getOwnPropertyDescriptor(req.body, "question" + i + "-correct").value;
            quizQuestions.push({
              question: question,
              answers: [answer1, answer2, answer3, answer4],
              correct: correct
            });
          }
          let newQuiz = {
            title: newQuizTitle,
            questions: quizQuestions,
            createdBy: currentUser.username
          };
          foundLit.quizzes.unshift(newQuiz);
          foundLit.save();
          res.redirect("/literature/" + req.params.bookTitle + "/quizzes");
        }

      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle + "/quizzes");
  }
});


app.post("/literature/:bookTitle/:category/new", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        const category = _.kebabCase(req.params.category);
        const sectionTitle = req.body.title;
        const sectionText = req.body.text;
        const newSection = {
          title: sectionTitle,
          overview: sectionText
        };
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            const array = [];
            book.sections.forEach(function(item) {
              array.push(_.kebabCase(item.title));
            });
            if (array.includes(category)) {
              book.sections.forEach(function(section) {
                if (category === _.kebabCase(section.title)) {
                  const fourthNewArray = [];
                  section.subpages.forEach(function(page) {
                    fourthNewArray.push(_.kebabCase(page.title));
                  });
                  if (fourthNewArray.includes(_.kebabCase(newSection.title))) {
                    error = "This title is identical or very similar to an already existing section on this page!";
                    res.redirect("/literature/" + bookTitle + "/" + req.params.category + "#new");
                  } else {
                    section.subpages.push(newSection);
                    book.save();
                    res.redirect("/literature/" + bookTitle + "/" + req.params.category + "#" + newSection.title);
                  }
                }
              });
            } else {
              res.redirect("/404");
            }
                // find in sections

            // use var - book
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});





app.get("/literature/:bookTitle/summaries/:chapterName", function(req, res) {
  const category = req.params.category;
  Lit.find({}, function(err, foundLits) {
    if (!err) {
      const bookTitle = req.params.bookTitle;
      const chapterName = req.params.chapterName;
      foundLits.forEach(function(book) {
        if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
          book.chapters.forEach(function(chapter) {
            if (_.kebabCase(chapter.title) === _.kebabCase(chapterName)) {
              res.render("chapter", {
                currentUser: currentUser,
                theBook: book,
                chapter: chapter,
                url: ("/literature/" + bookTitle + "/summaries/" + chapterName),
                error: error
              });
              error = false;
              if (req.isAuthenticated()) {
                User.findOne({
                  username: req.user.username
                }, function(err, foundUser) {
                  currentUser = foundUser;
                });
              }
            }
          });
        }
      });
    } else {
      res.redirect("/404");
    }
  });
});



app.post("/literature/:bookTitle/summaries/:chapterName/tags", function(req, res) {
  const category = req.params.category;
  if (req.isAuthenticated()) {
    if (req.isAuthenticated()) {
      Lit.find({}, function(err, foundLits) {
        if (!err) {
          const bookTitle = req.params.bookTitle;
          const chapterName = req.params.chapterName;
          foundLits.forEach(function(book) {
            if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
              if (!book.contributors.includes(currentUser.username)) {
                book.contributors.push(currentUser.username);
                book.save();
              }

              book.chapters.forEach(function(chapter) {
                if (_.kebabCase(chapterName) === _.kebabCase(chapter.title)) {
                  if (req.body.remove) {
                    let removeIndex;
                    const remove = req.body.remove.split(".......");
                    if (remove[0] === "characters") {
                      removeIndex = chapter.characters.indexOf(remove[1]);
                      chapter.characters.splice(removeIndex, 1);
                      book.save();
                      res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName + "#tags");
                    } else if (remove[0] === "themes") {
                      removeIndex = chapter.themes.indexOf(remove[1]);
                      chapter.themes.splice(removeIndex, 1);
                      book.save();
                      res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName + "#tags");
                    } else if (remove[0] === "symbols") {
                      removeIndex = chapter.symbols.indexOf(remove[1]);
                      chapter.symbols.splice(removeIndex, 1);
                      book.save();
                      res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName + "#tags");
                    } else {
                      res.redirect("/404");
                    }
                  } else if (req.body.add) {
                    const characters = book.sections.filter(isCharacters);
                    console.log(characters);
                    const themes = book.sections.filter(isThemes);
                    const symbols = book.sections.filter(isSymbols);
                    if (characters.length > 0 && getTitles(characters[0].subpages).includes(req.body.add)) {
                      chapter.characters.push(req.body.add);
                      book.save();
                      res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName + "#tags");
                    } else if (themes.length > 0 && getTitles(themes[0].subpages).includes(req.body.add)) {
                      chapter.themes.push(req.body.add);
                      book.save();
                      res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName + "#tags");
                    } else if (symbols.length > 0 && getTitles(symbols[0].subpages).includes(req.body.add)) {
                      chapter.symbols.push(req.body.add);
                      book.save();
                      res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName + "#tags");
                    } else {
                      res.redirect("/404");
                    }
                  }

                }
              });
            }
          });
        } else {
          res.redirect("/404");
        }
      });
    } else {
      res.redirect("/404");
    }
  } else {
    res.redirect("/404");
  }
});

app.post("/edit/literature/:bookTitle/summaries/:chapterName", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        const chapterName = req.params.chapterName;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            if (!book.contributors.includes(currentUser.username)) {
              book.contributors.push(currentUser.username);
              book.lastUpdated = Math.round((new Date()).getTime() / 1000);
              book.save();
            }
            if (currentUser.username === "admin") {
              book.chapters.forEach(function(chapter) {
                if (_.kebabCase(chapter.title) === _.kebabCase(chapterName)) {
                  chapter.shortSummary = req.body.shortSummary;
                  chapter.translation = req.body.translation;
                  chapter.whatWeGet = req.body.whatWeGet;
                  chapter.thingsToNote = req.body.thingsToNote;
                  book.save();
                  error = "Success!";
                  res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName);
                }
              });
            } else {
              User.findOne({
                username: currentUser.username
              }, function(err, foundUser) {
                currentUser = foundUser;
                if (!err) {
                  const score = 0; /// LATER THIS INITIAL SCORE WILL DEPEND ON THE USER'S OVERALL SCORE!!!!!!!!
                  foundUser.pendingEdits.push({
                    location: ["literature", _.kebabCase(bookTitle), "summaries", _.kebabCase(chapterName)], // there will be a separate [0] for regular articles
                    newText: [{
                      shortSummary: req.body.shortSummary,
                      translation: req.body.translation,
                      whatWeGet: req.body.whatWeGet,
                      thingsToNote: req.body.thingsToNote
                    }],
                    score: score
                  });
                  foundUser.save();
                  error = "Your changes have been saved. They will become public once they are approved. You can go to your profile, view your edits, and add to these changes at any time."; // we need to fix the lastupdated of the book too
                  res.redirect("/literature/" + bookTitle + "/summaries/" + chapterName);
                } else {
                  res.redirect("/404");
                }
              });
            }
          }
        });


      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});

app.post("/edit/literature/:bookTitle/synopsis", function(req, res) {
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        const newSynopsis = req.body.synopsis;
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            if (!book.contributors.includes(currentUser.username)) {
              book.contributors.push(currentUser.username);
              book.lastUpdated = Math.round((new Date()).getTime() / 1000);
              book.save();
            }
            if (currentUser.username === "admin") {
              book.synopsis = newSynopsis;
              book.save();
              error = "Success!";
              res.redirect("/literature/" + bookTitle);
            } else {
              User.findOne({
                username: currentUser.username
              }, function(err, foundUser) {
                if (!err) {
                  const score = 0; //   !!!!!!!! WE WILL CHANGE THIS LATER!!!!!
                  foundUser.pendingEdits.push({
                    location: ["literature", _.kebabCase(bookTitle)],
                    newText: {
                      synopsis: newSynopsis
                    },
                    score: score
                  });
                  foundUser.save();
                  error = "Your changes have been saved. They will become public once they are approved. You can go to your profile, view your edits, and add to these changes at any time."; // we need to fix the lastupdated of the book too
                  res.redirect("/literature/" + bookTitle);
                } else {
                  res.redirect("/404");
                }
              });
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/literature/" + req.params.bookTitle);
  }
});

app.post("/edit/literature/:bookTitle/:category", function(req, res) { //NOT YET
  if (req.isAuthenticated()) {
    Lit.find({}, function(err, foundLits) {
      if (!err) {
        const bookTitle = req.params.bookTitle;
        const category = req.params.category;
        let newText = [];
        foundLits.forEach(function(book) {
          if (_.kebabCase(book.title) === _.kebabCase(bookTitle)) {
            if (!book.contributors.includes(currentUser.username)) {
              book.contributors.push(currentUser.username);
              book.lastUpdated = Math.round((new Date()).getTime() / 1000);
              book.save();
            }
            switch (_.kebabCase(category)) {
              case "characters":
                Object.keys(req.body).forEach(function(key) {
                  if (key.includes("105678888887897897543528304importance")) {
                    const array = key.split("105678888887897897543528304");
                    const currentSection = array[0];
                    book[_.camelCase(category)].forEach(function(categorySection) { // this part is for importance!!!!
                      if (_.kebabCase(categorySection.title) === _.kebabCase(currentSection)) {
                        categorySection.importance = Number(req.body[key]);
                      }
                    });
                  } else {
                    book[_.camelCase(category)].forEach(function(categorySection) { // this part is for regular (non sub) sections
                      if (_.kebabCase(categorySection.title) === _.kebabCase(key)) {
                        categorySection.overview = req.body[key];
                      }
                    });
                  }
                });
                newText = book[_.camelCase(category)];
                // we'll later include something that involves importance levels too !!!!!!!
                break;
              case "themes":
              case "symbols":
              case "quotes":
              case "context":
              case "essay-prep":
              case "miscellaneous":
                Object.keys(req.body).forEach(function(key) {
                  book[_.camelCase(category)].forEach(function(categorySection) {
                    if (_.kebabCase(categorySection.title) === _.kebabCase(key)) {
                      categorySection.overview = req.body[key];
                    }
                  });
                });
                newText = book[_.camelCase(category)];
                break;
              default: // this is for custom sections
                book.sections.forEach(function(section) {
                  if (_.kebabCase(section.title) === _.kebabCase(category)) {
                    Object.keys(req.body).forEach(function(key) {
                      section.subpages.forEach(function(categorySection) {
                        if (_.kebabCase(categorySection.title) === _.kebabCase(key)) {
                          categorySection.overview = req.body[key];
                        }
                      });
                    });
                    newText = section.subpages;
                  }
                });
            }
            if (currentUser.username === "admin") {
              book.save();
              error = "Success!";
              res.redirect("/literature/" + bookTitle + "/" + category);
            } else {
              User.findOne({
                username: currentUser.username
              }, function(err, foundUser) {
                currentUser = foundUser;
                if (!err) {
                  const score = 0; /// LATER THIS INITIAL SCORE WILL DEPEND ON THE USER'S OVERALL SCORE!!!!!!!!
                  foundUser.pendingEdits.push({
                    location: ["literature", _.kebabCase(bookTitle), _.kebabCase(category)], // there will be a separate [0] for regular articles
                    newText: newText,
                    score: score
                  });
                  foundUser.save();
                  error = "Your changes have been saved. They will become public once they are approved. You can go to your profile, view your edits, and add to these changes at any time."; // we need to fix the lastupdated of the book too
                  res.redirect("/literature/" + bookTitle + "/" + category);
                } else {
                  res.redirect("/404");
                }
              });
            }
          }
        });
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});



app.get("/404", function(req, res) {
  res.send("Ouch.");
});




app.get("/:subject", function (req, res){
  const subject = req.params.subject;
  if (["english", "math", "history", "science", "other"].includes(_.kebabCase(subject))) {
    Group.find({subject: _.capitalize(subject)}, function (err, foundGroups){
      if (!err) {
        res.render("subject-homepage", {
          currentUser: currentUser,
          url: "/" + subject,
          error: error,
          groups: foundGroups,
          //articles: foundArticles
        });
        error = false;
        if (req.isAuthenticated()){
          User.findOne({
            username: req.user.username
          }, function(err, foundUser) {
            currentUser = foundUser;
          });
        }
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});

app.post("/:articleId/new-section", function (req, res){
  if (req.isAuthenticated()) {
    const articleId = req.params.articleId;
    const title = req.body.title;
    const text = req.body.text;
    const type = req.body.type;
    const subject = req.body.subject;
    const group = req.body.group;
    Article.find({_id: articleId}, function (err, foundArticle){
      if (!err){
        if (type === "text"){
          foundArticle.sections.push({
            type: "text",
            title: title,
            text: text,
            order: foundArticle.sections.length+1,
            quizQuestions: []
          });
          foundArticle.save();
          res.redirect("/" + subject + "/" + group + "/" +foundArticle._id); //we shoudl pass in the subject and group as parameters
          // http://localhost:3000/English/Literary%20Devices/5efd6b5a6e110aaae31c9ed1
        } else {
          foundArticle.sections.push({
            type: "text",
            title: title,
            text: text,
            order: foundArticle.sections.length+1,
            quizQuestions: [{ // we HAVE NOT FIGURED THIS OUT YET!!!!!
              question: String,
              answers: [String],
              correct: Number
            }]
          });
          foundArticle.save();
          res.redirect("/" + subject + "/" + group + "/" +foundArticle._id);
          res.redirect("/");
        }
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});


app.get("/:subject/:articleGroup", function (req, res){
  const subject = req.params.subject;
  if (["english", "math", "history", "science", "other"].includes(_.kebabCase(subject))) {
    Group.find({subject: _.capitalize(subject)}, function (err, foundGroups){
      if (!err) {
        const articleGroup = req.params.articleGroup;
        let pageSending = false;
        foundGroups.forEach(function(group){
          if (_.kebabCase(group.title) === _.kebabCase(articleGroup)) {
            pageSending = true;
            Article.find({}, function (err, foundArticles){
              if (!err) {
                res.render("group-homepage", {
                  currentUser: currentUser,
                  url: "/" + subject + "/" + articleGroup,
                  error: error,
                  group: group,
                  articles: foundArticles
                });
                error = false;
                if(req.isAuthenticated()){
                  User.findOne({
                    username: req.user.username
                  }, function(err, foundUser) {
                    currentUser = foundUser;
                  });
                }
              } else {
                res.redirect("/404");
                pageSending = true;
              }
            });
          }
        });
        setTimeout(function () {
          if (!pageSending) {
            res.redirect("/404");
            pageSending = true;
          }
        }, 100);
      } else {
        res.redirect("/404");
        pageSending = true;
      }
    });
  } else {
    res.redirect("/404");
  }
});




app.post("/:subject/:articleGroup/description", function (req, res){
  const subject = req.params.subject;

  if (req.isAuthenticated()) {
    User.findOne({
      username: req.user.username
    }, function(err, foundUser) {
      currentUser = foundUser;
    });
  }

  if (["english", "math", "history", "science", "other"].includes(_.kebabCase(subject))) {
    Group.find({subject: _.capitalize(subject)}, function (err, foundGroups){
      if (!err) {
        const articleGroup = req.params.articleGroup;
        foundGroups.forEach(function(group){
          if (_.kebabCase(group.title) === _.kebabCase(articleGroup)) {
            const newDescription = req.body.description;
            if (currentUser.score > 1000) {
              group.description = newDescription;
              group.save();
              error =  "Success!"
              res.redirect("/" + subject + "/" + articleGroup);
            } else {
              ///add to pendingEdits
              res.redirect("/" + subject + "/" + articleGroup);
            }
          }
        });
      } else {
        res.redirect("/404");
        pageSending = true;
      }
    });
  } else {
    res.redirect("/404");
  }
});





app.get("/:subject/:articleGroup/new-section", function (req, res){ // make sure the person is logged in and has a good level
  const subject = req.params.subject;
  if (["english", "math", "history", "science", "other"].includes(_.kebabCase(subject))) {
    Group.find({subject: _.capitalize(subject)}, function (err, foundGroups){
      if (!err) {
        const articleGroup = req.params.articleGroup;
        let pageSending = false;
        foundGroups.forEach(function(group){
          if (_.kebabCase(group.title) === _.kebabCase(articleGroup)) {
            pageSending = true;
            Article.find({}, function (err, foundArticles){
              // only include articles that are a part of the correct subject!!!!!
              if (!err) {
                res.render("new-section", {
                  currentUser: currentUser,
                  url: "/" + subject + "/" + articleGroup + "/new-section",
                  error: error,
                  group: group,
                  articles: foundArticles
                });
                User.findOne({
                  username: req.user.username
                }, function(err, foundUser) {
                  currentUser = foundUser;
                });
              } else {
                res.redirect("/404");
              }
            });
          }
        });
        setTimeout(function () {
          if (!pageSending) {
            res.redirect("/404");
          }
        }, 100);
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});

app.get("/:subject/:articleGroup/:articleId", function (req, res){
  const subject = req.params.subject;
  if (["english", "math", "history", "science", "other"].includes(_.kebabCase(subject))) {
    Group.find({subject: _.capitalize(subject)}, function (err, foundGroups){
      if (!err) {
        const articleGroup = req.params.articleGroup;
        let pageSending = false;
        foundGroups.forEach(function(group){
          if (_.kebabCase(group.title) === _.kebabCase(articleGroup)) {
            pageSending = true;
            const articleId = req.params.articleId;
            Article.findOne({_id: articleId}, function (err, foundArticle){
              if (!err) {
                res.render("article", {
                  currentUser: currentUser,
                  url: "/" + subject + "/" + articleGroup + "/" + articleId,
                  error: error,
                  group: group,
                  article: foundArticle
                });
                if (req.isAuthenticated()){
                  User.findOne({
                    username: req.user.username
                  }, function(err, foundUser) {
                    currentUser = foundUser;
                  });
                }
              } else {
                res.redirect("/404");
              }
            });
          }
        });
        setTimeout(function () {
          if (!pageSending) {
            res.redirect("/404");
          }
        }, 100);
      } else {
        res.redirect("/404");
      }
    });
  } else {
    res.redirect("/404");
  }
});













function getTitles(array) {
  const newArray = [];
  for (var i = 0; i < array.length; i++) {
    newArray.push(array[i].title);
  }
  return newArray;
}

function getKebabTitles(array) {
  const newArray = [];
  for (var i = 0; i < array.length; i++) {
    newArray.push(_.kebabCase(item.title));
  }
  return newArray;
}

function isCharacters(array) {
  return array.title === "Characters";
}

function isThemes(array) {
  return array.title === "Themes";
}

function isSymbols(array) {
  return array.title === "Symbols";
}

function checkUser(req, User, currentUser){
  if (req.isAuthenticated()) {
    User.findOne({
      username: req.user.username
    }, function(err, foundUser) {
      currentUser = foundUser;
    });
  }
}





app.get("/logout", function(req, res) {
  req.logout();
  currentUser = false;
  res.redirect("/");
});






app.listen(3000, function() {
  console.log("Server started successfully");
});
