// npm Packages
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");                         //Passport
const passport = require("passport");                               //Passport
const passportLocalMongoose = require("passport-local-mongoose");   //Passport
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { Configuration, OpenAIApi } = require("openai");


// use Packages
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({                                             //Passport
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize());                                //Passport
app.use(passport.session());                                   //Passport


//connect MongoDB
mongoose.connect(process.env.MONGODB).then(()=>{
  console.log("connnected")
}).catch((err)=>{
  console.log(err);
})

const userSchema = new mongoose.Schema({                  //User Schema
  name: String, 
  email: String,
  mobile: Number,
  password: String,
  history: [String],
  googleId: String,
})

// use plugins in userSchema
userSchema.plugin(passportLocalMongoose);           //Passport
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);   

passport.use(User.createStrategy());                 //Passport

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { id: user.id, username: user.username, name: user.name });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});


// use Google Login/Signup
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/chat"
},
function(accessToken, refreshToken, profile, cb) {
  User.findOrCreate({username: profile.id,googleId: profile.id,name: profile.displayName}, function (err, user) {
    return cb(err, user);
  });
}
));


//Authenticate API Key
const configuration = new Configuration({
  apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);


//Get Requests

app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("pre.ejs", { name: req.user.name });
  }
  else {
    res.redirect("./login");
  }
})

app.get("/register", function (req, res) {
  res.render("register.ejs");
})

app.get("/login", function (req, res) {
  res.render("./login.ejs");
})

app.get("/history", function (req, res) {
  User.findById(req.user.id, function (err, x) {
    if (err) console.log(err);
    else {
      if (x) {
        // console.log(x);
        res.render("history.ejs", { send: x.history });
      }
    }
  })
})

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/chat",
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
)

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (!err) res.redirect("/login");
  });
})



//Post Requests

app.post("/", async function (req, res) {
  if (req.isAuthenticated()) {
    try {
      const h = req.body.prompt;
      User.findById(req.user.id, function (err, x) {
        if (err) console.log(err);
        else {
          if (x) {
            x.history.push(h);
            x.save();
          }
        }
      })

      const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: req.body.prompt,
        max_tokens: 1024,
        n: 1,
        // stop: none,
        temperature: 0.9,
      });
      // console.log(response.data.choices[0].text)
      res.render("chat.ejs", { response: response.data.choices[0].text, name: req.user.name });
    } catch (error) {
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
      } else {
        console.log(error.message);
      }
      res.status(400).json({
        success: false,
      })
    }
  }else{
    res.redirect("/login");
  }
})

app.post("/register", function (req, res) {

  User.register({
    username: req.body.username,
    name: req.body.name,
    mobile: req.body.mobile,
    // history: "",
  },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      }
      else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/");
        })
      }
    })
})

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  })

  req.login(user, function (err) {
    if (err) console.log(err);
    else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/");
      })
    }
  })
})


// Listen at PORT 3000
app.listen(process.env.PORT, function () {
  console.log("Started!");
})