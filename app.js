require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const { Configuration, OpenAIApi } = require("openai");

const app =express();
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

const configuration = new Configuration({
  apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

app.get("/",function(req,res){
  res.render("new.ejs",{response: ""});
})
app.get("/openai/codecompletion",function(req,res){
  res.redirect("/");
})
app.post("/openai/codecompletion",async function(req,res){
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: req.body.prompt,
      max_tokens: 200,
      n: 1,
      // stop: none,
      temperature: 0.9,
    });
    console.log(response.data.choices[0].text)
    res.render("new.ejs",{response: response.data.choices[0].text});
  } catch (error) {
    if(error.response){
      console.log(error.response.status);
      console.log(error.response.data)
    }else{
      console.log(error.message);
    }
    res.status(400).json({
      success: false,
    })
  }
})


app.listen(3000,function(){
  console.log("Started!");
})