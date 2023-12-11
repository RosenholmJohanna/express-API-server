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

// SEE ROUTES 
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/documentation.html");
});



// GET ALL POSTS
app.get('/getposts', (req, res) => {

  const sql = 'SELECT * FROM posts';

  db.query(sql, (err, posts) => {
    if (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: 'Server Error: Cannot get posts'
      });
      return;
    }

    if (!posts || posts.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request: No posts found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: posts
    });
  });
});



// GET POST BY ID & ITS COMMENTS
app.get("/getpost/:postId", (req, res) => {
  const { postId } = req.params

  let postSql =
    `SELECT * FROM posts WHERE post_id = ${postId}`;

  let commentsSql =
    `SELECT * FROM comments WHERE post_id = ${postId}`;

  db.query(postSql, [postId], (err, posts) => {
    if (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Server Error"
      });
      return;
    }

    if (!posts || posts.length === 0) {
      res.status(400).json({
        success: false,
        error: ` No post with id ${postId} found`
      });
      return;
    }

    db.query(commentsSql, [postId], (err, comments) => {
      if (err) {
        console.error(err);
        res.status(500).json({
          success: false,
          error: "Server Error"
        });
        return;
      }

      const post = posts[0];
      post.comments = comments;

      res.status(200).json({
        success: true,
        data: post 
        // (comments --> to display only comments belonging to chosen post)
      });
    });
  });
});




// DELETE POST BY ID (AND ITS COMMENTS)
app.delete("/getpost/:id/delete", (req, res) => {
  const { id } = req.params;
  try {

    let sql =
      `DELETE FROM posts 
     WHERE post_id = ${id}`;

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


// ADD COMMENT TO A POST
app.post("/addcomment", (req, res) => {
  try {
    const { post_id, comment } = req.body;

    // Check if post_id exist in the database
    const checkPostSql = `SELECT * FROM posts WHERE post_id = ${post_id}`;

    db.query(checkPostSql, (err, result) => {
      if (err) {
        console.error("SQL error:", checkPostSql, checkErr);
        res.status(500).json({
          success: false,
          error: "Server Error"
        });
        return;
      }

      if (result.length === 0) {
        res.status(400).json({
          success: false,
          error: `No post with id: ${post_id} found`
        });
        return;
      }

      const insertSql = `
        INSERT INTO comments (post_id, comment)
        VALUES ('${post_id}', '${comment}')`;

      db.query(insertSql, (err, result) => {
        if (err) {
          console.error("SQL error:", insertSql, err);
          res.status(500).json({
            success: false,
            error: "Server Error"
          });
          return;
        }

        let output = {
          post_id,
          comment,
        };

        res.status(200).json({
          success: true,
          message: `comment sucessfully added to post ${post_id} `,
          data: output
        });
        console.log(result);
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Server Error"
    });
  }
});



// CREATE NEW USER
app.post("/create-user", function (req, res) {
  if (!(req.body && req.body.username && req.body.password && req.body.name)) {
    res.status(400).json({
      success: false,
      error: "Name, username & password is required!"
    });
    return;
  }

  let fields = ["name", "password", "username"];
  for (let key in req.body) {
    if (!fields.includes(key)) {
      res.status(400).json({
        success: false,
        error: "Unknown field: " + key
      });
      return;
    }
  }

  let checkUsernameSql = `
  SELECT * FROM users WHERE username = '${req.body.username}'`;

  db.query(checkUsernameSql, function (err, result, checkFields) {
    if (err) {
      res.status(500).json({
        success: false,
        error: "Server Error"
      });
      return;
    }

    if (result.length > 0) {
      res.status(400).json({
        success: false,
        error: "Username is already taken"
      });
      return;
    }

    let insertSql = `INSERT INTO users (username, name, password)
    VALUES ('${req.body.username}', 
    '${req.body.name}',
    '${hash(req.body.password)}');
    SELECT LAST_INSERT_ID();`;


    db.query(insertSql, function (err, result, fields) {
      if (err) {
        res.status(500).json({
          success: false,
          error: "Server Error"
        });
        return;
      }

      let output = {
        //id: insertId,
        id: result[0].insertId,
        name: req.body.name,
        username: req.body.username,
      };

      res.status(200).json({
        success: true,
        data: output
      });
    });
  });
});


app.post("/login", function (req, res) {
  console.log("loggin req body", req.body);

  if (!(req.body && req.body.username && req.body.password && req.body.name)) {
    res.status(400).json({
      success: false,
      message: "Missing credentials"
    });
    return;
  }

  let sql = `
  SELECT * FROM users WHERE username='${req.body.username}' AND name='${req.body.name}'`;

  db.query(sql, function (err, result, fields) {
    if (err) {
      res.status(500).json({
        success: false,
        error: "Server Error"
      });
      return;
    }
    if (result.length > 0) {
      let passwordHash = hash(req.body.password);
      if (result[0].password === passwordHash) {
        let payload = {
          sub: result[0].username,
          name: result[0].name,
        };

        let token = jwt.sign(payload, "EnHemlighetSomIngenKanGissaXyz123%&/");
        console.log("Token", token);
        res.status(200).json({
          success: true,
          token
        });

      } else {
        console.log("wrong password");
        res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }
    } else {
      console.log("User not found");
      res.status(401).json({
        success: false,
        message: "User not found"
      });
    }
  });
});




// GET USERS REQUIRE TOKEN AS AUTHORIZATION
app.get("/users", function (req, res) {
  let authHeader = req.headers["authorization"];

  if (authHeader === undefined) {
    res.status(400).json({
      success: false,
      error: "Authorization header missing"
    });
    return;
  }

  let token = authHeader.slice(7);
  let decoded;

  try {
    decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
  } catch (err) {
    res.status(401).json({
      success: false,
      error: "Not authorized, invalid token"
    });
    return;
  }

  let sql = "SELECT * FROM users";

  db.query(sql, function (err, result, fields) {
    if (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Server error get users"
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result
    });
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

  let sql = `SELECT * FROM users WHERE user_id = ${userId}`;
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
    res.status(200).json(result[0]);
  });
});



// AS EXISTING USER CHANGE PASSWORD, REQUIRE TOKEN AS AUTHORIZATION
app.put("/users/:id/change-password", function (req, res) {
  const userId = req.params.id;

  let authHeader = req.headers["authorization"];
  if (authHeader === undefined) {
    res.status(400).json({
      success: false,
      error: "Bad Request: Authorization header missing"
    });
    return;
  }
  let token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
  } catch (err) {
    console.error(err);
    res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid auth token"
    });
    return;
  }

  const newPassword = req.body.newPassword;
  const newPasswordHash = hash(newPassword);

  let updateSql = `
    UPDATE users SET password = '${newPasswordHash}'
    WHERE user_id = ${userId}`;

  db.query(updateSql, [newPasswordHash, userId], function (err, result, fields) {
    if (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Server Error..."
      });
      return;
    }

    if (result.affectedRows > 0) {
      res.status(200).json({
        success: true,
        message: `Password updated to user id ${userId} successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Not Found: User with id ${userId} not found`
      });
    }
  });
});
;