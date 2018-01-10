//Sahas Munamala
//January 2, 2018
//server.js

const express = require('express')
const app = express()
const fs = require('fs-extra');
const port = 3000
var jimp = require('jimp');
var formidable = require('formidable');
var util = require('util');
var uniqid = require('uniqid');
var mysql = require('mysql');
var bodyParser = require('body-parser');

var mySQLConnectionInformation = {
    "host":"localhost",
    "port":"3306",
    "user":"root",
    "password":"root",
    "database":"imageServer-db"
}


//just in case of rename
var imgPath = './user-images/';

//imageSizes
var largeImageMaxSize = 600;
var mediumImageMaxSize = 400;
var smallImageMaxSize = 200;


//home page to upload an image from
app.get('/', (request, response) => {
  fs.readFile("./html/index.html", function(error, html){
		response.writeHeader(200, {"Content-Type":"text/html"});
		response.write(html);
		response.end();
	})
})

//establish middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

//for testing only
app.get('/clearimagedata', function (req, res) {
  fs.rmdirSync('./user-images/ori');
  fs.rmdirSync('./user-images/lg');
  fs.rmdirSync('./user-images/md');
  fs.rmdirSync('./user-images/sm');

  fs.ensureDir('./user-images/ori');
  fs.ensureDir('./user-images/lg');
  fs.ensureDir('./user-images/md');
  fs.ensureDir('./user-images/sm');
})

//load image from url
app.get('/image/:name.:size', function (req, res){
  //retrieve picture name and size from url
	var picName = req.params.name;
	var picSize = req.params.size;

  //read specified file from filesystem
	fs.readFile(imgPath + picSize + '/' + picSize + '-' + picName + '.jpg',
    function(error, data) {
		  res.writeHead(200, {'content-type':'img/jpeg'});
		  res.write(data);
		  res.end(data,'binary');
	})
})


//get list of all images from specified client/patient from database
//clientID: int, patientID: int
app.get('/image/:clientID/:patientID', function (req, res) {
	var sql = 'select * from client_images where clientID='+req.params.clientID
		+' AND patientID='+req.params.patientID+';';
	var pictureID;

  //query mysql database
  con.query(sql, function(err, result) {
		if(err) throw err;

    //create a json with links to all images from client/patient
    var ret = [];
    for(var i=0;i<result.length;i++) {
      pictureID = result[i].pictureID;
      ret.push({
        'original' : 'http://localhost:3000/image/'+pictureID+'.ori',
        'large' : 'http://localhost:3000/image/'+pictureID+'.lg',
        'medium' : 'http://localhost:3000/image/'+pictureID+'.md',
        'small' : 'http://localhost:3000/image/'+pictureID+'.sm'
      })
    }

    //return the resultant json object
    res.json(ret);
	})
})

//get all sizes of a specific image
app.get('/image/all/:name', function (req, res) {
  var picName = req.params.name;

  var urls = {
    'original' : 'http://localhost:3000/image/'+picName+'.ori',
    'large' : 'http://localhost:3000/image/'+picName+'.lg',
    'medium' : 'http://localhost:3000/image/'+picName+'.md',
    'small' : 'http://localhost:3000/image/'+picName+'.sm'
  }

  res.json(urls);
})

//upload image to server filesystem
app.post('/image', function (req, res) {
  var clientID;
  var patientID;
	var form = new formidable.IncomingForm();

	//alert the browser(for testing) for a successful upload
	form.parse(req, function(error, fields, files){
    clientID = fields.clientID;
    patientID = fields.patientID;
		res.writeHead(200, {'content-type': 'text/plain'});
		res.write('received upload');
		res.end(util.inspect({fields:fields, files:files}));
	})

	//error handling
	form.on('error', function(err) {
			console.error(err);
	});
    
	//move picture from temporary location to desired location
	form.on('end', function(fields, files) {
			 var re = /(?:\.([^.]+))?$/;
			 var temp_path = this.openedFiles[0].path;
			 var file_name = uniqid();
			 var file_ori_extention = re.exec(this.openedFiles[0].name);

			 /* Location where we want to copy the uploaded file */

       //save original image to designated location (SYNC)
			 try {
				 fs.copySync(temp_path, imgPath + 'ori/ori-' + file_name + '.jpg');
				 console.log('successfully copied image to /ori path!');
			  }
			  catch (err){
				 console.log(err);
			 }

       //make large copy of original
		 jimp.read('./user-images/ori/ori-'+file_name+'.jpg', function(err, ori) {
			 if(err) throw err;
			 ori.resize(largeImageMaxSize, jimp.AUTO)
		 		.quality(60)
				.write('./user-images/lg/'+'lg-'+file_name+'.jpg');
		 });

       //make medium copy of original
		 jimp.read('./user-images/ori/ori-'+file_name+'.jpg', function(err, ori) {
			 if(err) throw err;
			 ori.resize(mediumImageMaxSize, jimp.AUTO)
				.quality(60)
				.write('./user-images/md/'+'md-'+file_name+'.jpg');
		 });

       //make small copy of original
		 jimp.read('./user-images/ori/ori-'+file_name+'.jpg', function(err, ori) {
			 if(err) throw err;
			 ori.resize(smallImageMaxSize, jimp.AUTO)
		 		.quality(60)
				.write('./user-images/sm/'+'sm-'+file_name+'.jpg');
		 });

     //insert listing of new image into mysql database
     var sql = 'INSERT INTO client_images (clientID, patientID, pictureID) values(\''
            +clientID+'\',\''+patientID+'\',\''+file_name+'\');';
     con.query(sql, function(err, result) {
         if(err) throw err;
     })
	 });
})



//create mysql connection
var con = mysql.createConnection({
  host: mySQLConnectionInformation.host,
  port: mySQLConnectionInformation.port,
  user: mySQLConnectionInformation.user,
  password: mySQLConnectionInformation.password,
  database: mySQLConnectionInformation.database
})

//connect to mysql
con.connect(function(err) {
  if(err) throw err
  console.log("Connected to mysql server");
})

//create the server
app.listen(port, (err) => {
  if (err) {
    return console.log('failed to create server', err)
  }

  console.log(`server is listening on ${port}`)
})
