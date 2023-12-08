const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 8080;
const mysql = require("mysql");
const listEndpoints = require("express-list-endpoints")
const jwt = require("jsonwebtoken");

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(express.json())

const httpServer = app.listen(port, function () {
  console.log(`Web server is running on port ${port}`);
});

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "jensen2023",
  multipleStatements: true, 
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to the database!");
});


const crypto = require("crypto"); 
function hash(data) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

// GET ALL POSTS
app.get("/getposts", (req, res) => {
  const sql = "SELECT * FROM posts";
  db.query(sql, (err, posts) => {
    if (err) {
      console.error(err);
      res.status(500).send("Server Error get all posts");
      return;
    }
    res.json(posts);
  });
});



//GET POST BY ID & ITS COMMENTS
app.get("/getpost/:postId", (req, res) => {
  const postId = req.params.postId;

  let postSql =
    "SELECT * FROM posts WHERE post_id = ?";

  let commentsSql =
    "SELECT * FROM comments WHERE post_id = ?";

  db.query(postSql, [postId], (err, posts) => {
    if (err) {
      console.error(err);
      res.status(500).send("Server Error, getpost");
      return;
    }

    db.query(commentsSql, [postId], (err, comments) => {
      if (err) {
        console.error(err);
        res.status(500).send("Server Error, getpost");
        return;
      }
      const post = posts[0];
      post.comments = comments;
      res.json(post);
    });
  });
});



// DELETE POST BY ID
app.delete("/getpost/:id/delete", (req, res) => {
  const { id } = req.params;
  try {
    let sql = "DELETE FROM posts WHERE post_id = ?";

    db.query(sql, [id], (err, result) => {
      if (err) {
        res.status(500).json({
          success: false,
          response: "Could not delete post",
          error: err.message,
        });
      } else if (result.affectedRows > 0) {
        res.status(200).json({
          success: true,
          response: `Post with ID ${id} deleted successfully`,
        });
      } else {
        res.status(404).json({
          success: false,
          response: `Post with ID ${id} not found in the database`,
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      response: "Internal server error",
      error: error.message,
    });
  }
});



// // USER LOGIN, TOKEN AS RESPONSE (AND NAME)
app.post("/userlogin", function (req, res) {
  console.log(req.body);
  if (!(req.body && req.body.username && req.body.password && req.body.name)) {
    res.sendStatus(400);
    return;
  }
  let sql = `SELECT * FROM users WHERE username='${req.body.username}'`;

  db.query(sql, function (err, result, fields) {
    if (err) throw err;
    let passwordHash = hash(req.body.password);
    if (result[0].password == passwordHash) {
  
      let payload = {
        sub: result[0].username, 
        name: result[0].name, 
      };
      let token = jwt.sign(payload, "EnHemlighetSomIngenKanGissaXyz123%&/");
     
      res.json({ token, name: result[0].name });
    } else {
      res.sendStatus(401);
    }
  });
});



// GET USERS REQUIRE TOKEN AS AUTHORIZATION
app.get("/users", function (req, res) {
  let authHeader = req.headers["authorization"];
  if (authHeader === undefined) {
   
    res.sendStatus(400); 
    return;
  }
  let token = authHeader.slice(7); 

  let decoded;
  try {
    decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
  } catch (err) {
    res.status(401).send("Invalid auth token");
    return;
  }
  let sql = "SELECT * FROM users"; 
 
  db.query(sql, function (err, result, fields) {
    res.json(result);
  });
});



// GET A USER BY ID, REQUIRE TOKEN AS AUTHORIZATION
app.get("/users/:id", function (req, res) {
  let authHeader = req.headers["authorization"];
  if (authHeader === undefined) {
    res.sendStatus(400); 
    return;
  }
  let token = authHeader.slice(7); 
 
  let decoded;
  try {
    decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
  } catch (err) {
    console.log(err);
    res.status(401).send("Invalid auth token");
    return;
  }

  const userId = req.params.id;
 
  let sql = `SELECT * FROM users WHERE user_id = ?`;
  db.query(sql, [userId], function (err, result, fields) {
    if (err) {
      console.log(err);
      res.sendStatus(500); 
      return;
    }

    if (result.length === 0) {
      res.sendStatus(404); 
      return;
    }
    res.json(result[0]);
  });
});


// USER CHANGE PASSWORD
// app.put("/users/:id/change-password", function (req, res) {
//   let authHeader = req.headers["authorization"];
//   if (authHeader === undefined) {
//     res.sendStatus(400); 
//     return;
//   }
//   let token = authHeader.slice(7); 

//   let decoded;
//   try {
//     decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
//   } catch (err) {
//     console.log(err);
//     res.status(401).send("Invalid auth token");
//     return;
//   }

//   const userId = req.params.id;
//   const newPassword = req.body.newPassword;
//   const newPasswordHash = hash(newPassword);

//   let updateSql = `UPDATE users SET password = ? WHERE user_id = ?`;
//   db.query(updateSql, [newPasswordHash, userId], function (updateErr, updateResult, updateFields) {
//     if (updateErr) {
//       console.log(updateErr);
//       res.sendStatus(500); 
//       return;
//     }

//     if (updateResult.affectedRows > 0) {
//       res.status(200).send("Password updated successfully");
//     } else {
//       res.sendStatus(404); 
//     }
//   });
// });